-- Clean up duplicate inventory records by merging them
-- First, update the record we want to keep with the total stock
WITH duplicates AS (
  SELECT 
    product_id,
    branch_id,
    SUM(stock_quantity) as total_stock,
    (ARRAY_AGG(id ORDER BY last_updated))[1] as keep_id
  FROM inventory
  WHERE rider_id IS NULL
  GROUP BY product_id, branch_id
  HAVING COUNT(*) > 1
)
UPDATE inventory
SET stock_quantity = duplicates.total_stock,
    last_updated = now()
FROM duplicates
WHERE inventory.id = duplicates.keep_id;

-- Delete duplicate records (keep only the first one per product+branch)
WITH duplicates_to_delete AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY product_id, branch_id ORDER BY last_updated) as row_num
  FROM inventory
  WHERE rider_id IS NULL
)
DELETE FROM inventory
WHERE id IN (
  SELECT id FROM duplicates_to_delete WHERE row_num > 1
);

-- Create function to get total branch stock
CREATE OR REPLACE FUNCTION public.get_branch_stock(
  p_branch_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_stock INTEGER;
BEGIN
  SELECT COALESCE(SUM(stock_quantity), 0)
  INTO total_stock
  FROM inventory
  WHERE branch_id = p_branch_id
    AND product_id = p_product_id
    AND rider_id IS NULL;
  
  RETURN total_stock;
END;
$$;

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_branch_product_no_rider 
ON inventory(branch_id, product_id) 
WHERE rider_id IS NULL;

-- For rider inventory, keep the existing non-unique behavior
CREATE INDEX IF NOT EXISTS idx_inventory_branch_product_rider 
ON inventory(branch_id, product_id, rider_id) 
WHERE rider_id IS NOT NULL;