CREATE TABLE public.supplier_item_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.tenants(id),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  alias_key text GENERATED ALWAYS AS (lower(regexp_replace(trim(alias_name), '\s+', ' ', 'g'))) STORED,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  unit_name text,
  factor numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX supplier_item_aliases_uniq ON public.supplier_item_aliases (COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), alias_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_item_aliases TO authenticated;
GRANT ALL ON public.supplier_item_aliases TO service_role;
ALTER TABLE public.supplier_item_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Procurement aliases" ON public.supplier_item_aliases FOR ALL TO authenticated
USING (has_procurement_access()) WITH CHECK (has_procurement_access());
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS invoice_image_path text;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS supplier_item_name text;