-- Fix Branch Hub Kemiri GPS Coordinates
-- Location: Sidoarjo, East Java (NOT Jakarta)
-- Coordinates provided by client: -7.442270754057674, 112.72880403807247

UPDATE branches 
SET 
  latitude = -7.442270754057674, 
  longitude = 112.72880403807247
WHERE code = 'HUB-001' OR name ILIKE '%kemiri%';