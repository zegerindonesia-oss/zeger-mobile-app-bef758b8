CREATE TABLE public.flow_tenant_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  business_type text NOT NULL,
  outlet_count text,
  owner_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  first_outlet_name text,
  city text,
  menu_template text,
  modules text[] NOT NULL DEFAULT '{}',
  plan text NOT NULL DEFAULT 'pro',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.flow_tenant_signups TO anon, authenticated;
GRANT SELECT, UPDATE ON public.flow_tenant_signups TO authenticated;
GRANT ALL ON public.flow_tenant_signups TO service_role;
ALTER TABLE public.flow_tenant_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit signup" ON public.flow_tenant_signups FOR INSERT TO anon, authenticated
  WITH CHECK (length(company_name) BETWEEN 2 AND 120 AND length(email) BETWEEN 5 AND 200 AND status = 'pending');
CREATE POLICY "HO admins view signups" ON public.flow_tenant_signups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active AND p.role::text IN ('ho_admin','1_HO_Admin','ho_owner','1_HO_Owner')));
CREATE POLICY "HO admins update signups" ON public.flow_tenant_signups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active AND p.role::text IN ('ho_admin','1_HO_Admin','ho_owner','1_HO_Owner')));