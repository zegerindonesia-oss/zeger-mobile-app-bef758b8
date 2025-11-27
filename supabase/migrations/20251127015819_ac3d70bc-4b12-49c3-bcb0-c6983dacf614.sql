-- Allow branch_manager and sb_branch_manager to view rider expenses from their branch
CREATE POLICY "Branch managers can view branch rider expenses"
ON daily_operational_expenses
FOR SELECT
USING (
  (has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role)) 
  AND (
    rider_id IN (
      SELECT p.id FROM profiles p 
      WHERE p.branch_id = get_current_user_branch()
    )
  )
);