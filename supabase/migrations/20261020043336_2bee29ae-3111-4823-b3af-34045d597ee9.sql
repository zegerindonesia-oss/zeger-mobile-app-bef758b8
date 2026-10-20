ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS courier_code text,
  ADD COLUMN IF NOT EXISTS courier_service_code text,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_order_id text,
  ADD COLUMN IF NOT EXISTS courier_waybill text,
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_driver_name text,
  ADD COLUMN IF NOT EXISTS courier_driver_phone text,
  ADD COLUMN IF NOT EXISTS courier_tracking_url text,
  ADD COLUMN IF NOT EXISTS courier_updated_at timestamptz;