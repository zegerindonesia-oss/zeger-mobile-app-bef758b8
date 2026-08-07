
-- 1. Points history: status + idempotency
ALTER TABLE public.customer_points_history
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'earned';

CREATE UNIQUE INDEX IF NOT EXISTS customer_points_history_source_ref_uidx
  ON public.customer_points_history (source, reference_id)
  WHERE reference_id IS NOT NULL;

-- 2. Redemptions table
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  reward_name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  points_spent INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'fixed',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC,
  min_transaction NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  used_channel TEXT,
  used_reference TEXT,
  used_amount NUMERIC,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own redemptions"
ON public.loyalty_redemptions FOR SELECT TO authenticated
USING (
  member_id IN (SELECT cu.id FROM public.customer_users cu WHERE cu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active = true)
);

CREATE POLICY "Staff can update redemptions"
ON public.loyalty_redemptions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active = true));

CREATE TRIGGER update_loyalty_redemptions_updated_at
BEFORE UPDATE ON public.loyalty_redemptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Idempotent point awarding
CREATE OR REPLACE FUNCTION public.award_loyalty_points(_member_id uuid, _amount numeric, _source text, _reference_id text DEFAULT NULL::text, _description text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg JSONB;
  per_point NUMERIC;
  min_trx NUMERIC;
  enabled BOOLEAN;
  pts INTEGER;
  existing INTEGER;
BEGIN
  IF _member_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;

  IF _reference_id IS NOT NULL THEN
    SELECT change INTO existing FROM public.customer_points_history
     WHERE source = _source AND reference_id = _reference_id LIMIT 1;
    IF existing IS NOT NULL THEN RETURN existing; END IF;
  END IF;

  SELECT setting_value INTO cfg FROM public.app_settings
   WHERE setting_key = 'loyalty.earning' AND is_active = true LIMIT 1;

  enabled := COALESCE((cfg->>'enabled')::boolean, true);
  per_point := COALESCE((cfg->>'rupiah_per_point')::numeric, 10000);
  min_trx := COALESCE((cfg->>'min_transaction')::numeric, 0);

  IF NOT enabled OR per_point <= 0 OR _amount < min_trx THEN RETURN 0; END IF;

  pts := floor(_amount / per_point)::int;
  IF pts <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.customer_points_history (user_id, change, description, source, reference_id, status)
  VALUES (_member_id, pts, COALESCE(_description, 'Poin dari transaksi ' || _source), _source, _reference_id, 'earned')
  ON CONFLICT DO NOTHING;

  UPDATE public.customer_users SET points = COALESCE(points, 0) + pts WHERE id = _member_id;

  RETURN pts;
END;
$function$;

-- 4. Redeem a reward into a redemption code
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(_member_id uuid, _reward_id uuid)
RETURNS TABLE(code text, points_spent integer, remaining_points integer, discount_type text, discount_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  bal INTEGER;
  new_code TEXT;
  rv JSONB;
  d_type TEXT;
  d_value NUMERIC;
  d_max NUMERIC;
  d_min NUMERIC;
BEGIN
  SELECT * INTO r FROM public.loyalty_rewards WHERE id = _reward_id AND is_active = true;
  IF r IS NULL THEN RAISE EXCEPTION 'Reward tidak tersedia'; END IF;
  IF r.stock_quantity IS NOT NULL AND r.stock_quantity <= 0 THEN RAISE EXCEPTION 'Stok reward habis'; END IF;

  SELECT COALESCE(points, 0) INTO bal FROM public.customer_users WHERE id = _member_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Member tidak ditemukan'; END IF;
  IF bal < r.points_required THEN RAISE EXCEPTION 'Poin tidak mencukupi'; END IF;

  rv := COALESCE(r.reward_value, '{}'::jsonb);
  d_type := COALESCE(rv->>'discount_type', CASE WHEN r.reward_type = 'discount' THEN 'percentage' ELSE 'fixed' END);
  d_value := COALESCE((rv->>'discount_value')::numeric, (rv->>'value')::numeric, 0);
  d_max := (rv->>'max_discount')::numeric;
  d_min := COALESCE((rv->>'min_transaction')::numeric, 0);

  new_code := 'RDM' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  UPDATE public.customer_users SET points = bal - r.points_required WHERE id = _member_id;

  INSERT INTO public.customer_points_history (user_id, change, description, source, reference_id, status)
  VALUES (_member_id, -r.points_required, 'Tukar poin: ' || r.reward_name, 'redeem', new_code, 'redeemed');

  INSERT INTO public.loyalty_redemptions (
    member_id, reward_id, reward_name, code, points_spent,
    discount_type, discount_value, max_discount, min_transaction, expires_at
  ) VALUES (
    _member_id, r.id, r.reward_name, new_code, r.points_required,
    d_type, d_value, d_max, d_min, now() + interval '30 days'
  );

  IF r.stock_quantity IS NOT NULL THEN
    UPDATE public.loyalty_rewards SET stock_quantity = stock_quantity - 1 WHERE id = r.id;
  END IF;

  RETURN QUERY SELECT new_code, r.points_required, bal - r.points_required, d_type, d_value;
END;
$function$;

-- 5. Lookup redemption code
CREATE OR REPLACE FUNCTION public.lookup_redemption(_code text)
RETURNS TABLE(id uuid, code text, member_id uuid, member_name text, reward_name text, discount_type text, discount_value numeric, max_discount numeric, min_transaction numeric, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT lr.id, lr.code, lr.member_id, cu.name, lr.reward_name, lr.discount_type,
         lr.discount_value, lr.max_discount, lr.min_transaction,
         CASE WHEN lr.status = 'active' AND lr.expires_at IS NOT NULL AND lr.expires_at < now()
              THEN 'expired' ELSE lr.status END
  FROM public.loyalty_redemptions lr
  LEFT JOIN public.customer_users cu ON cu.id = lr.member_id
  WHERE lr.code = upper(trim(_code))
  LIMIT 1;
$function$;

-- 6. Consume redemption code
CREATE OR REPLACE FUNCTION public.use_redemption(_code text, _amount numeric, _channel text, _reference text DEFAULT NULL::text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  disc NUMERIC;
BEGIN
  SELECT * INTO r FROM public.loyalty_redemptions WHERE code = upper(trim(_code)) FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Kode penukaran tidak ditemukan'; END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'Kode penukaran sudah dipakai atau tidak aktif'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    UPDATE public.loyalty_redemptions SET status = 'expired' WHERE id = r.id;
    RAISE EXCEPTION 'Kode penukaran sudah kedaluwarsa';
  END IF;
  IF _amount < COALESCE(r.min_transaction, 0) THEN
    RAISE EXCEPTION 'Minimal transaksi Rp% belum terpenuhi', r.min_transaction;
  END IF;

  IF r.discount_type = 'percentage' THEN
    disc := _amount * r.discount_value / 100;
    IF r.max_discount IS NOT NULL THEN disc := LEAST(disc, r.max_discount); END IF;
  ELSE
    disc := r.discount_value;
  END IF;
  disc := LEAST(GREATEST(disc, 0), _amount);

  UPDATE public.loyalty_redemptions
     SET status = 'used', used_at = now(), used_channel = _channel,
         used_reference = _reference, used_amount = disc
   WHERE id = r.id;

  RETURN disc;
END;
$function$;

-- 7. Member points history (readable by staff after scan)
CREATE OR REPLACE FUNCTION public.member_points_history(_member_id uuid, _limit integer DEFAULT 50)
RETURNS TABLE(id uuid, change integer, description text, source text, reference_id text, status text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT h.id, h.change, h.description, h.source, h.reference_id, h.status, h.created_at
  FROM public.customer_points_history h
  WHERE h.user_id = _member_id
  ORDER BY h.created_at DESC
  LIMIT COALESCE(_limit, 50);
$function$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_redemption(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_redemption(text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_points_history(uuid, integer) TO authenticated;
