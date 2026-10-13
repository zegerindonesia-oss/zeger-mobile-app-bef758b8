CREATE OR REPLACE FUNCTION public.sync_accounting_inventory(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r record; jid uuid; key text; n_cogs int := 0; n_po int := 0;
  a_cogs uuid; a_inv uuid; a_ap uuid; t uuid := current_tenant_id();
BEGIN
  IF NOT has_procurement_access() THEN RAISE EXCEPTION 'Tidak punya akses accounting'; END IF;
  SELECT id INTO a_cogs FROM accounting_accounts WHERE code='5-1001' AND tenant_id=t;
  SELECT id INTO a_inv FROM accounting_accounts WHERE code='1-1301' AND tenant_id=t;
  SELECT id INTO a_ap FROM accounting_accounts WHERE code='2-1001' AND tenant_id=t;
  IF a_cogs IS NULL OR a_inv IS NULL OR a_ap IS NULL THEN RAISE EXCEPTION 'Akun 5-1001, 1-1301, 2-1001 belum ada'; END IF;

  FOR r IN
    WITH unit_cost AS (
      SELECT p.id product_id,
        COALESCE(NULLIF((SELECT sum(pr.quantity * coalesce(m.cost_per_unit,0)) FROM product_recipes pr JOIN raw_materials m ON m.id=pr.material_id WHERE pr.product_id=p.id),0), p.cost_price, 0) cost
      FROM products p WHERE p.tenant_id=t)
    SELECT (tx.transaction_date AT TIME ZONE 'Asia/Jakarta')::date d, tx.branch_id, sum(ti.quantity * uc.cost) amt
    FROM transactions tx JOIN transaction_items ti ON ti.transaction_id=tx.id JOIN unit_cost uc ON uc.product_id=ti.product_id
    WHERE tx.is_voided=false AND tx.status='completed' AND tx.tenant_id=t
      AND (tx.transaction_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN _from AND _to
    GROUP BY 1,2 HAVING round(sum(ti.quantity * uc.cost)) > 0
  LOOP
    key := 'cogs:'||r.d||':'||coalesce(r.branch_id::text,'none');
    CONTINUE WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE source_key=key AND tenant_id=t AND status<>'void');
    jid := create_accounting_journal(r.d, 'Auto: HPP bahan baku '||coalesce((SELECT name FROM branches WHERE id=r.branch_id),''), key, r.branch_id,
      jsonb_build_array(
        jsonb_build_object('account_id',a_cogs,'debit',round(r.amt),'credit',0,'memo','Pemakaian bahan baku'),
        jsonb_build_object('account_id',a_inv,'debit',0,'credit',round(r.amt),'memo','Persediaan keluar')));
    UPDATE accounting_journals SET source='pos_cogs', source_key=key WHERE id=jid;
    n_cogs := n_cogs+1;
  END LOOP;

  FOR r IN SELECT * FROM purchase_orders po WHERE po.tenant_id=t AND po.received_at IS NOT NULL AND coalesce(po.total_amount,0)>0
     AND (po.received_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN _from AND _to LOOP
    key := 'po:'||r.id;
    CONTINUE WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE source_key=key AND tenant_id=t AND status<>'void');
    jid := create_accounting_journal((r.received_at AT TIME ZONE 'Asia/Jakarta')::date, 'Auto: Pembelian '||coalesce(r.po_number,''), key, r.branch_id,
      jsonb_build_array(
        jsonb_build_object('account_id',a_inv,'debit',r.total_amount,'credit',0,'memo','Bahan masuk'),
        jsonb_build_object('account_id',a_ap,'debit',0,'credit',r.total_amount,'memo','Hutang supplier')));
    UPDATE accounting_journals SET source='purchase', source_key=key WHERE id=jid;
    n_po := n_po+1;
  END LOOP;
  RETURN jsonb_build_object('cogs',n_cogs,'purchase',n_po);
END $$;
REVOKE ALL ON FUNCTION public.sync_accounting_inventory(date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_accounting_inventory(date,date) TO authenticated;