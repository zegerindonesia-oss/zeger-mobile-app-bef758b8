-- Assign riders to Branch Hub Report users
-- Bu Vita (vita.andini@gmail.com) -> Pak Tri Z005
-- First, find the bh_report user and rider

-- Insert assignment for Bu Vita to Pak Tri (assuming we know the rider ID)
-- We'll need to find the rider by name since we don't have the exact ID
DO $$
DECLARE
    vita_user_id UUID;
    tri_rider_id UUID;
BEGIN
    -- Find Bu Vita's profile ID (bh_report user)
    SELECT id INTO vita_user_id 
    FROM profiles 
    WHERE role = 'bh_report' 
    AND full_name ILIKE '%vita%' 
    LIMIT 1;
    
    -- Find Pak Tri's rider profile ID
    SELECT id INTO tri_rider_id 
    FROM profiles 
    WHERE role = 'rider' 
    AND full_name ILIKE '%tri%' 
    LIMIT 1;
    
    -- If both users exist, create/update the assignment
    IF vita_user_id IS NOT NULL AND tri_rider_id IS NOT NULL THEN
        INSERT INTO branch_hub_report_assignments (user_id, rider_id)
        VALUES (vita_user_id, tri_rider_id)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            rider_id = tri_rider_id,
            updated_at = now();
    END IF;
END $$;