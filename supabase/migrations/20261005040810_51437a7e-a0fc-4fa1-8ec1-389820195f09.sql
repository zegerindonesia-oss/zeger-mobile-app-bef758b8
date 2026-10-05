REVOKE EXECUTE ON FUNCTION public.is_material_manager() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ho_user() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_material_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ho_user() TO authenticated;