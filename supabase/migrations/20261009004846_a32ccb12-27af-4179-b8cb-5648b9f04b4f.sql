-- 1) Customer subscriptions: the app identifies a customer by their row in
--    customer_users, but the existing rules compared against the login id,
--    so "Langganan Sekarang" always failed. Accept both.
CREATE OR REPLACE FUNCTION public.is_customer_member(_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _member_id IS NOT NULL AND (
    _member_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.customer_users cu WHERE cu.id = _member_id AND cu.user_id = auth.uid())
  )
$$;

DROP POLICY IF EXISTS subs_own_select ON public.customer_subscriptions;
DROP POLICY IF EXISTS subs_own_insert ON public.customer_subscriptions;
DROP POLICY IF EXISTS subs_own_update ON public.customer_subscriptions;

CREATE POLICY subs_own_select ON public.customer_subscriptions
FOR SELECT TO authenticated
USING (public.is_customer_member(user_id) OR has_role('ho_admin'::user_role) OR has_role('ho_owner'::user_role) OR has_role('branch_manager'::user_role));

CREATE POLICY subs_own_insert ON public.customer_subscriptions
FOR INSERT TO authenticated
WITH CHECK (public.is_customer_member(user_id));

CREATE POLICY subs_own_update ON public.customer_subscriptions
FOR UPDATE TO authenticated
USING (public.is_customer_member(user_id) OR has_role('ho_admin'::user_role))
WITH CHECK (public.is_customer_member(user_id) OR has_role('ho_admin'::user_role));

-- 2) claim_voucher stored the login id, which does not exist in customer_users
--    and therefore always raised a foreign-key error. Resolve the member row.
CREATE OR REPLACE FUNCTION public.claim_voucher(_voucher_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _member uuid; _existing uuid; _new uuid;
BEGIN
  SELECT id INTO _member FROM customer_users WHERE user_id = auth.uid() LIMIT 1;
  IF _member IS NULL THEN RAISE EXCEPTION 'Akun customer tidak ditemukan'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customer_vouchers WHERE id = _voucher_id AND is_active = true AND valid_until >= CURRENT_DATE) THEN
    RAISE EXCEPTION 'Voucher tidak tersedia atau sudah kedaluwarsa';
  END IF;
  SELECT id INTO _existing FROM customer_user_vouchers WHERE user_id = _member AND voucher_id = _voucher_id LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  INSERT INTO customer_user_vouchers (user_id, voucher_id) VALUES (_member, _voucher_id) RETURNING id INTO _new;
  RETURN _new;
END; $$;

-- 3) A customer must still be able to read a voucher they already claimed even
--    after it expires, otherwise their "Voucher Saya" list renders blank rows.
DROP POLICY IF EXISTS "All users can view active vouchers" ON public.customer_vouchers;
CREATE POLICY "Anyone can view active vouchers" ON public.customer_vouchers
FOR SELECT TO anon, authenticated
USING (
  (is_active = true AND valid_until >= CURRENT_DATE)
  OR EXISTS (
    SELECT 1 FROM public.customer_user_vouchers uv
    JOIN public.customer_users cu ON cu.id = uv.user_id
    WHERE uv.voucher_id = customer_vouchers.id AND cu.user_id = auth.uid()
  )
);

-- 4) Zeger Care WhatsApp number requested by the owner.
UPDATE public.app_settings
   SET setting_value = to_jsonb('628133180488'::text), updated_at = now()
 WHERE setting_type = 'customer_app' AND setting_key = 'care.whatsapp_number';

INSERT INTO public.app_settings (setting_type, setting_key, setting_value, is_active)
SELECT 'customer_app', 'care.whatsapp_number', to_jsonb('628133180488'::text), true
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE setting_type = 'customer_app' AND setting_key = 'care.whatsapp_number'
);

-- 5) The three starter vouchers expired in January, so the voucher page was
--    empty. Keep them usable for a year.
UPDATE public.customer_vouchers
   SET valid_until = (CURRENT_DATE + INTERVAL '1 year')::date
 WHERE is_active = true AND valid_until < CURRENT_DATE;