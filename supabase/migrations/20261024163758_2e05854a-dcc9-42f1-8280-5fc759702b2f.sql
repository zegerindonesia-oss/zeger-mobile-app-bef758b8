CREATE OR REPLACE FUNCTION public.get_customer_category_order()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT setting_value FROM public.app_settings WHERE setting_key = 'customer_menu.category_order' AND setting_type = 'customer_app' AND is_active = true AND jsonb_typeof(setting_value) = 'array' LIMIT 1), '[]'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.get_customer_category_order() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_category_order() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_customer_category_order() IS 'Public display-only category order; no other app settings or customer data exposed.';