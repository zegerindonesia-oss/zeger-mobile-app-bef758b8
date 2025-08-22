-- Create inventory records for rider testing
INSERT INTO inventory (product_id, branch_id, rider_id, stock_quantity, min_stock_level, max_stock_level) 
SELECT 
    p.id as product_id,
    b.id as branch_id,
    pr.id as rider_id,
    CASE 
        WHEN p.name = 'Espresso' THEN 2
        WHEN p.name = 'Latte' THEN 4  
        WHEN p.name = 'Americano' THEN 3
        WHEN p.name = 'Cappuccino' THEN 2
        WHEN p.name = 'Mocha' THEN 3
        WHEN p.name = 'Green Tea' THEN 4
        WHEN p.name = 'Mineral Water' THEN 5
        ELSE 2
    END as stock_quantity,
    5 as min_stock_level,
    50 as max_stock_level
FROM products p
CROSS JOIN branches b  
JOIN profiles pr ON pr.role = 'rider' AND pr.branch_id = b.id
WHERE p.is_active = true AND b.code IN ('ZCC001', 'ZCM001')
ON CONFLICT DO NOTHING;