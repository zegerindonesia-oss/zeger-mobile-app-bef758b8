
CREATE TABLE IF NOT EXISTS public.rider_kasbon (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL,
  kasbon_date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rider_kasbon_rider_date_unique UNIQUE (rider_id, kasbon_date)
);

CREATE INDEX IF NOT EXISTS idx_rider_kasbon_rider_date ON public.rider_kasbon(rider_id, kasbon_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rider_kasbon TO authenticated;
GRANT ALL ON public.rider_kasbon TO service_role;

ALTER TABLE public.rider_kasbon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders view own kasbon"
ON public.rider_kasbon FOR SELECT
TO authenticated
USING (
  rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Managers view kasbon"
ON public.rider_kasbon FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() IN ('ho_admin','branch_manager','sb_branch_manager','finance','ho_owner','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','3_SB_Branch_Manager')
);

CREATE POLICY "Managers insert kasbon"
ON public.rider_kasbon FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('ho_admin','branch_manager','sb_branch_manager','finance','ho_owner','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','3_SB_Branch_Manager')
);

CREATE POLICY "Managers update kasbon"
ON public.rider_kasbon FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() IN ('ho_admin','branch_manager','sb_branch_manager','finance','ho_owner','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','3_SB_Branch_Manager')
)
WITH CHECK (
  public.get_current_user_role() IN ('ho_admin','branch_manager','sb_branch_manager','finance','ho_owner','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','3_SB_Branch_Manager')
);

CREATE POLICY "Managers delete kasbon"
ON public.rider_kasbon FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() IN ('ho_admin','branch_manager','sb_branch_manager','finance','ho_owner','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','3_SB_Branch_Manager')
);

CREATE TRIGGER update_rider_kasbon_updated_at
BEFORE UPDATE ON public.rider_kasbon
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
