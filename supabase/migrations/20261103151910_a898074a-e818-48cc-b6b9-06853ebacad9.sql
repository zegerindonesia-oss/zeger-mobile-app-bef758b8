ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES public.customer_users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_rider_customer_to_crm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; cid uuid; rname text;
BEGIN
  p := regexp_replace(coalesce(NEW.phone,''), '\D', '', 'g');
  IF p LIKE '0%' THEN p := '62' || substr(p, 2); END IF;
  IF length(p) >= 9 THEN
    SELECT id INTO cid FROM customer_users WHERE phone IN (p, '0'||substr(p,3), '+'||p) LIMIT 1;
  END IF;
  IF cid IS NULL AND NEW.customer_user_id IS NOT NULL THEN cid := NEW.customer_user_id; END IF;
  SELECT full_name INTO rname FROM profiles WHERE id = NEW.rider_id;
  IF cid IS NULL THEN
    INSERT INTO customer_users(name, phone, address, role, member_code, branch_id, registered_by_name, source_channel, created_at)
    VALUES (NEW.name, nullif(p,''), NEW.address, 'customer', CASE WHEN length(p)>=8 THEN 'ZM'||right(p,8) END,
      NEW.branch_id, rname, 'rider', NEW.created_at)
    RETURNING id INTO cid;
  ELSE
    UPDATE customer_users SET
      branch_id = coalesce(branch_id, NEW.branch_id),
      registered_by_name = coalesce(registered_by_name, rname),
      address = coalesce(address, NEW.address)
    WHERE id = cid;
  END IF;
  NEW.customer_user_id := cid;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_rider_customer_to_crm() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_rider_customer_to_crm ON public.customers;
CREATE TRIGGER trg_sync_rider_customer_to_crm BEFORE INSERT OR UPDATE OF name, phone, address ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.sync_rider_customer_to_crm();

-- Backfill existing rider customers
UPDATE public.customers SET name = name WHERE customer_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.crm_customer_list()
RETURNS TABLE(id uuid, name text, phone text, email text, address text, birthday date, gender text, member_code text, points int,
  branch_id uuid, branch_name text, registered_by_name text, source_channel text, notes text, is_active boolean, created_at timestamptz,
  order_count bigint, total_spent numeric, last_order_at timestamptz, spent_30d numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.crm_can_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH tx AS (
    SELECT pt.member_id AS cid, pt.total::numeric AS amt, pt.created_at AS at FROM pos_transactions pt
      WHERE pt.member_id IS NOT NULL AND pt.status = 'paid' AND pt.void_at IS NULL
    UNION ALL
    SELECT co.user_id, co.total_price::numeric, co.created_at FROM customer_orders co
      WHERE co.user_id IS NOT NULL AND co.status IN ('delivered','completed','paid','ready','accepted','in_delivery')
    UNION ALL
    SELECT c.customer_user_id, t.final_amount::numeric, coalesce(t.transaction_date, t.created_at) FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      WHERE c.customer_user_id IS NOT NULL AND coalesce(t.is_voided,false) = false
  ), agg AS (
    SELECT tx.cid, count(*) c, sum(tx.amt) s, max(tx.at) l, sum(tx.amt) FILTER (WHERE tx.at > now() - interval '30 days') s30 FROM tx GROUP BY tx.cid
  )
  SELECT cu.id, cu.name::text, cu.phone::text, cu.email::text, cu.address::text, cu.birthday, cu.gender, cu.member_code::text, coalesce(cu.points,0)::int,
    cu.branch_id, b.name::text, cu.registered_by_name, cu.source_channel, cu.notes, cu.is_active, cu.created_at,
    coalesce(a.c,0), coalesce(a.s,0), a.l, coalesce(a.s30,0)
  FROM customer_users cu LEFT JOIN branches b ON b.id = cu.branch_id LEFT JOIN agg a ON a.cid = cu.id
  WHERE cu.role = 'customer' AND cu.tenant_id = public.current_tenant_id();
END $$;

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
  FROM transactions t JOIN customers c ON c.id = t.customer_id LEFT JOIN branches b ON b.id = t.branch_id
  WHERE c.customer_user_id = _customer AND coalesce(t.is_voided,false) = false
  ORDER BY 3 DESC LIMIT 300;
END $$;