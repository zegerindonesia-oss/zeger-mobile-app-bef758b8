-- Add inventory dummy data
INSERT INTO inventory (branch_id, product_id, stock_quantity, min_stock_level, max_stock_level) 
SELECT 
  b.id as branch_id,
  p.id as product_id,
  FLOOR(RANDOM() * 50 + 20) as stock_quantity,
  10 as min_stock_level,
  100 as max_stock_level
FROM branches b
CROSS JOIN products p
WHERE b.branch_type = 'hub'
ON CONFLICT DO NOTHING;

-- Add some dummy transactions
INSERT INTO transactions (transaction_number, branch_id, rider_id, total_amount, final_amount, payment_method, status) 
VALUES 
('TRX001', (SELECT id FROM branches WHERE code = 'ZCC001'), NULL, 35000, 35000, 'Cash', 'completed'),
('TRX002', (SELECT id FROM branches WHERE code = 'ZCM001'), NULL, 28000, 28000, 'Card', 'completed'),
('TRX003', (SELECT id FROM branches WHERE code = 'ZCK001'), NULL, 45000, 45000, 'Cash', 'completed')
ON CONFLICT (transaction_number) DO NOTHING;