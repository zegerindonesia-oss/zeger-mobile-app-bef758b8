-- Add latitude and longitude columns to branches table for fallback rider location
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add index for location queries
CREATE INDEX IF NOT EXISTS idx_branches_location ON branches(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Update some sample branch locations (Jakarta area)
-- These are example coordinates, should be updated with actual branch locations
COMMENT ON COLUMN branches.latitude IS 'Branch GPS latitude for rider location fallback';
COMMENT ON COLUMN branches.longitude IS 'Branch GPS longitude for rider location fallback';