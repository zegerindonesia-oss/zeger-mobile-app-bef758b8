CREATE POLICY "Branch report can view branch pos transactions" ON public.pos_transactions FOR SELECT TO authenticated
USING (has_role('sb_report'::user_role) AND branch_id = get_current_user_branch());
CREATE POLICY "Branch report can view branch pos items" ON public.pos_transaction_items FOR SELECT TO authenticated
USING (has_role('sb_report'::user_role) AND transaction_id IN (SELECT id FROM public.pos_transactions WHERE branch_id = get_current_user_branch()));
CREATE POLICY "Branch report can view branch shifts" ON public.pos_shifts FOR SELECT TO authenticated
USING (has_role('sb_report'::user_role) AND branch_id = get_current_user_branch());