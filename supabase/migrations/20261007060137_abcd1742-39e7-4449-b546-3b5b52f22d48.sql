CREATE TABLE public.pos_branch_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  order_modes text[] NOT NULL DEFAULT ARRAY['dine_in','take_away','gofood','grabfood','shopeefood'],
  hidden_product_ids uuid[] NOT NULL DEFAULT '{}',
  cash_in_categories text[] NOT NULL DEFAULT ARRAY['Modal Tambahan','Tukar Uang Kecil','Pendapatan Lain','Lain-lain'],
  cash_out_categories text[] NOT NULL DEFAULT ARRAY['Belanja Bahan Darurat','Operasional & Kebersihan','Kasbon Staf','Setor ke Brankas','Lain-lain'],
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_branch_settings TO authenticated;
GRANT ALL ON public.pos_branch_settings TO service_role;
ALTER TABLE public.pos_branch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read branch POS settings" ON public.pos_branch_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "HO or branch manager manage POS settings" ON public.pos_branch_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND COALESCE(p.is_active,true) AND (
  p.role::text = ANY (ARRAY['ho_admin','ho_owner','1_HO_Admin','1_HO_Owner'])
  OR (p.branch_id = pos_branch_settings.branch_id AND p.role::text = ANY (ARRAY['branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager'])))))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND COALESCE(p.is_active,true) AND (
  p.role::text = ANY (ARRAY['ho_admin','ho_owner','1_HO_Admin','1_HO_Owner'])
  OR (p.branch_id = pos_branch_settings.branch_id AND p.role::text = ANY (ARRAY['branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager'])))));
CREATE TRIGGER pos_branch_settings_updated_at BEFORE UPDATE ON public.pos_branch_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.pos_cash_movements ADD COLUMN IF NOT EXISTS category text;