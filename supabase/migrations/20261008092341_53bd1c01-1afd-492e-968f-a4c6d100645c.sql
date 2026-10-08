CREATE INDEX IF NOT EXISTS idx_daily_opex_date_rider ON public.daily_operational_expenses (expense_date, rider_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_due ON public.purchase_orders (branch_id, due_date);
CREATE INDEX IF NOT EXISTS idx_shift_mgmt_date_status ON public.shift_management (shift_date, status);
CREATE INDEX IF NOT EXISTS idx_transactions_completed_date ON public.transactions (transaction_date) WHERE status = 'completed' AND is_voided = false;