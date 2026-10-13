ALTER TABLE public.accounting_journals ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual', ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS accounting_journals_source_key_uq ON public.accounting_journals(tenant_id, source_key) WHERE source_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_accounting_auto(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r record; jid uuid; n_sales int := 0; n_exp int := 0; n_rexp int := 0;
  a_cash uuid; a_rcash uuid; a_qris uuid; a_bank uuid; a_rev_out uuid; a_rev_rider uuid; a_opx uuid; a_fuel uuid; a_rent uuid; a_util uuid; a_mkt uuid; a_maint uuid; a_sal uuid;
  lines jsonb; key text; exp_acc uuid;
BEGIN
  IF NOT has_procurement_access() THEN RAISE EXCEPTION 'Tidak punya akses accounting'; END IF;
  SELECT id INTO a_cash FROM accounting_accounts WHERE code='1-1001' AND tenant_id=current_tenant_id();
  SELECT id INTO a_rcash FROM accounting_accounts WHERE code='1-1002' AND tenant_id=current_tenant_id();
  SELECT id INTO a_bank FROM accounting_accounts WHERE code='1-1101' AND tenant_id=current_tenant_id();
  SELECT id INTO a_qris FROM accounting_accounts WHERE code='1-1102' AND tenant_id=current_tenant_id();
  SELECT id INTO a_rev_out FROM accounting_accounts WHERE code='4-1001' AND tenant_id=current_tenant_id();
  SELECT id INTO a_rev_rider FROM accounting_accounts WHERE code='4-1002' AND tenant_id=current_tenant_id();
  SELECT id INTO a_sal FROM accounting_accounts WHERE code='6-1001' AND tenant_id=current_tenant_id();
  SELECT id INTO a_rent FROM accounting_accounts WHERE code='6-1003' AND tenant_id=current_tenant_id();
  SELECT id INTO a_util FROM accounting_accounts WHERE code='6-1004' AND tenant_id=current_tenant_id();
  SELECT id INTO a_opx FROM accounting_accounts WHERE code='6-1005' AND tenant_id=current_tenant_id();
  SELECT id INTO a_fuel FROM accounting_accounts WHERE code='6-1006' AND tenant_id=current_tenant_id();
  SELECT id INTO a_mkt FROM accounting_accounts WHERE code='6-1007' AND tenant_id=current_tenant_id();
  SELECT id INTO a_maint FROM accounting_accounts WHERE code='6-1008' AND tenant_id=current_tenant_id();
  IF a_cash IS NULL OR a_rev_out IS NULL OR a_opx IS NULL THEN RAISE EXCEPTION 'Akun standar (1-1001, 4-1001, 6-1005) belum ada'; END IF;

  -- Sales: one journal per day + branch + channel
  FOR r IN
    SELECT (t.transaction_date AT TIME ZONE 'Asia/Jakarta')::date d, t.branch_id, (t.rider_id IS NOT NULL) is_rider,
      sum(CASE WHEN lower(coalesce(t.payment_method,'cash')) IN ('cash','tunai') THEN t.final_amount ELSE 0 END) cash,
      sum(CASE WHEN lower(t.payment_method)='qris' THEN t.final_amount ELSE 0 END) qris,
      sum(CASE WHEN lower(coalesce(t.payment_method,'cash')) NOT IN ('cash','tunai','qris') THEN t.final_amount ELSE 0 END) bank,
      sum(t.final_amount) total
    FROM transactions t
    WHERE t.is_voided = false AND t.status = 'completed' AND t.tenant_id = current_tenant_id()
      AND (t.transaction_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN _from AND _to
    GROUP BY 1,2,3 HAVING sum(t.final_amount) > 0
  LOOP
    key := 'sales:'||r.d||':'||coalesce(r.branch_id::text,'none')||':'||CASE WHEN r.is_rider THEN 'rider' ELSE 'outlet' END;
    CONTINUE WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE source_key=key AND tenant_id=current_tenant_id() AND status<>'void');
    lines := '[]'::jsonb;
    IF r.cash>0 THEN lines := lines || jsonb_build_object('account_id', CASE WHEN r.is_rider THEN coalesce(a_rcash,a_cash) ELSE a_cash END,'debit',r.cash,'credit',0,'memo','Penjualan tunai'); END IF;
    IF r.qris>0 THEN lines := lines || jsonb_build_object('account_id', coalesce(a_qris,a_cash),'debit',r.qris,'credit',0,'memo','Penjualan QRIS'); END IF;
    IF r.bank>0 THEN lines := lines || jsonb_build_object('account_id', coalesce(a_bank,a_cash),'debit',r.bank,'credit',0,'memo','Penjualan transfer/lainnya'); END IF;
    lines := lines || jsonb_build_object('account_id', CASE WHEN r.is_rider THEN coalesce(a_rev_rider,a_rev_out) ELSE a_rev_out END,'debit',0,'credit',r.total,'memo','Pendapatan penjualan');
    jid := create_accounting_journal(r.d, 'Auto: Penjualan '||CASE WHEN r.is_rider THEN 'Rider' ELSE 'Outlet' END||' '||coalesce((SELECT name FROM branches WHERE id=r.branch_id),''), key, r.branch_id, lines);
    UPDATE accounting_journals SET source='pos_sales', source_key=key WHERE id=jid;
    n_sales := n_sales+1;
  END LOOP;

  -- Outlet operational expenses
  FOR r IN SELECT * FROM operational_expenses e WHERE e.tenant_id=current_tenant_id() AND e.expense_date BETWEEN _from AND _to AND e.amount>0 LOOP
    key := 'opex:'||r.id;
    CONTINUE WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE source_key=key AND tenant_id=current_tenant_id() AND status<>'void');
    exp_acc := CASE
      WHEN lower(r.expense_category) ~ '(gaji|upah|salary)' THEN coalesce(a_sal,a_opx)
      WHEN lower(r.expense_category) ~ '(sewa|rent)' THEN coalesce(a_rent,a_opx)
      WHEN lower(r.expense_category) ~ '(listrik|air|internet|utilit)' THEN coalesce(a_util,a_opx)
      WHEN lower(r.expense_category) ~ '(bensin|bbm|transport|fuel)' THEN coalesce(a_fuel,a_opx)
      WHEN lower(r.expense_category) ~ '(marketing|promo|iklan)' THEN coalesce(a_mkt,a_opx)
      WHEN lower(r.expense_category) ~ '(perawatan|perbaikan|maint|servis)' THEN coalesce(a_maint,a_opx)
      ELSE a_opx END;
    lines := jsonb_build_array(
      jsonb_build_object('account_id',exp_acc,'debit',r.amount,'credit',0,'memo',coalesce(r.description,r.expense_category)),
      jsonb_build_object('account_id',a_cash,'debit',0,'credit',r.amount,'memo','Kas keluar'));
    jid := create_accounting_journal(r.expense_date, 'Auto: Beban '||coalesce(r.expense_category,'operasional'), key, r.branch_id, lines);
    UPDATE accounting_journals SET source='opex', source_key=key WHERE id=jid;
    n_exp := n_exp+1;
  END LOOP;

  -- Rider daily expenses
  FOR r IN SELECT * FROM daily_operational_expenses e WHERE e.tenant_id=current_tenant_id() AND e.expense_date BETWEEN _from AND _to AND e.amount>0 LOOP
    key := 'rider_opex:'||r.id;
    CONTINUE WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE source_key=key AND tenant_id=current_tenant_id() AND status<>'void');
    exp_acc := CASE WHEN lower(r.expense_type) ~ '(bensin|bbm|transport|fuel|parkir)' THEN coalesce(a_fuel,a_opx) ELSE a_opx END;
    lines := jsonb_build_array(
      jsonb_build_object('account_id',exp_acc,'debit',r.amount,'credit',0,'memo',coalesce(r.description,r.expense_type)),
      jsonb_build_object('account_id',coalesce(a_rcash,a_cash),'debit',0,'credit',r.amount,'memo','Kas rider keluar'));
    jid := create_accounting_journal(r.expense_date, 'Auto: Beban rider '||coalesce(r.expense_type,''), key, NULL, lines);
    UPDATE accounting_journals SET source='rider_opex', source_key=key WHERE id=jid;
    n_rexp := n_rexp+1;
  END LOOP;

  RETURN jsonb_build_object('sales',n_sales,'opex',n_exp,'rider_opex',n_rexp);
END $$;
REVOKE ALL ON FUNCTION public.sync_accounting_auto(date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_accounting_auto(date,date) TO authenticated;