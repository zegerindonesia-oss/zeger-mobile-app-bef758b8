CREATE TABLE public.bank_statement_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  txn_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  reference text,
  direction text NOT NULL DEFAULT 'out',
  amount numeric NOT NULL DEFAULT 0,
  balance numeric,
  bank_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE SET NULL,
  category_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE SET NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'draft',
  journal_id uuid REFERENCES public.accounting_journals(id) ON DELETE SET NULL,
  batch_name text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_transactions TO authenticated;
GRANT ALL ON public.bank_statement_transactions TO service_role;
ALTER TABLE public.bank_statement_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounting users manage bank statements" ON public.bank_statement_transactions
  FOR ALL TO authenticated USING (public.has_procurement_access()) WITH CHECK (public.has_procurement_access());
CREATE INDEX idx_bank_stmt_date ON public.bank_statement_transactions(txn_date);
CREATE TRIGGER trg_bank_stmt_updated BEFORE UPDATE ON public.bank_statement_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.post_bank_statements(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r record; n int := 0; j uuid;
BEGIN
  IF NOT public.has_procurement_access() THEN RAISE EXCEPTION 'Tidak punya akses'; END IF;
  FOR r IN SELECT * FROM bank_statement_transactions WHERE id = ANY(_ids) AND status <> 'posted'
    AND bank_account_id IS NOT NULL AND category_account_id IS NOT NULL AND amount > 0 LOOP
    j := public.create_accounting_journal(r.txn_date, r.description, coalesce(r.reference, 'Mutasi Bank'), r.branch_id,
      CASE WHEN r.direction = 'in' THEN jsonb_build_array(
        jsonb_build_object('account_id', r.bank_account_id, 'debit', r.amount, 'credit', 0),
        jsonb_build_object('account_id', r.category_account_id, 'debit', 0, 'credit', r.amount))
      ELSE jsonb_build_array(
        jsonb_build_object('account_id', r.category_account_id, 'debit', r.amount, 'credit', 0),
        jsonb_build_object('account_id', r.bank_account_id, 'debit', 0, 'credit', r.amount)) END);
    UPDATE accounting_journals SET source = 'bank', source_key = 'bank:' || r.id WHERE id = j;
    UPDATE bank_statement_transactions SET status = 'posted', journal_id = j WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;