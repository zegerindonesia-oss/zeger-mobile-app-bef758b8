CREATE TABLE public.pos_printer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_printer_settings TO authenticated;
GRANT ALL ON public.pos_printer_settings TO service_role;
ALTER TABLE public.pos_printer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch staff and HO manage printer settings" ON public.pos_printer_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND COALESCE(p.is_active,true)
  AND (p.branch_id = pos_printer_settings.branch_id OR p.role::text IN ('ho_admin','ho_owner','ho_staff','1_HO_Admin','1_HO_Owner','1_HO_Staff'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND COALESCE(p.is_active,true)
  AND (p.branch_id = pos_printer_settings.branch_id OR p.role::text IN ('ho_admin','ho_owner','ho_staff','1_HO_Admin','1_HO_Owner','1_HO_Staff'))));
CREATE TRIGGER update_pos_printer_settings_updated_at BEFORE UPDATE ON public.pos_printer_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();