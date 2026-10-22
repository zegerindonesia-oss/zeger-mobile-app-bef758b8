CREATE OR REPLACE FUNCTION public.pos_quick_member(_phone text, _name text DEFAULT NULL)
RETURNS TABLE(id uuid, name text, phone text, email text, member_code text, points integer, is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; r record; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  p := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF p LIKE '0%' THEN p := '62' || substr(p, 2); END IF;
  IF length(p) < 9 THEN RAISE EXCEPTION 'nomor tidak valid'; END IF;
  SELECT cu.* INTO r FROM customer_users cu
   WHERE cu.phone IN (p, '0' || substr(p,3), '+' || p) LIMIT 1;
  IF FOUND THEN
    IF _name IS NOT NULL AND trim(_name) <> '' AND (r.name IS NULL OR r.name IN ('Member','Customer')) THEN
      UPDATE customer_users SET name = trim(_name) WHERE customer_users.id = r.id;
    END IF;
    RETURN QUERY SELECT r.id, coalesce(nullif(trim(_name),''), r.name)::text, r.phone::text, r.email::text, r.member_code::text, coalesce(r.points,0)::int, false;
    RETURN;
  END IF;
  nm := coalesce(nullif(trim(_name),''), 'Member');
  RETURN QUERY INSERT INTO customer_users(name, phone, role, member_code)
    VALUES (nm, p, 'customer', 'ZM' || right(p, 8))
    RETURNING customer_users.id, customer_users.name::text, customer_users.phone::text, customer_users.email::text, customer_users.member_code::text, coalesce(customer_users.points,0)::int, true;
END $$;
GRANT EXECUTE ON FUNCTION public.pos_quick_member(text, text) TO authenticated;