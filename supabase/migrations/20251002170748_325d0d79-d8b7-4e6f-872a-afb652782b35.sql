-- Add outlet-related columns to customer_orders table
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_customer_orders_outlet_id ON customer_orders(outlet_id);