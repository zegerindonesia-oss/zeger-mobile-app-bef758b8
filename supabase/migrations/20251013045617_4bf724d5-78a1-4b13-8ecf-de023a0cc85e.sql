-- Fix RLS policies to support sb_branch_manager role

-- 1. Fix transactions table SELECT policy
DROP POLICY IF EXISTS "Users can view relevant transactions" ON transactions;
CREATE POLICY "Users can view relevant transactions"
ON transactions FOR SELECT
TO public
USING (
  has_role('ho_admin'::user_role) 
  OR (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch())
  OR (has_role('sb_branch_manager'::user_role) AND branch_id = get_current_user_branch())
  OR (is_rider_role() AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  OR (has_role('customer'::user_role) AND customer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- 2. Fix transaction_items table SELECT policy
DROP POLICY IF EXISTS "Users can view relevant transaction items" ON transaction_items;
CREATE POLICY "Users can view relevant transaction items"
ON transaction_items FOR SELECT
TO public
USING (
  has_role('ho_admin'::user_role)
  OR EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_items.transaction_id
    AND (
      (has_role('branch_manager'::user_role) AND t.branch_id = get_current_user_branch())
      OR (has_role('sb_branch_manager'::user_role) AND t.branch_id = get_current_user_branch())
      OR (is_rider_role() AND t.rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  )
);

-- 3. Fix shift_management SELECT policies to include sb_branch_manager
DROP POLICY IF EXISTS "Users can view relevant shifts" ON shift_management;
CREATE POLICY "Users can view relevant shifts"
ON shift_management FOR SELECT
TO public
USING (
  has_role('ho_admin'::user_role)
  OR (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch())
  OR (has_role('sb_branch_manager'::user_role) AND branch_id = get_current_user_branch())
  OR (is_rider_role() AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- 4. Verify daily_operational_expenses has sb_branch_manager support
-- Note: The existing policy already references shift_management, so it will inherit the fix

-- 5. Ensure products table is readable by sb_branch_manager
DROP POLICY IF EXISTS "All authenticated users can view products" ON products;
CREATE POLICY "All authenticated users can view products"
ON products FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
);