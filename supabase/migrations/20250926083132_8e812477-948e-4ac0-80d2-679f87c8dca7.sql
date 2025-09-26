-- Update RLS policy for branches to allow branch managers to create small branches under their hub
DROP POLICY IF EXISTS "HO admin can manage branches" ON branches;

CREATE POLICY "HO admin can manage branches" 
ON branches 
FOR ALL 
USING (has_role('ho_admin'::user_role))
WITH CHECK (has_role('ho_admin'::user_role));

-- Allow branch managers to create small branches under their hub
CREATE POLICY "Branch managers can create small branches" 
ON branches 
FOR INSERT 
WITH CHECK (
  has_role('branch_manager'::user_role) 
  AND branch_type = 'small'
  AND parent_branch_id = get_current_user_branch()
  AND level = 3
);

-- Allow branch managers to view and update small branches under their hub
CREATE POLICY "Branch managers can manage small branches" 
ON branches 
FOR ALL 
USING (
  has_role('branch_manager'::user_role) 
  AND branch_type = 'small'
  AND parent_branch_id = get_current_user_branch()
)
WITH CHECK (
  has_role('branch_manager'::user_role) 
  AND branch_type = 'small'
  AND parent_branch_id = get_current_user_branch()
);