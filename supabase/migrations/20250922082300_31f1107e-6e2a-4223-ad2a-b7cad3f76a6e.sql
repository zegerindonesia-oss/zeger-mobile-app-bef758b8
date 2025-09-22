-- Fix RLS policy for operational_expenses to allow branch managers to insert expenses
DROP POLICY IF EXISTS "Operational expenses access by branch" ON operational_expenses;

CREATE POLICY "Branch users can manage operational expenses" 
ON operational_expenses FOR ALL 
USING (
  (get_current_user_role() = 'ho_admin'::user_role) OR 
  (get_current_user_role() = 'branch_manager'::user_role AND branch_id = get_current_user_branch())
) WITH CHECK (
  (get_current_user_role() = 'ho_admin'::user_role) OR 
  (get_current_user_role() = 'branch_manager'::user_role AND branch_id = get_current_user_branch())
);