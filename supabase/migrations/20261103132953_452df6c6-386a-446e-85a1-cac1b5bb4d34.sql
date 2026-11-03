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
    SELECT t.customer_id, t.final_amount::numeric, coalesce(t.transaction_date, t.created_at) FROM transactions t
      WHERE t.customer_id IS NOT NULL AND coalesce(t.is_voided,false) = false
  ), agg AS (
    SELECT tx.cid, count(*) c, sum(tx.amt) s, max(tx.at) l, sum(tx.amt) FILTER (WHERE tx.at > now() - interval '30 days') s30 FROM tx GROUP BY tx.cid
  )
  SELECT cu.id, cu.name::text, cu.phone::text, cu.email::text, cu.address::text, cu.birthday, cu.gender, cu.member_code::text, coalesce(cu.points,0)::int,
    cu.branch_id, b.name::text, cu.registered_by_name, cu.source_channel, cu.notes, cu.is_active, cu.created_at,
    coalesce(a.c,0), coalesce(a.s,0), a.l, coalesce(a.s30,0)
  FROM customer_users cu LEFT JOIN branches b ON b.id = cu.branch_id LEFT JOIN agg a ON a.cid = cu.id
  WHERE cu.role = 'customer' AND cu.tenant_id = public.current_tenant_id();
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_customer_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_customer_list() TO authenticated;