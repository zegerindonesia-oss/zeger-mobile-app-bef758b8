UPDATE public.tenants SET plan = CASE plan WHEN 'starter' THEN 'sme' WHEN 'pro' THEN 'mid_market' ELSE plan END WHERE plan IN ('starter','pro');
ALTER TABLE public.tenants ALTER COLUMN plan SET DEFAULT 'free';

CREATE OR REPLACE FUNCTION public.plan_modules(_plan text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'free' THEN ARRAY['pos']
    WHEN 'sme' THEN ARRAY['pos','bom']
    WHEN 'mid_market' THEN ARRAY['pos','table','kds','queue','bom','voice','loyalty','invoice','finance']
    WHEN 'enterprise' THEN ARRAY['pos','table','kds','queue','bom','voice','loyalty','invoice','finance','rider','customer_app']
    ELSE ARRAY['pos'] END
$$;

CREATE OR REPLACE FUNCTION public.provision_tenant(
  _company_name text, _business_type text, _plan text, _modules text[],
  _outlet_name text, _city text, _phone text, _menu_template text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tid uuid; _slug text; _pfx text; _bid uuid;
  _menu jsonb; _p text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(trim(coalesce(_company_name,''))) < 2 OR length(_company_name) > 120 THEN RAISE EXCEPTION 'invalid company name'; END IF;

  SELECT t.id INTO _tid FROM tenants t WHERE t.owner_user_id = _uid AND NOT t.is_platform_owner LIMIT 1;
  IF _tid IS NOT NULL THEN RETURN _tid; END IF;

  _p := CASE _plan WHEN 'starter' THEN 'sme' WHEN 'pro' THEN 'mid_market' ELSE _plan END;
  IF _p NOT IN ('free','sme','mid_market','enterprise') THEN _p := 'mid_market'; END IF;

  _slug := trim(both '-' from regexp_replace(lower(_company_name), '[^a-z0-9]+', '-', 'g'));
  IF _slug = '' THEN _slug := 'brand'; END IF;
  _slug := _slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,5);
  _pfx := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  INSERT INTO tenants (slug, name, business_type, plan, subscription_status, trial_ends_at, modules, owner_user_id, config)
  VALUES (_slug, trim(_company_name), coalesce(_business_type,'coffee_shop'), _p,
    CASE WHEN _p = 'free' THEN 'active' ELSE 'trial' END,
    CASE WHEN _p = 'free' THEN NULL ELSE now() + interval '14 days' END,
    public.plan_modules(_p),
    _uid, jsonb_build_object('phone', _phone, 'city', _city))
  RETURNING id INTO _tid;

  INSERT INTO tenant_users (tenant_id, user_id, role_code) VALUES (_tid, _uid, 'owner');

  INSERT INTO branches (name, code, address, phone, is_active, tenant_id)
  VALUES (coalesce(nullif(trim(_outlet_name),''), trim(_company_name)), 'T' || _pfx || '-01', _city, _phone, true, _tid)
  RETURNING id INTO _bid;

  _menu := CASE _menu_template
    WHEN 'coffee' THEN '[["Espresso","Coffee",18000],["Americano","Coffee",22000],["Cafe Latte","Coffee",28000],["Kopi Susu Aren","Coffee",25000],["Matcha Latte","Non-Coffee",30000],["Chocolate","Non-Coffee",27000],["Croissant","Snack",22000],["French Fries","Snack",20000]]'
    WHEN 'resto' THEN '[["Nasi Goreng Spesial","Makanan",35000],["Mie Goreng","Makanan",32000],["Ayam Bakar","Makanan",40000],["Sop Buntut","Makanan",65000],["Es Teh Manis","Minuman",8000],["Jus Jeruk","Minuman",18000],["Pisang Goreng","Dessert",15000],["Es Campur","Dessert",20000]]'
    WHEN 'bakery' THEN '[["Roti Tawar","Roti",18000],["Roti Sobek Coklat","Roti",22000],["Croissant Butter","Pastry",20000],["Danish Keju","Pastry",22000],["Brownies","Cake",30000],["Cheesecake Slice","Cake",35000],["Kopi Hitam","Minuman",15000],["Teh Susu","Minuman",15000]]'
    ELSE '[]' END::jsonb;

  INSERT INTO products (name, code, category, price, is_active, tenant_id)
  SELECT e->>0, 'T' || _pfx || '-' || lpad(ord::text, 3, '0'), e->>1, (e->>2)::numeric, true, _tid
  FROM jsonb_array_elements(_menu) WITH ORDINALITY AS x(e, ord);

  RETURN _tid;
END $$;

REVOKE EXECUTE ON FUNCTION public.provision_tenant(text,text,text,text[],text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_tenant(text,text,text,text[],text,text,text,text) TO authenticated;