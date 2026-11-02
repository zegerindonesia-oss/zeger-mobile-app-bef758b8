CREATE INDEX IF NOT EXISTS idx_transactions_rider_date ON public.transactions (rider_id, transaction_date) WHERE is_voided = false;
CREATE INDEX IF NOT EXISTS idx_transactions_rider_created ON public.transactions (rider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON public.transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_rider_delivery ON public.stock_movements (rider_id, actual_delivery_date);
CREATE INDEX IF NOT EXISTS idx_inventory_rider ON public.inventory (rider_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_rider_status ON public.customer_orders (rider_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_mgmt_rider_date ON public.shift_management (rider_id, shift_date);