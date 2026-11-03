REVOKE EXECUTE ON FUNCTION public.crm_can_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_can_access() TO authenticated;