-- Step 1: Hapus inventory Z-009 & Z-011 dari Branch Hub Kemiri
-- Hapus semua inventory rider Z-009 dan Z-011 yang masih terkait dengan Branch Hub Kemiri
DELETE FROM inventory 
WHERE rider_id IN (
  SELECT id FROM profiles 
  WHERE full_name ILIKE '%Z-009%' 
     OR full_name ILIKE '%Z-011%'
     OR full_name ILIKE '%Z-0011%'
)
AND branch_id = '485c5e77-9c30-4429-ba16-90b92d3a5124';

-- Verification comment: Setelah ini, Z-009 Pak Alut hanya punya inventory di Zeger Coffee Malang
-- dan Z-011 Deden hanya punya inventory di Zeger Coffee Graha Kota