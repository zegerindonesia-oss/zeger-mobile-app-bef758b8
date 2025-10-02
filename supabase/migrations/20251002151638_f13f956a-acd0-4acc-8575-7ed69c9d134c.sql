-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Update profiles table untuk rider location tracking
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS last_known_lat double precision,
  ADD COLUMN IF NOT EXISTS last_known_lng double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Update customer_orders untuk support Zeger OTW flow
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'outlet_pickup' 
    CHECK (order_type IN ('outlet_pickup', 'outlet_delivery', 'on_the_wheels')),
  ADD COLUMN IF NOT EXISTS estimated_arrival timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS qris_payment_proof_url text;

-- Update rider_locations untuk real-time precision
ALTER TABLE rider_locations 
  ADD COLUMN IF NOT EXISTS accuracy numeric,
  ADD COLUMN IF NOT EXISTS heading numeric,
  ADD COLUMN IF NOT EXISTS speed numeric;

-- Buat tabel order_status_history untuk tracking
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES customer_orders(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customer bisa lihat history order mereka
CREATE POLICY "Customers can view own order history"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM customer_orders 
      WHERE user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid())
    )
  );

-- RLS Policy: Rider bisa insert status untuk order mereka
CREATE POLICY "Riders can insert order status"
  ON order_status_history FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM customer_orders 
      WHERE rider_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid())
    )
  );

-- Index untuk query location cepat
CREATE INDEX IF NOT EXISTS idx_profiles_location 
  ON profiles (last_known_lat, last_known_lng) WHERE last_known_lat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rider_locations_updated 
  ON rider_locations (rider_id, updated_at DESC);