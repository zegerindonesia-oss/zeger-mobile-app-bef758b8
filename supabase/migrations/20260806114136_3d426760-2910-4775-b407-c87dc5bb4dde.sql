-- 1. Loyalty settings
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description, is_active)
VALUES ('loyalty.earning', '{"enabled": true, "rupiah_per_point": 10000, "min_transaction": 0}'::jsonb, 'loyalty', 'Pengaturan perolehan poin loyalty', true)
ON CONFLICT DO NOTHING;

-- 2. Member code on customer_users
ALTER TABLE public.customer_users ADD COLUMN IF NOT EXISTS member_code TEXT;

CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
BEGIN
  LOOP
    code := 'ZGM' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customer_users WHERE member_code = code);
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.customer_users SET member_code = public.generate_member_code() WHERE member_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_users_member_code_key ON public.customer_users (member_code);

CREATE OR REPLACE FUNCTION public.set_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.member_code IS NULL THEN
    NEW.member_code := public.generate_member_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_member_code ON public.customer_users;
CREATE TRIGGER trg_set_member_code BEFORE INSERT ON public.customer_users
FOR EACH ROW EXECUTE FUNCTION public.set_member_code();

-- 3. Link transactions to members
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.customer_users(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.customer_users(id) ON DELETE SET NULL;

-- 4. Points history source tracking
ALTER TABLE public.customer_points_history ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.customer_points_history ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- 5. Lookup member (for rider/kasir QR scan)
CREATE OR REPLACE FUNCTION public.lookup_member(_code TEXT)
RETURNS TABLE(id UUID, name TEXT, phone TEXT, email TEXT, member_code TEXT, points INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.id, cu.name, cu.phone, cu.email, cu.member_code, COALESCE(cu.points, 0)
  FROM public.customer_users cu
  WHERE cu.member_code = upper(trim(_code))
     OR cu.phone = trim(_code)
     OR cu.id::text = trim(_code)
  LIMIT 1;
$$;

-- 6. Award points based on settings
CREATE OR REPLACE FUNCTION public.award_loyalty_points(_member_id UUID, _amount NUMERIC, _source TEXT, _reference_id TEXT DEFAULT NULL, _description TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg JSONB;
  per_point NUMERIC;
  min_trx NUMERIC;
  enabled BOOLEAN;
  pts INTEGER;
BEGIN
  IF _member_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;

  SELECT setting_value INTO cfg FROM public.app_settings
   WHERE setting_key = 'loyalty.earning' AND is_active = true LIMIT 1;

  enabled := COALESCE((cfg->>'enabled')::boolean, true);
  per_point := COALESCE((cfg->>'rupiah_per_point')::numeric, 10000);
  min_trx := COALESCE((cfg->>'min_transaction')::numeric, 0);

  IF NOT enabled OR per_point <= 0 OR _amount < min_trx THEN RETURN 0; END IF;

  pts := floor(_amount / per_point)::int;
  IF pts <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.customer_points_history (user_id, change, description, source, reference_id)
  VALUES (_member_id, pts, COALESCE(_description, 'Poin dari transaksi ' || _source), _source, _reference_id);

  UPDATE public.customer_users SET points = COALESCE(points, 0) + pts WHERE id = _member_id;

  RETURN pts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_member(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;