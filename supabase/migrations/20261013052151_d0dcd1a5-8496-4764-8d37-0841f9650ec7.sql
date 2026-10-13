CREATE TABLE public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  parent_id uuid REFERENCES public.accounting_accounts(id) ON DELETE SET NULL,
  normal_balance text NOT NULL DEFAULT 'debit',
  opening_balance numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_accounts TO authenticated;
GRANT ALL ON public.accounting_accounts TO service_role;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounting access accounts" ON public.accounting_accounts FOR ALL TO authenticated
  USING (public.has_procurement_access()) WITH CHECK (public.has_procurement_access());

CREATE TABLE public.accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  journal_number text NOT NULL,
  journal_date date NOT NULL DEFAULT current_date,
  description text,
  reference text,
  branch_id uuid,
  status text NOT NULL DEFAULT 'posted',
  total_amount numeric NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_journals TO authenticated;
GRANT ALL ON public.accounting_journals TO service_role;
ALTER TABLE public.accounting_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounting access journals" ON public.accounting_journals FOR ALL TO authenticated
  USING (public.has_procurement_access()) WITH CHECK (public.has_procurement_access());

CREATE TABLE public.accounting_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.accounting_journals(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounting_accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_journal_lines TO authenticated;
GRANT ALL ON public.accounting_journal_lines TO service_role;
ALTER TABLE public.accounting_journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounting access lines" ON public.accounting_journal_lines FOR ALL TO authenticated
  USING (public.has_procurement_access()) WITH CHECK (public.has_procurement_access());

CREATE INDEX idx_acc_lines_account ON public.accounting_journal_lines(account_id);
CREATE INDEX idx_acc_lines_journal ON public.accounting_journal_lines(journal_id);
CREATE INDEX idx_acc_journals_date ON public.accounting_journals(tenant_id, journal_date);

CREATE TRIGGER trg_acc_accounts_updated BEFORE UPDATE ON public.accounting_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acc_journals_updated BEFORE UPDATE ON public.accounting_journals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic balanced journal creation
CREATE OR REPLACE FUNCTION public.create_accounting_journal(_date date, _description text, _reference text, _branch_id uuid, _lines jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _d numeric; _c numeric; _num text; _n int;
BEGIN
  IF NOT public.has_procurement_access() THEN RAISE EXCEPTION 'Tidak punya akses'; END IF;
  SELECT coalesce(sum((l->>'debit')::numeric),0), coalesce(sum((l->>'credit')::numeric),0) INTO _d,_c FROM jsonb_array_elements(_lines) l;
  IF _d <= 0 OR _d <> _c THEN RAISE EXCEPTION 'Jurnal tidak seimbang (debit % / kredit %)', _d, _c; END IF;
  SELECT count(*)+1 INTO _n FROM accounting_journals WHERE to_char(journal_date,'YYYYMM') = to_char(_date,'YYYYMM');
  _num := 'JV-' || to_char(_date,'YYYYMM') || '-' || lpad(_n::text,4,'0');
  INSERT INTO accounting_journals(journal_number, journal_date, description, reference, branch_id, total_amount)
  VALUES (_num, _date, _description, _reference, _branch_id, _d) RETURNING id INTO _id;
  INSERT INTO accounting_journal_lines(journal_id, account_id, debit, credit, memo)
  SELECT _id, (l->>'account_id')::uuid, coalesce((l->>'debit')::numeric,0), coalesce((l->>'credit')::numeric,0), l->>'memo'
  FROM jsonb_array_elements(_lines) l;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_accounting_journal(date,text,text,uuid,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_accounting_journal(date,text,text,uuid,jsonb) TO authenticated;

-- Seed standard F&B chart of accounts
WITH h(code,name,t,nb) AS (VALUES
 ('1-0000','ASET','asset','debit'),('2-0000','LIABILITAS','liability','credit'),('3-0000','EKUITAS','equity','credit'),
 ('4-0000','PENDAPATAN','revenue','credit'),('5-0000','HARGA POKOK PENJUALAN','cogs','debit'),
 ('6-0000','BEBAN OPERASIONAL','expense','debit'),('7-0000','PENDAPATAN & BEBAN LAIN','other','debit'))
INSERT INTO public.accounting_accounts(code,name,account_type,normal_balance) SELECT code,name,t,nb FROM h;
WITH c(code,name,parent) AS (VALUES
 ('1-1001','Kas Kasir','1-0000'),('1-1002','Kas Rider','1-0000'),('1-1101','Bank','1-0000'),('1-1102','Saldo QRIS','1-0000'),
 ('1-1201','Piutang Usaha','1-0000'),('1-1301','Persediaan Bahan Baku','1-0000'),('1-1302','Persediaan WIP','1-0000'),('1-1303','Persediaan Packaging','1-0000'),
 ('1-2001','Peralatan & Mesin','1-0000'),('1-2002','Akumulasi Penyusutan','1-0000'),
 ('2-1001','Hutang Usaha (Supplier)','2-0000'),('2-1002','Hutang Gaji','2-0000'),('2-1003','Hutang Pajak PB1/PPN','2-0000'),
 ('3-1001','Modal Pemilik','3-0000'),('3-1002','Laba Ditahan','3-0000'),('3-1003','Prive','3-0000'),
 ('4-1001','Penjualan Outlet','4-0000'),('4-1002','Penjualan Rider/Street','4-0000'),('4-1003','Penjualan Online/Delivery','4-0000'),('4-1004','Penjualan B2B','4-0000'),('4-1005','Diskon Penjualan','4-0000'),
 ('5-1001','Pemakaian Bahan Baku','5-0000'),('5-1002','Pemakaian Packaging','5-0000'),('5-1003','Waste / Bahan Rusak','5-0000'),
 ('6-1001','Gaji & Upah','6-0000'),('6-1002','Komisi Rider','6-0000'),('6-1003','Sewa Tempat','6-0000'),('6-1004','Listrik, Air & Internet','6-0000'),
 ('6-1005','Beban Operasional Harian','6-0000'),('6-1006','Bensin & Transportasi','6-0000'),('6-1007','Marketing & Promosi','6-0000'),('6-1008','Perawatan & Perbaikan','6-0000'),('6-1009','Penyusutan','6-0000'),
 ('7-1001','Biaya MDR QRIS','7-0000'),('7-1002','Biaya Admin Bank','7-0000'),('7-1003','Pendapatan Lain-lain','7-0000'))
INSERT INTO public.accounting_accounts(code,name,account_type,normal_balance,parent_id)
SELECT c.code,c.name,p.account_type,p.normal_balance,p.id FROM c JOIN public.accounting_accounts p ON p.code=c.parent;