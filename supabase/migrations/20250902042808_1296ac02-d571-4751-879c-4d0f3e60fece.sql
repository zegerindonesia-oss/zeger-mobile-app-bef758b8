-- Add food cost data for testing on September 1, 2025
INSERT INTO daily_operational_expenses (rider_id, expense_type, amount, expense_date, description)
VALUES 
  ('9af42c3c-49a2-4180-8b46-f521b1a8585b', 'food', 170000, '2025-09-01', 'Food cost untuk produksi'),
  ('6ecf02f5-27e4-4dd1-9885-a77fd12a6262', 'food', 170000, '2025-09-01', 'Food cost untuk produksi')
ON CONFLICT DO NOTHING;