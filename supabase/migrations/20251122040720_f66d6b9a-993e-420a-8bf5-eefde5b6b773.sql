-- Update role Z-014 Mas Reza from 'rider' to 'sb_rider'
-- This ensures consistency with small branch rider role naming
UPDATE profiles 
SET role = 'sb_rider'
WHERE id = '84fd5a05-2433-442d-9812-0529191a25fa'
  AND full_name = 'Z-014 Mas Reza';