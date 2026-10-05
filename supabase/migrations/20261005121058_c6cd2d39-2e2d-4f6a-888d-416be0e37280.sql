REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;