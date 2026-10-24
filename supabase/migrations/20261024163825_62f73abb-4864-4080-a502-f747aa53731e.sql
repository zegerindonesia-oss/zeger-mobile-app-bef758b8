GRANT SELECT (setting_key, setting_value, setting_type, is_active) ON public.app_settings TO anon;
CREATE POLICY "Guest read customer category display order" ON public.app_settings FOR SELECT TO anon USING (setting_key = 'customer_menu.category_order' AND setting_type = 'customer_app' AND is_active = true);
ALTER FUNCTION public.get_customer_category_order() SECURITY INVOKER;
COMMENT ON FUNCTION public.get_customer_category_order() IS 'Public display-only category order via RLS, without elevated privileges.';