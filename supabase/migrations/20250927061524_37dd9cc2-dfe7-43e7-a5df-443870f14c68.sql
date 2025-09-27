-- Update Fitria's branch assignment to Zeger Coffee Malang
UPDATE profiles 
SET branch_id = '2cf8733e-cef4-4d35-a29e-493f87dac4a9'
WHERE full_name = 'Fitria Setyaningrum' 
AND role = 'sb_branch_manager';

-- Update Awang's branch assignment to Zeger Coffee Graha Kota  
UPDATE profiles
SET branch_id = '574f0212-db30-4d52-bd61-8a7273740d45'
WHERE full_name = 'Mas Awang'
AND role = 'sb_branch_manager';

-- Update branch manager assignments in branches table
UPDATE branches 
SET manager_id = 'e3081cb7-4ef9-463c-b06b-381f025e7418'
WHERE name = 'Zeger Coffee Malang';

UPDATE branches
SET manager_id = '84d8ce5b-817a-4aa1-80bf-072a548beff7' 
WHERE name = 'Zeger Coffee Graha Kota';