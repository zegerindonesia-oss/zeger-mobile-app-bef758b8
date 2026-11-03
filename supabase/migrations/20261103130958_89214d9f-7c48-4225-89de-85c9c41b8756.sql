ALTER TABLE public.customer_users
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registered_by uuid,
  ADD COLUMN IF NOT EXISTS registered_by_name text,
  ADD COLUMN IF NOT EXISTS source_channel text DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.crm_can_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_ho_user() OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()
    AND p.role::text IN ('branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager','finance'));
$$;

DROP FUNCTION IF EXISTS public.pos_quick_member(text, text);
CREATE OR REPLACE FUNCTION public.pos_quick_member(_phone text, _name text DEFAULT NULL, _branch_id uuid DEFAULT NULL, _cashier_name text DEFAULT NULL)
RETURNS TABLE(id uuid, name text, phone text, email text, member_code text, points integer, is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; r record; nm text; br uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  p := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF p LIKE '0%' THEN p := '62' || substr(p, 2); END IF;
  IF length(p) < 9 THEN RAISE EXCEPTION 'nomor tidak valid'; END IF;
  br := coalesce(_branch_id, (SELECT branch_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
  SELECT cu.* INTO r FROM customer_users cu WHERE cu.phone IN (p, '0' || substr(p,3), '+' || p) LIMIT 1;
  IF FOUND THEN
    UPDATE customer_users SET
      name = CASE WHEN _name IS NOT NULL AND trim(_name) <> '' AND (r.name IS NULL OR r.name IN ('Member','Customer')) THEN trim(_name) ELSE customer_users.name END,
      branch_id = coalesce(customer_users.branch_id, br),
      registered_by_name = coalesce(customer_users.registered_by_name, _cashier_name)
    WHERE customer_users.id = r.id;
    RETURN QUERY SELECT r.id, coalesce(nullif(trim(_name),''), r.name)::text, r.phone::text, r.email::text, r.member_code::text, coalesce(r.points,0)::int, false;
    RETURN;
  END IF;
  nm := coalesce(nullif(trim(_name),''), 'Member');
  RETURN QUERY INSERT INTO customer_users(name, phone, role, member_code, branch_id, registered_by, registered_by_name, source_channel)
    VALUES (nm, p, 'customer', 'ZM' || right(p, 8), br, auth.uid(), _cashier_name, 'pos')
    RETURNING customer_users.id, customer_users.name::text, customer_users.phone::text, customer_users.email::text, customer_users.member_code::text, coalesce(customer_users.points,0)::int, true;
END $$;
REVOKE EXECUTE ON FUNCTION public.pos_quick_member(text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_quick_member(text, text, uuid, text) TO authenticated;

-- Omnichannel summary per customer
CREATE OR REPLACE FUNCTION public.crm_customer_list()
RETURNS TABLE(id uuid, name text, phone text, email text, address text, birthday date, gender text, member_code text, points int,
  branch_id uuid, branch_name text, registered_by_name text, source_channel text, notes text, is_active boolean, created_at timestamptz,
  order_count bigint, total_spent numeric, last_order_at timestamptz, spent_30d numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.crm_can_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH tx AS (
    SELECT member_id AS cid, total::numeric AS amt, created_at AS at FROM pos_transactions
      WHERE member_id IS NOT NULL AND status = 'paid' AND void_at IS NULL
    UNION ALL
    SELECT user_id, total_price::numeric, created_at FROM customer_orders
      WHERE user_id IS NOT NULL AND status IN ('delivered','completed','paid','ready','accepted','in_delivery')
    UNION ALL
    SELECT customer_id, final_amount::numeric, coalesce(transaction_date, created_at) FROM transactions
      WHERE customer_id IS NOT NULL AND coalesce(is_voided,false) = false
  ), agg AS (
    SELECT cid, count(*) c, sum(amt) s, max(at) l, sum(amt) FILTER (WHERE at > now() - interval '30 days') s30 FROM tx GROUP BY cid
  )
  SELECT cu.id, cu.name::text, cu.phone::text, cu.email::text, cu.address::text, cu.birthday, cu.gender, cu.member_code::text, coalesce(cu.points,0)::int,
    cu.branch_id, b.name::text, cu.registered_by_name, cu.source_channel, cu.notes, cu.is_active, cu.created_at,
    coalesce(a.c,0), coalesce(a.s,0), a.l, coalesce(a.s30,0)
  FROM customer_users cu LEFT JOIN branches b ON b.id = cu.branch_id LEFT JOIN agg a ON a.cid = cu.id
  WHERE cu.role = 'customer' AND cu.tenant_id = public.current_tenant_id();
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_customer_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_customer_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_customer_history(_customer uuid)
RETURNS TABLE(channel text, ref text, at timestamptz, amount numeric, branch_name text, payment text, items jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.crm_can_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT 'Kasir POS'::text, t.transaction_number::text, t.created_at, t.total::numeric, b.name::text, t.payment_method_1::text,
    coalesce((SELECT jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.qty, 'subtotal', i.subtotal_item)) FROM pos_transaction_items i WHERE i.transaction_id = t.id), '[]'::jsonb)
  FROM pos_transactions t LEFT JOIN branches b ON b.id = t.branch_id
  WHERE t.member_id = _customer AND t.status = 'paid' AND t.void_at IS NULL
  UNION ALL
  SELECT 'Aplikasi'::text, left(o.id::text, 8), o.created_at, o.total_price::numeric, b.name::text, o.payment_method::text,
    coalesce((SELECT jsonb_agg(jsonb_build_object('name', p.name, 'qty', i.quantity, 'subtotal', i.price * i.quantity)) FROM customer_order_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.order_id = o.id), '[]'::jsonb)
  FROM customer_orders o LEFT JOIN branches b ON b.id = o.outlet_id
  WHERE o.user_id = _customer AND o.status NOT IN ('cancelled','rejected')
  UNION ALL
  SELECT 'Rider'::text, t.transaction_number::text, coalesce(t.transaction_date, t.created_at), t.final_amount::numeric, b.name::text, t.payment_method::text,
    coalesce((SELECT jsonb_agg(jsonb_build_object('name', p.name, 'qty', i.quantity, 'subtotal', i.total_price)) FROM transaction_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.transaction_id = t.id), '[]'::jsonb)
  FROM transactions t LEFT JOIN branches b ON b.id = t.branch_id
  WHERE t.customer_id = _customer AND coalesce(t.is_voided,false) = false
  ORDER BY 3 DESC LIMIT 300;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_customer_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_customer_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_upsert_customer(_id uuid, _data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; rid uuid;
BEGIN
  IF NOT public.crm_can_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  p := regexp_replace(coalesce(_data->>'phone',''), '\D', '', 'g');
  IF p LIKE '0%' THEN p := '62' || substr(p, 2); END IF;
  IF _id IS NULL AND length(p) >= 9 THEN SELECT id INTO _id FROM customer_users WHERE phone IN (p, '0'||substr(p,3), '+'||p) LIMIT 1; END IF;
  IF _id IS NULL THEN
    INSERT INTO customer_users(name, phone, email, address, birthday, gender, notes, branch_id, role, member_code, registered_by, registered_by_name, source_channel)
    VALUES (coalesce(nullif(_data->>'name',''),'Member'), nullif(p,''), nullif(_data->>'email',''), nullif(_data->>'address',''),
      nullif(_data->>'birthday','')::date, nullif(_data->>'gender',''), nullif(_data->>'notes',''), nullif(_data->>'branch_id','')::uuid,
      'customer', CASE WHEN length(p)>=8 THEN 'ZM'||right(p,8) END, auth.uid(),
      (SELECT full_name FROM profiles WHERE user_id = auth.uid() LIMIT 1), coalesce(_data->>'source_channel','backoffice'))
    RETURNING id INTO rid;
    RETURN rid;
  END IF;
  UPDATE customer_users SET
    name = coalesce(nullif(_data->>'name',''), name),
    phone = coalesce(nullif(p,''), phone),
    email = CASE WHEN _data ? 'email' THEN nullif(_data->>'email','') ELSE email END,
    address = CASE WHEN _data ? 'address' THEN nullif(_data->>'address','') ELSE address END,
    birthday = CASE WHEN _data ? 'birthday' THEN nullif(_data->>'birthday','')::date ELSE birthday END,
    gender = CASE WHEN _data ? 'gender' THEN nullif(_data->>'gender','') ELSE gender END,
    notes = CASE WHEN _data ? 'notes' THEN nullif(_data->>'notes','') ELSE notes END,
    branch_id = CASE WHEN _data ? 'branch_id' THEN nullif(_data->>'branch_id','')::uuid ELSE branch_id END,
    is_active = coalesce((_data->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_upsert_customer(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_upsert_customer(uuid, jsonb) TO authenticated;