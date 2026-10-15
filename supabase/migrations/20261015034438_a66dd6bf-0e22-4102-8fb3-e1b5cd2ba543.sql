CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role::text <> 'customer');
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff_user() FROM anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('product_recipes','Staff view recipes'),
    ('product_price_history','Allow read price history'),
    ('pos_branch_settings','Staff read branch POS settings'),
    ('raw_materials','Staff view materials'),
    ('material_units','Staff view units'),
    ('wip_components','Staff read wip components')) v(t,p)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.p, r.t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_staff_user())', r.p, r.t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated users can view rider locations" ON public.rider_locations;
CREATE POLICY "Staff, self or customers with active order view rider locations"
ON public.rider_locations FOR SELECT TO authenticated
USING (
  public.is_staff_user()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = rider_locations.rider_id AND p.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.customer_orders o
    JOIN public.customer_users cu ON cu.id = o.user_id
    LEFT JOIN public.customer_users rcu ON rcu.id = o.rider_id
    JOIN public.profiles rp ON rp.id = rider_locations.rider_id
    WHERE cu.user_id = auth.uid()
      AND o.status NOT IN ('completed','delivered','cancelled')
      AND (o.rider_id = rider_locations.rider_id OR rcu.user_id = rp.user_id)
  )
);

REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;