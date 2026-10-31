CREATE OR REPLACE FUNCTION public.manager_branch_scope(_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _branch IS NOT NULL AND (
    _branch = get_current_user_branch()
    OR EXISTS (SELECT 1 FROM branches b WHERE b.id = _branch AND b.parent_branch_id = get_current_user_branch())
  );
$$;

DROP POLICY IF EXISTS "Hub managers move staff within their branches" ON public.profiles;
CREATE POLICY "Hub managers move staff within their branches"
ON public.profiles FOR UPDATE TO authenticated
USING (
  get_current_user_role()::text IN ('branch_manager','2_Hub_Branch_Manager')
  AND public.manager_branch_scope(branch_id)
)
WITH CHECK (
  get_current_user_role()::text IN ('branch_manager','2_Hub_Branch_Manager')
  AND public.manager_branch_scope(branch_id)
  AND role::text NOT IN ('ho_admin','ho_owner','ho_staff','1_HO_Admin','1_HO_Owner','1_HO_Staff')
);

DROP POLICY IF EXISTS "Hub managers view staff in their branches" ON public.profiles;
CREATE POLICY "Hub managers view staff in their branches"
ON public.profiles FOR SELECT TO authenticated
USING (
  get_current_user_role()::text IN ('branch_manager','2_Hub_Branch_Manager')
  AND public.manager_branch_scope(branch_id)
);