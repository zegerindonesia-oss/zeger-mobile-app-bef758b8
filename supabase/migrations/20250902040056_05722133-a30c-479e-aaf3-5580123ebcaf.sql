-- Fix rider with null branch_id for "Z- 00 Zeger Event"
-- First, let's find the branch that should be assigned
UPDATE profiles 
SET branch_id = (
    SELECT id FROM branches 
    WHERE name ILIKE '%hub%' OR name ILIKE '%branch%' 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE full_name = 'Z- 00 Zeger Event' 
AND role = 'rider' 
AND branch_id IS NULL;