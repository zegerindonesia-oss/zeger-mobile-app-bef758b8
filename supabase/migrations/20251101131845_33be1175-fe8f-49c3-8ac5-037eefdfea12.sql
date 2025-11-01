-- Create product_waste table
CREATE TABLE product_waste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES profiles(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  waste_reason TEXT NOT NULL CHECK (waste_reason IN ('tumpah', 'bocor', 'basi', 'expired')),
  notes TEXT,
  hpp NUMERIC NOT NULL DEFAULT 0,
  total_waste NUMERIC GENERATED ALWAYS AS (quantity * hpp) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE product_waste ENABLE ROW LEVEL SECURITY;

-- Branch managers and HO admin can manage waste
CREATE POLICY "Branch managers can manage waste" ON product_waste
  FOR ALL USING (
    has_role('ho_admin'::user_role) OR 
    (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch())
  )
  WITH CHECK (
    has_role('ho_admin'::user_role) OR 
    (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch())
  );

-- BH Report users can view assigned rider waste
CREATE POLICY "BH Report users can view assigned rider waste" ON product_waste
  FOR SELECT USING (
    has_role('bh_report'::user_role) AND 
    rider_id = get_assigned_rider_id()
  );

-- Riders can create own waste records
CREATE POLICY "Riders can create own waste" ON product_waste
  FOR INSERT WITH CHECK (
    is_rider_role() AND 
    rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Riders can view own waste records
CREATE POLICY "Riders can view own waste" ON product_waste
  FOR SELECT USING (
    is_rider_role() AND 
    rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Create index for better query performance
CREATE INDEX idx_product_waste_rider ON product_waste(rider_id);
CREATE INDEX idx_product_waste_branch ON product_waste(branch_id);
CREATE INDEX idx_product_waste_date ON product_waste(created_at DESC);