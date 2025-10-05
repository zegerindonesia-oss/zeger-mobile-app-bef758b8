-- Add GPS coordinates for branches
-- Using approximate coordinates for Indonesian locations

-- Zeger Hub Kemiri, Jakarta (assuming Central Jakarta area)
UPDATE branches 
SET latitude = -6.2088, longitude = 106.8456
WHERE code = 'HUB-001' OR name ILIKE '%kemiri%';

-- Zeger Hub Jakarta Pusat
UPDATE branches 
SET latitude = -6.1751, longitude = 106.8650
WHERE code = 'HUB-002' OR name ILIKE '%jakarta pusat%';

-- Zeger Coffee Graha Kota (assuming this is in Surabaya)
UPDATE branches 
SET latitude = -7.2575, longitude = 112.7521
WHERE code = 'SB-001' OR name ILIKE '%graha kota%';

-- Zeger Coffee Malang
UPDATE branches 
SET latitude = -7.9666, longitude = 112.6326
WHERE code = 'SB-002' OR name ILIKE '%malang%';

-- For any remaining branches without coordinates, set to Jakarta center as fallback
UPDATE branches 
SET latitude = -6.2088, longitude = 106.8456
WHERE latitude IS NULL OR longitude IS NULL;