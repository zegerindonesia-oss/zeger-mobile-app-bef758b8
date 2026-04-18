-- POS SHIFTS
CREATE TABLE public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  kasir_id UUID NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'pagi',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC NOT NULL DEFAULT 0,
  closing_cash NUMERIC,
  total_cash_in NUMERIC NOT NULL DEFAULT 0,
  total_cash_out NUMERIC NOT NULL DEFAULT 0,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  expected_cash NUMERIC,
  cash_difference NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_shifts_kasir ON public.pos_shifts(kasir_id);
CREATE INDEX idx_pos_shifts_branch ON public.pos_shifts(branch_id);
CREATE INDEX idx_pos_shifts_status ON public.pos_shifts(status);

ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kasir can manage own shifts"
ON public.pos_shifts FOR ALL
USING (
  kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Branch managers can view branch shifts"
ON public.pos_shifts FOR SELECT
USING (
  has_role('ho_admin'::user_role)
  OR ((has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role))
      AND branch_id = get_current_user_branch())
);

-- POS TRANSACTIONS
CREATE TABLE public.pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  branch_id UUID NOT NULL,
  kasir_id UUID NOT NULL,
  shift_id UUID REFERENCES public.pos_shifts(id),
  order_type TEXT NOT NULL DEFAULT 'take_away',
  external_order_id TEXT,
  table_number TEXT,
  customer_id UUID,
  customer_name TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_item NUMERIC NOT NULL DEFAULT 0,
  discount_bill NUMERIC NOT NULL DEFAULT 0,
  service_charge NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method_1 TEXT,
  amount_1 NUMERIC NOT NULL DEFAULT 0,
  payment_method_2 TEXT,
  amount_2 NUMERIC NOT NULL DEFAULT 0,
  cash_received NUMERIC NOT NULL DEFAULT 0,
  change_amount NUMERIC NOT NULL DEFAULT 0,
  point_earned INTEGER NOT NULL DEFAULT 0,
  point_redeemed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  void_at TIMESTAMPTZ,
  void_reason TEXT,
  void_by UUID
);

CREATE INDEX idx_pos_tx_branch ON public.pos_transactions(branch_id);
CREATE INDEX idx_pos_tx_kasir ON public.pos_transactions(kasir_id);
CREATE INDEX idx_pos_tx_shift ON public.pos_transactions(shift_id);
CREATE INDEX idx_pos_tx_status ON public.pos_transactions(status);
CREATE INDEX idx_pos_tx_created ON public.pos_transactions(created_at DESC);

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kasir can manage own transactions"
ON public.pos_transactions FOR ALL
USING (
  kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Branch managers can view branch transactions"
ON public.pos_transactions FOR SELECT
USING (
  has_role('ho_admin'::user_role)
  OR ((has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role))
      AND branch_id = get_current_user_branch())
);

-- POS TRANSACTION ITEMS
CREATE TABLE public.pos_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.pos_transactions(id) ON DELETE CASCADE,
  product_id UUID,
  product_code TEXT,
  product_name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  discount_item NUMERIC NOT NULL DEFAULT 0,
  subtotal_item NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_tx_items_tx ON public.pos_transaction_items(transaction_id);

ALTER TABLE public.pos_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage items via transaction access"
ON public.pos_transaction_items FOR ALL
USING (
  transaction_id IN (
    SELECT id FROM public.pos_transactions
    WHERE kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  transaction_id IN (
    SELECT id FROM public.pos_transactions
    WHERE kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Branch managers view items"
ON public.pos_transaction_items FOR SELECT
USING (
  transaction_id IN (
    SELECT id FROM public.pos_transactions
    WHERE has_role('ho_admin'::user_role)
       OR ((has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role))
           AND branch_id = get_current_user_branch())
  )
);

-- POS CASH MOVEMENTS
CREATE TABLE public.pos_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  kasir_id UUID NOT NULL,
  movement_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_cash_shift ON public.pos_cash_movements(shift_id);

ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kasir manage own cash movements"
ON public.pos_cash_movements FOR ALL
USING (
  kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Branch managers view cash movements"
ON public.pos_cash_movements FOR SELECT
USING (
  has_role('ho_admin'::user_role)
  OR ((has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role))
      AND branch_id = get_current_user_branch())
);

-- Updated_at trigger for pos_shifts
CREATE TRIGGER update_pos_shifts_updated_at
BEFORE UPDATE ON public.pos_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();