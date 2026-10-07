CREATE OR REPLACE FUNCTION public.has_procurement_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_material_manager() OR EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.module_name = 'procurement' AND ump.is_granted = true
      AND (ump.user_id = auth.uid() OR ump.user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
$$;

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.tenants(id),
  name text NOT NULL, contact_name text, phone text, address text,
  default_terms_days integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Procurement suppliers" ON public.suppliers FOR ALL TO authenticated
USING (has_procurement_access()) WITH CHECK (has_procurement_access());

CREATE TABLE public.material_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  factor numeric NOT NULL DEFAULT 1,
  use_for_purchase boolean NOT NULL DEFAULT true,
  use_for_opname boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, unit_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_units TO authenticated;
GRANT ALL ON public.material_units TO service_role;
ALTER TABLE public.material_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view units" ON public.material_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers edit units" ON public.material_units FOR ALL TO authenticated
USING (is_material_manager()) WITH CHECK (is_material_manager());

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.tenants(id),
  po_number text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  status text NOT NULL DEFAULT 'ordered',
  order_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  expected_date date,
  received_at timestamptz,
  invoice_number text, invoice_date date,
  terms_days integer NOT NULL DEFAULT 0,
  due_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Procurement PO" ON public.purchase_orders FOR ALL TO authenticated
USING (has_procurement_access() AND (is_ho_user() OR branch_id = get_current_user_branch()))
WITH CHECK (has_procurement_access() AND (is_ho_user() OR branch_id = get_current_user_branch()));

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit_name text NOT NULL,
  factor numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  received_quantity numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Procurement PO items" ON public.purchase_order_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM purchase_orders p WHERE p.id = po_id))
WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders p WHERE p.id = po_id));

CREATE TABLE public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  method text NOT NULL DEFAULT 'transfer',
  notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_payments TO authenticated;
GRANT ALL ON public.purchase_payments TO service_role;
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Procurement payments" ON public.purchase_payments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM purchase_orders p WHERE p.id = po_id))
WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders p WHERE p.id = po_id));

CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid, _items jsonb, _invoice_number text, _invoice_date date, _terms_days integer)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po record; it record; rq numeric; total numeric := 0;
BEGIN
  SELECT * INTO po FROM purchase_orders WHERE id = _po_id FOR UPDATE;
  IF po IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF NOT (has_procurement_access() AND (is_ho_user() OR po.branch_id = get_current_user_branch())) THEN
    RAISE EXCEPTION 'Tidak punya akses'; END IF;
  IF po.status <> 'ordered' THEN RAISE EXCEPTION 'PO sudah diproses'; END IF;
  FOR it IN SELECT * FROM purchase_order_items WHERE po_id = _po_id LOOP
    rq := COALESCE((SELECT (x->>'received_quantity')::numeric FROM jsonb_array_elements(_items) x WHERE x->>'id' = it.id::text), it.quantity);
    UPDATE purchase_order_items SET received_quantity = rq WHERE id = it.id;
    total := total + rq * it.unit_price;
    IF rq > 0 THEN
      PERFORM record_material_movement(po.branch_id, it.material_id, 'in', rq * it.factor,
        CASE WHEN it.factor > 0 THEN it.unit_price / it.factor END, 'purchase', po.po_number, 'Penerimaan ' || po.po_number);
    END IF;
  END LOOP;
  UPDATE purchase_orders SET status = 'received', received_at = now(), invoice_number = _invoice_number,
    invoice_date = COALESCE(_invoice_date, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    terms_days = COALESCE(_terms_days, 0),
    due_date = COALESCE(_invoice_date, (now() AT TIME ZONE 'Asia/Jakarta')::date) + COALESCE(_terms_days, 0),
    total_amount = total, updated_at = now()
  WHERE id = _po_id;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.sync_po_paid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := COALESCE(NEW.po_id, OLD.po_id);
BEGIN
  UPDATE purchase_orders SET paid_amount = COALESCE((SELECT sum(amount) FROM purchase_payments WHERE po_id = pid), 0), updated_at = now() WHERE id = pid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_sync_po_paid AFTER INSERT OR UPDATE OR DELETE ON public.purchase_payments FOR EACH ROW EXECUTE FUNCTION public.sync_po_paid();