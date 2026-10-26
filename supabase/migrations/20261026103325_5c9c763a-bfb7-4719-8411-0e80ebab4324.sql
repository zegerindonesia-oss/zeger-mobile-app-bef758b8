CREATE POLICY "Managers manage customer category order"
ON public.app_settings FOR ALL TO authenticated
USING (
  setting_key = 'customer_menu.category_order'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()
    AND p.role IN ('ho_admin','ho_owner','branch_manager','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','sb_branch_manager','3_SB_Branch_Manager'))
)
WITH CHECK (
  setting_key = 'customer_menu.category_order'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()
    AND p.role IN ('ho_admin','ho_owner','branch_manager','1_HO_Admin','1_HO_Owner','2_Hub_Branch_Manager','sb_branch_manager','3_SB_Branch_Manager'))
);