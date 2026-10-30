DROP POLICY IF EXISTS "Branch managers can create small branches" ON public.branches;
DROP POLICY IF EXISTS "Branch managers can manage small branches" ON public.branches;

CREATE POLICY "Branch managers can create small branches" ON public.branches FOR INSERT TO authenticated
WITH CHECK (
  (has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role))
  AND branch_type IN ('small','street')
  AND parent_branch_id = get_current_user_branch()
  AND level = 3
);

CREATE POLICY "Branch managers can manage small branches" ON public.branches FOR ALL TO authenticated
USING (
  (has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role))
  AND branch_type IN ('small','street')
  AND parent_branch_id = get_current_user_branch()
)
WITH CHECK (
  (has_role('branch_manager'::user_role) OR has_role('2_Hub_Branch_Manager'::user_role))
  AND branch_type IN ('small','street')
  AND parent_branch_id = get_current_user_branch()
);

DROP POLICY IF EXISTS "HO owner can manage branches" ON public.branches;
CREATE POLICY "HO owner can manage branches" ON public.branches FOR ALL TO authenticated
USING (has_role('ho_owner'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role))
WITH CHECK (has_role('ho_owner'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role));