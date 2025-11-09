-- Fix ambiguous column reference in decrement_rider_stock function
CREATE OR REPLACE FUNCTION decrement_rider_stock(
  p_rider_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE (
  id UUID,
  stock_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Get current stock with row lock
  SELECT inventory.stock_quantity INTO v_current_stock
  FROM inventory
  WHERE inventory.rider_id = p_rider_id
    AND inventory.product_id = p_product_id
  FOR UPDATE; -- Lock row to prevent race condition

  -- Check if inventory exists
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Inventory not found for rider % and product %', p_rider_id, p_product_id;
  END IF;

  -- Check if sufficient stock
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  -- Update stock atomically using the variable (avoids ambiguity)
  RETURN QUERY
  UPDATE inventory
  SET stock_quantity = v_current_stock - p_quantity,
      last_updated = NOW()
  WHERE inventory.rider_id = p_rider_id
    AND inventory.product_id = p_product_id
  RETURNING inventory.id, inventory.stock_quantity;
END;
$$;

COMMENT ON FUNCTION decrement_rider_stock IS 
'Atomically decrements rider stock quantity. Fixed ambiguous column reference by using variable instead of column name in SET clause.';