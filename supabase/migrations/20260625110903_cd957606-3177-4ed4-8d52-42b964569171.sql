CREATE POLICY "Branch managers can create branch rider expenses"
ON public.daily_operational_expenses
FOR INSERT
WITH CHECK (
  (get_current_user_role() = ANY (ARRAY['ho_admin'::user_role, 'branch_manager'::user_role, 'sb_branch_manager'::user_role]))
  AND (rider_id IN (SELECT p.id FROM profiles p WHERE p.branch_id = get_current_user_branch()))
);