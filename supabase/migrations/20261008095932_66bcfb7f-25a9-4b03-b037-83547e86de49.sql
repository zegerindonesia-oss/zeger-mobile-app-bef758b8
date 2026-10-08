ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE public.business_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name text NOT NULL,
  contact_name text, phone text, email text, address text,
  default_terms_days integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_customers TO authenticated;
GRANT ALL ON public.business_customers TO service_role;
ALTER TABLE public.business_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoicing customers" ON public.business_customers FOR ALL TO authenticated
  USING (has_procurement_access()) WITH CHECK (has_procurement_access());

CREATE TABLE public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  doc_number text NOT NULL UNIQUE,
  doc_type text NOT NULL DEFAULT 'invoice',
  branch_id uuid REFERENCES public.branches(id),
  customer_id uuid REFERENCES public.business_customers(id),
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  due_date date,
  event_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_invoices_branch_due ON public.sales_invoices (branch_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoices TO authenticated;
GRANT ALL ON public.sales_invoices TO service_role;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoicing sales invoices" ON public.sales_invoices FOR ALL TO authenticated
  USING (has_procurement_access() AND (is_ho_user() OR branch_id = get_current_user_branch()))
  WITH CHECK (has_procurement_access() AND (is_ho_user() OR branch_id = get_current_user_branch()));

CREATE TABLE public.sales_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_invoice_items_invoice ON public.sales_invoice_items (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoice_items TO authenticated;
GRANT ALL ON public.sales_invoice_items TO service_role;
ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoicing sales items" ON public.sales_invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_invoices i WHERE i.id = invoice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales_invoices i WHERE i.id = invoice_id));

CREATE TRIGGER trg_business_customers_updated BEFORE UPDATE ON public.business_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sales_invoices_updated BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();