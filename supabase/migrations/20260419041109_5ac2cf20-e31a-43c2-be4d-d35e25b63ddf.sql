
-- ============ POS PROMOTIONS ============
CREATE TABLE public.pos_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  promo_type text NOT NULL CHECK (promo_type IN ('percentage', 'fixed', 'free_item', 'happy_hour')),
  scope text NOT NULL DEFAULT 'bill' CHECK (scope IN ('item', 'bill')),
  value numeric NOT NULL DEFAULT 0,
  min_purchase numeric NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  hour_start integer,
  hour_end integer,
  applicable_branch_ids uuid[] DEFAULT '{}',
  applicable_product_ids uuid[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HO can manage pos_promotions"
  ON public.pos_promotions FOR ALL
  USING (has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role))
  WITH CHECK (has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role));

CREATE POLICY "Authenticated can view active promotions"
  ON public.pos_promotions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_pos_promotions_updated_at
  BEFORE UPDATE ON public.pos_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POS VOUCHERS ============
CREATE TABLE public.pos_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  promotion_id uuid REFERENCES public.pos_promotions(id) ON DELETE CASCADE,
  customer_id uuid,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  used_by_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HO can manage pos_vouchers"
  ON public.pos_vouchers FOR ALL
  USING (has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role))
  WITH CHECK (has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role));

CREATE POLICY "Authenticated can view vouchers"
  ON public.pos_vouchers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Kasir can mark voucher used"
  ON public.pos_vouchers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============ POS BUNDLES ============
CREATE TABLE public.pos_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url text,
  applicable_branch_ids uuid[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HO can manage pos_bundles"
  ON public.pos_bundles FOR ALL
  USING (has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role))
  WITH CHECK (has_role('ho_admin'::user_role) OR has_role('1_HO_Admin'::user_role) OR has_role('1_HO_Owner'::user_role));

CREATE POLICY "Authenticated can view active bundles"
  ON public.pos_bundles FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_pos_bundles_updated_at
  BEFORE UPDATE ON public.pos_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ BRANCHES TAX & SERVICE SETTINGS ============
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS pos_tax_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_service_charge_percent numeric NOT NULL DEFAULT 0;

-- ============ POS TRANSACTIONS PARENT REF (split bill) ============
ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS parent_transaction_id uuid REFERENCES public.pos_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_transactions_parent ON public.pos_transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_vouchers_code ON public.pos_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_pos_promotions_active ON public.pos_promotions(is_active) WHERE is_active = true;
