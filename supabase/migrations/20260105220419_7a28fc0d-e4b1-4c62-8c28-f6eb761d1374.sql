-- Drop existing policy
DROP POLICY IF EXISTS "Branch users can manage operational expenses" ON operational_expenses;

-- Create new policy with sb_branch_manager included
CREATE POLICY "Branch users can manage operational expenses" 
ON operational_expenses
FOR ALL
TO public
USING (
  (get_current_user_role() = 'ho_admin'::user_role) 
  OR (
    (get_current_user_role() IN ('branch_manager'::user_role, 'sb_branch_manager'::user_role)) 
    AND (branch_id = get_current_user_branch())
  )
)
WITH CHECK (
  (get_current_user_role() = 'ho_admin'::user_role) 
  OR (
    (get_current_user_role() IN ('branch_manager'::user_role, 'sb_branch_manager'::user_role)) 
    AND (branch_id = get_current_user_branch())
  )
);