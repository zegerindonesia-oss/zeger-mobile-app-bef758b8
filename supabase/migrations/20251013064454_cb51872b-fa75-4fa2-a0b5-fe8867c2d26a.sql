-- ============================================
-- FIX: Allow sb_branch_manager to view operational expenses
-- ============================================

DROP POLICY IF EXISTS "Users can view relevant expenses" ON daily_operational_expenses;

CREATE POLICY "Users can view relevant expenses"
ON daily_operational_expenses FOR SELECT
TO public
USING (
  has_role('ho_admin'::user_role)
  OR (
    has_role('branch_manager'::user_role) 
    AND shift_id IN (
      SELECT id FROM shift_management 
      WHERE branch_id = get_current_user_branch()
    )
  )
  OR (
    has_role('sb_branch_manager'::user_role)
    AND shift_id IN (
      SELECT id FROM shift_management 
      WHERE branch_id = get_current_user_branch()
    )
  )
  OR (
    is_rider_role() 
    AND rider_id = (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);