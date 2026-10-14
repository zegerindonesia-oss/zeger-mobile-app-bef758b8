CREATE TABLE public.menu_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  multi boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_option text,
  scope_type text NOT NULL DEFAULT 'all',
  scope_values text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT ON public.menu_modifier_groups TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_modifier_groups TO authenticated;
GRANT ALL ON public.menu_modifier_groups TO service_role;
ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view modifier groups" ON public.menu_modifier_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers edit modifier groups" ON public.menu_modifier_groups FOR ALL TO authenticated USING (public.is_material_manager()) WITH CHECK (public.is_material_manager());
CREATE TRIGGER trg_menu_modifier_groups_updated BEFORE UPDATE ON public.menu_modifier_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS modifier_group_ids uuid[];