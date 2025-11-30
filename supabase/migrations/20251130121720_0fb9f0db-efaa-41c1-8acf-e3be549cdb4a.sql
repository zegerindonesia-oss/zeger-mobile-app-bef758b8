-- Create cash_deposit_verifications table
CREATE TABLE cash_deposit_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES profiles(id),
  deposit_date DATE NOT NULL,
  verified_total_sales BOOLEAN DEFAULT false,
  verified_cash_sales BOOLEAN DEFAULT false,
  verified_qris_sales BOOLEAN DEFAULT false,
  verified_transfer_sales BOOLEAN DEFAULT false,
  verified_operational_expenses BOOLEAN DEFAULT false,
  verified_cash_deposit BOOLEAN DEFAULT false,
  notes TEXT,
  verified_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rider_id, deposit_date)
);

-- Enable RLS
ALTER TABLE cash_deposit_verifications ENABLE ROW LEVEL SECURITY;

-- Branch managers can manage verifications for their branch riders
CREATE POLICY "Branch managers can manage verifications"
ON cash_deposit_verifications FOR ALL
USING (
  has_role('ho_admin'::user_role) OR
  (
    (has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role))
    AND rider_id IN (
      SELECT id FROM profiles WHERE branch_id = get_current_user_branch()
    )
  )
);