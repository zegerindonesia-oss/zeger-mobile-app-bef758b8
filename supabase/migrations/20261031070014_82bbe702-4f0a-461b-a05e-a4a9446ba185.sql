REVOKE EXECUTE ON FUNCTION public.manager_branch_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_branch_scope(uuid) TO authenticated;