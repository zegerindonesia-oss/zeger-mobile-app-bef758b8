CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type text NOT NULL DEFAULT 'coffee_shop',
  plan text NOT NULL DEFAULT 'pro',
  subscription_status text NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  modules text[] NOT NULL DEFAULT ARRAY['pos']::text[],
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid,
  is_platform_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_code text NOT NULL DEFAULT 'owner',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_users TO authenticated;
GRANT ALL ON public.tenant_users TO service_role;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Zeger = tenant #1
INSERT INTO public.tenants (id, slug, name, business_type, plan, subscription_status, modules, is_platform_owner, config)
VALUES ('00000000-0000-0000-0000-000000000001', 'zeger-coffee', 'Zeger Coffee', 'coffee_shop', 'enterprise', 'active',
  ARRAY['pos','table','kds','queue','bom','loyalty','rider','customer_app','voice','invoice','finance'], true,
  '{"brand_color":"#DC2626"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _uid AND COALESCE(p.is_active, true)
    AND p.role::text IN ('ho_admin','ho_owner','1_HO_Admin','1_HO_Owner'))
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active ORDER BY created_at LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid)
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = _tenant AND user_id = _uid AND is_active)
$$;

CREATE POLICY "Members view own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id, auth.uid()) OR owner_user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Users create own tenant" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND is_platform_owner = false);
CREATE POLICY "Platform admins update tenants" ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins delete tenants" ON public.tenants FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) AND is_platform_owner = false);

CREATE POLICY "View memberships" ON public.tenant_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Owner joins own tenant" ON public.tenant_users FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_user_id = auth.uid())));
CREATE POLICY "Platform admins manage memberships" ON public.tenant_users FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins remove memberships" ON public.tenant_users FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tenants_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.tenants_touch_updated_at();

-- Additive tenant_id with Zeger default (backfills existing rows)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','profiles','products','transactions','pos_transactions','customer_orders',
    'customer_users','customers','inventory','stock_movements','raw_materials','pos_tables','pos_promotions',
    'pos_bundles','pos_vouchers','loyalty_rewards','loyalty_tiers','promo_banners','financial_transactions',
    'daily_operational_expenses','operational_expenses','shift_management','pos_shifts','pos_kds_tickets','purchases']
  LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT %L REFERENCES public.tenants(id)', t, '00000000-0000-0000-0000-000000000001');
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)', 'idx_'||t||'_tenant', t);
    END IF;
  END LOOP;
END $$;