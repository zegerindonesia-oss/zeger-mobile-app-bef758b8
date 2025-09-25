-- Fix rider Z-006 shift issue: Close old shift and create new active shift

-- 1. Close the old shift from September 24th
UPDATE shift_management 
SET status = 'completed', 
    shift_end_time = NOW(),
    updated_at = NOW()
WHERE rider_id = '32bb1648-2e2f-49cd-92fa-7221cbd1ffc5' 
AND shift_date = '2025-09-24' 
AND status = 'active';

-- 2. Create new active shift for current date (September 25th)
INSERT INTO shift_management (
  rider_id, 
  branch_id, 
  shift_date, 
  shift_number, 
  shift_start_time, 
  status,
  created_at,
  updated_at
) VALUES (
  '32bb1648-2e2f-49cd-92fa-7221cbd1ffc5',
  '485c5e77-9c30-4429-ba16-90b92d3a5124', 
  CURRENT_DATE, 
  1, 
  NOW(), 
  'active',
  NOW(),
  NOW()
);