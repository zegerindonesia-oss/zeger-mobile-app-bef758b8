ALTER TABLE public.loyalty_redemptions ADD COLUMN IF NOT EXISTS product_id uuid;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(_member_id uuid, _reward_id uuid)
 RETURNS TABLE(code text, points_spent integer, remaining_points integer, discount_type text, discount_value numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD; bal INTEGER; new_code TEXT; rv JSONB;
  d_type TEXT; d_value NUMERIC; d_max NUMERIC; d_min NUMERIC;
  p_id uuid; hrs NUMERIC;
BEGIN
  SELECT * INTO r FROM public.loyalty_rewards WHERE id = _reward_id AND is_active = true;
  IF r IS NULL THEN RAISE EXCEPTION 'Reward tidak tersedia'; END IF;
  IF r.stock_quantity IS NOT NULL AND r.stock_quantity <= 0 THEN RAISE EXCEPTION 'Stok reward habis'; END IF;

  SELECT COALESCE(points, 0) INTO bal FROM public.customer_users WHERE id = _member_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Member tidak ditemukan'; END IF;
  IF bal < r.points_required THEN RAISE EXCEPTION 'Poin tidak mencukupi'; END IF;

  rv := COALESCE(r.reward_value, '{}'::jsonb);
  hrs := COALESCE(NULLIF(rv->>'valid_hours','')::numeric, 24);
  d_max := NULLIF(rv->>'max_discount','')::numeric;
  d_min := COALESCE(NULLIF(rv->>'min_transaction','')::numeric, 0);

  IF r.reward_type = 'free_product' AND NULLIF(rv->>'product_id','') IS NOT NULL THEN
    p_id := (rv->>'product_id')::uuid;
    d_type := 'fixed';
    SELECT price INTO d_value FROM public.products WHERE id = p_id;
    d_value := COALESCE(d_value, 0);
  ELSE
    d_type := COALESCE(rv->>'discount_type', CASE WHEN r.reward_type = 'discount' THEN 'percentage' ELSE 'fixed' END);
    d_value := COALESCE(NULLIF(rv->>'discount_value','')::numeric, NULLIF(rv->>'value','')::numeric, 0);
  END IF;

  new_code := 'RDM' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  UPDATE public.customer_users SET points = bal - r.points_required WHERE id = _member_id;
  INSERT INTO public.customer_points_history (user_id, change, description, source, reference_id, status)
  VALUES (_member_id, -r.points_required, 'Tukar poin: ' || r.reward_name, 'redeem', new_code, 'redeemed');

  INSERT INTO public.loyalty_redemptions (member_id, reward_id, reward_name, code, points_spent,
    discount_type, discount_value, max_discount, min_transaction, expires_at, product_id)
  VALUES (_member_id, r.id, r.reward_name, new_code, r.points_required,
    d_type, d_value, d_max, d_min, now() + make_interval(mins => (hrs * 60)::int), p_id);

  IF r.stock_quantity IS NOT NULL THEN
    UPDATE public.loyalty_rewards SET stock_quantity = stock_quantity - 1 WHERE id = r.id;
  END IF;

  RETURN QUERY SELECT new_code, r.points_required, bal - r.points_required, d_type, d_value;
END;
$function$;

CREATE OR REPLACE FUNCTION public.member_benefits(_member_id uuid)
 RETURNS TABLE(id uuid, code text, reward_name text, status text, discount_type text, discount_value numeric,
   max_discount numeric, min_transaction numeric, expires_at timestamptz, used_at timestamptz, product_id uuid, image_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT lr.id, lr.code, lr.reward_name,
    CASE WHEN lr.status = 'active' AND lr.expires_at IS NOT NULL AND lr.expires_at < now() THEN 'expired' ELSE lr.status END,
    lr.discount_type, lr.discount_value, lr.max_discount, lr.min_transaction, lr.expires_at, lr.used_at,
    lr.product_id, rw.image_url
  FROM public.loyalty_redemptions lr
  LEFT JOIN public.loyalty_rewards rw ON rw.id = lr.reward_id
  WHERE lr.member_id = _member_id AND auth.uid() IS NOT NULL
  ORDER BY (lr.status = 'active' AND (lr.expires_at IS NULL OR lr.expires_at >= now())) DESC, lr.created_at DESC
  LIMIT 30;
$function$;
GRANT EXECUTE ON FUNCTION public.member_benefits(uuid) TO authenticated;