
-- ============ SUBSCRIPTION PLANS ============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  quota integer NOT NULL DEFAULT 0,
  period_days integer NOT NULL DEFAULT 30,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_active" ON public.subscription_plans FOR SELECT USING (is_active OR public.has_role('ho_admin'::user_role) OR public.has_role('ho_owner'::user_role) OR public.has_role('branch_manager'::user_role));
CREATE POLICY "plans_manage_admin" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role('ho_admin'::user_role) OR public.has_role('ho_owner'::user_role) OR public.has_role('branch_manager'::user_role))
  WITH CHECK (public.has_role('ho_admin'::user_role) OR public.has_role('ho_owner'::user_role) OR public.has_role('branch_manager'::user_role));

-- ============ CUSTOMER SUBSCRIPTIONS ============
CREATE TABLE public.customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  remaining_quota integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_subscriptions TO authenticated;
GRANT ALL ON public.customer_subscriptions TO service_role;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_own_select" ON public.customer_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('ho_admin'::user_role) OR public.has_role('ho_owner'::user_role) OR public.has_role('branch_manager'::user_role));
CREATE POLICY "subs_own_insert" ON public.customer_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "subs_own_update" ON public.customer_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('ho_admin'::user_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role('ho_admin'::user_role));

-- ============ CUSTOMER REFERRALS ============
CREATE TABLE public.customer_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL,
  code text NOT NULL,
  reward_points integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referee_id)
);
GRANT SELECT, INSERT ON public.customer_referrals TO authenticated;
GRANT ALL ON public.customer_referrals TO service_role;
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refs_own_select" ON public.customer_referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR public.has_role('ho_admin'::user_role));

-- ============ CUSTOMER NOTIFICATIONS ============
CREATE TABLE public.customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.customer_notifications TO authenticated;
GRANT INSERT ON public.customer_notifications TO authenticated;
GRANT ALL ON public.customer_notifications TO service_role;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_read" ON public.customer_notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role('ho_admin'::user_role) OR public.has_role('ho_owner'::user_role) OR public.has_role('branch_manager'::user_role));
CREATE POLICY "notif_update_own" ON public.customer_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_insert_admin" ON public.customer_notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role('ho_admin'::user_role) OR public.has_role('ho_owner'::user_role) OR public.has_role('branch_manager'::user_role));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_subplans_updated BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.claim_voucher(_voucher_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _existing uuid; _new uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customer_vouchers WHERE id = _voucher_id AND is_active = true AND valid_until >= CURRENT_DATE) THEN
    RAISE EXCEPTION 'Voucher tidak tersedia';
  END IF;
  SELECT id INTO _existing FROM customer_user_vouchers WHERE user_id = _uid AND voucher_id = _voucher_id LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  INSERT INTO customer_user_vouchers (user_id, voucher_id) VALUES (_uid, _voucher_id) RETURNING id INTO _new;
  RETURN _new;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_voucher(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _pts int; _balance int; _hist uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT points_required INTO _pts FROM loyalty_rewards WHERE id = _reward_id AND is_active = true;
  IF _pts IS NULL THEN RAISE EXCEPTION 'Reward tidak ditemukan'; END IF;
  SELECT points_balance INTO _balance FROM customer_loyalty WHERE customer_id = _uid;
  IF _balance IS NULL OR _balance < _pts THEN RAISE EXCEPTION 'Poin tidak cukup'; END IF;
  UPDATE customer_loyalty SET points_balance = points_balance - _pts, total_redeemed_points = total_redeemed_points + _pts, updated_at = now() WHERE customer_id = _uid;
  INSERT INTO customer_points_history (user_id, change, description) VALUES (_uid, -_pts, 'Tukar reward') RETURNING id INTO _hist;
  RETURN _hist;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _referrer uuid; _reward int := 50; _ref uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM customer_referrals WHERE referee_id = _uid) THEN RAISE EXCEPTION 'Sudah pernah pakai kode referral'; END IF;
  SELECT id INTO _referrer FROM customer_users WHERE UPPER('ZG-' || SUBSTRING(id::text FROM 1 FOR 6)) = UPPER(_code) LIMIT 1;
  IF _referrer IS NULL OR _referrer = _uid THEN RAISE EXCEPTION 'Kode referral tidak valid'; END IF;
  BEGIN
    SELECT COALESCE((setting_value #>> '{}')::int, 50) INTO _reward FROM app_settings WHERE setting_key = 'referral.reward_points' AND is_active = true;
  EXCEPTION WHEN OTHERS THEN _reward := 50; END;
  INSERT INTO customer_referrals (referrer_id, referee_id, code, reward_points, status) VALUES (_referrer, _uid, UPPER(_code), _reward, 'granted') RETURNING id INTO _ref;
  INSERT INTO customer_points_history (user_id, change, description) VALUES (_referrer, _reward, 'Bonus referral'), (_uid, _reward, 'Bonus daftar via referral');
  UPDATE customer_loyalty SET points_balance = points_balance + _reward, total_earned_points = total_earned_points + _reward, updated_at = now() WHERE customer_id IN (_referrer, _uid);
  RETURN _ref;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;

-- ============ SEED app_settings ============
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description, is_active) VALUES
  ('customer_features', '{"loyalty":true,"subscription":true,"vouchers":true,"promo_reward":true,"referral":true,"care":true,"notifications":true}'::jsonb, 'customer_app', 'Toggle modul customer app', true),
  ('customer_home.sections', '{"membership":true,"voucher_referral":true,"order_types":true,"rider_nearby":true,"promo_active":true,"big_order":true,"zeger_care":true}'::jsonb, 'customer_app', 'Section visibility di customer home', true),
  ('care.whatsapp_number', '"6281330886182"'::jsonb, 'customer_app', 'Nomor WhatsApp customer service', true),
  ('care.faq_items', '[{"q":"Bagaimana cara memesan?","a":"Buka menu, pilih produk, checkout."},{"q":"Bagaimana klaim poin?","a":"Setiap transaksi otomatis dapat poin."}]'::jsonb, 'customer_app', 'FAQ customer care', true),
  ('referral.reward_points', '50'::jsonb, 'customer_app', 'Poin bonus per referral berhasil', true),
  ('referral.code_prefix', '"ZG-"'::jsonb, 'customer_app', 'Prefix kode referral', true)
ON CONFLICT (setting_key) DO NOTHING;
