-- Clean up duplicate & conflicting RLS policies on stock_movements
-- Drop old restrictive policies that only allow 'rider' role
DROP POLICY IF EXISTS "Riders can view own stock movements" ON stock_movements;
DROP POLICY IF EXISTS "Riders can confirm own stock movements" ON stock_movements;
DROP POLICY IF EXISTS "Riders can insert return movements" ON stock_movements;

-- Create NEW inclusive SELECT policy for ALL rider types (rider, sb_rider, bh_rider)
CREATE POLICY "All riders can view own stock movements"
ON stock_movements FOR SELECT
TO public
USING (
  is_rider_role() 
  AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Note: Existing policies are retained:
-- 1. "Authorized users can manage stock movements" - for HO & Branch Manager
-- 2. "Small branch managers can create stock movements" - for SB managers
-- 3. "Riders can confirm stock movements" (UPDATE with is_rider_role) - already inclusive
-- 4. "Riders can create return movements" (INSERT with is_rider_role) - already inclusive

-- Verification: This migration ensures Z-009 Pak Alut (sb_rider) can now see pending transfers from Zeger Coffee Malang