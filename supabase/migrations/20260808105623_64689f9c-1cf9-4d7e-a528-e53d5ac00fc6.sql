DROP POLICY IF EXISTS "HO can manage loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Managers can manage loyalty rewards" ON public.loyalty_rewards
FOR ALL TO authenticated
USING (
  has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role)
  OR has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role)
  OR has_role('sb_branch_manager'::user_role) OR has_role('3_SB_Branch_Manager'::user_role)
)
WITH CHECK (
  has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role)
  OR has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role)
  OR has_role('sb_branch_manager'::user_role) OR has_role('3_SB_Branch_Manager'::user_role)
);

DROP POLICY IF EXISTS "HO can manage loyalty tiers" ON public.loyalty_tiers;
CREATE POLICY "Managers can manage loyalty tiers" ON public.loyalty_tiers
FOR ALL TO authenticated
USING (
  has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role)
  OR has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role)
  OR has_role('sb_branch_manager'::user_role) OR has_role('3_SB_Branch_Manager'::user_role)
)
WITH CHECK (
  has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role)
  OR has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role)
  OR has_role('sb_branch_manager'::user_role) OR has_role('3_SB_Branch_Manager'::user_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_tiers TO authenticated;
GRANT ALL ON public.loyalty_rewards TO service_role;
GRANT ALL ON public.loyalty_tiers TO service_role;