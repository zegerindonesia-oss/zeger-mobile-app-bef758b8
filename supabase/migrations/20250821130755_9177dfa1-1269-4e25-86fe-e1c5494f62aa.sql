-- Create profiles for riders and staff with NULL user_id for now (can be linked to real users later)
DO $$
DECLARE
    hub001_id uuid;
    hub002_id uuid;
    otw001_id uuid;
    otw002_id uuid;
    otw003_id uuid;
    otw004_id uuid;
    otw005_id uuid;
BEGIN
    -- Get branch IDs
    SELECT id INTO hub001_id FROM branches WHERE code = 'HUB001';
    SELECT id INTO hub002_id FROM branches WHERE code = 'HUB002';
    SELECT id INTO otw001_id FROM branches WHERE code = 'OTW001';
    SELECT id INTO otw002_id FROM branches WHERE code = 'OTW002';
    SELECT id INTO otw003_id FROM branches WHERE code = 'OTW003';
    SELECT id INTO otw004_id FROM branches WHERE code = 'OTW004';
    SELECT id INTO otw005_id FROM branches WHERE code = 'OTW005';

    -- Insert 15 riders (NULL user_id will be updated when real users are created)
    -- Riders for OTW001 (3 riders)
    INSERT INTO profiles (user_id, full_name, phone, role, branch_id, is_active) VALUES
    (NULL, 'Ahmad Zeger OTW 01', '0821-1111-0001', 'rider', otw001_id, true),
    (NULL, 'Budi Zeger OTW 02', '0821-1111-0002', 'rider', otw001_id, true),
    (NULL, 'Citra Zeger OTW 03', '0821-1111-0003', 'rider', otw001_id, true),
    
    -- Riders for OTW002 (3 riders)
    (NULL, 'Deni Zeger OTW 04', '0821-2222-0004', 'rider', otw002_id, true),
    (NULL, 'Eka Zeger OTW 05', '0821-2222-0005', 'rider', otw002_id, true),
    (NULL, 'Fira Zeger OTW 06', '0821-2222-0006', 'rider', otw002_id, true),
    
    -- Riders for OTW003 (3 riders)
    (NULL, 'Gina Zeger OTW 07', '0821-3333-0007', 'rider', otw003_id, true),
    (NULL, 'Hadi Zeger OTW 08', '0821-3333-0008', 'rider', otw003_id, true),
    (NULL, 'Indra Zeger OTW 09', '0821-3333-0009', 'rider', otw003_id, true),
    
    -- Riders for OTW004 (3 riders)
    (NULL, 'Joko Zeger OTW 10', '0821-4444-0010', 'rider', otw004_id, true),
    (NULL, 'Kiki Zeger OTW 11', '0821-4444-0011', 'rider', otw004_id, true),
    (NULL, 'Lina Zeger OTW 12', '0821-4444-0012', 'rider', otw004_id, true),
    
    -- Riders for OTW005 (3 riders)
    (NULL, 'Mita Zeger OTW 13', '0821-5555-0013', 'rider', otw005_id, true),
    (NULL, 'Nandi Zeger OTW 14', '0821-5555-0014', 'rider', otw005_id, true),
    (NULL, 'Oka Zeger OTW 15', '0821-5555-0015', 'rider', otw005_id, true);
    
    -- Create HO Admin
    INSERT INTO profiles (user_id, full_name, phone, role, is_active) VALUES
    (NULL, 'Super Admin Zeger', '0821-9999-9999', 'ho_admin', true);
    
    -- Create Branch Managers
    INSERT INTO profiles (user_id, full_name, phone, role, branch_id, is_active) VALUES
    (NULL, 'Manager Hub Jakarta Pusat', '0821-1000-0001', 'branch_manager', hub001_id, true),
    (NULL, 'Manager Hub Surabaya', '0821-2000-0001', 'branch_manager', hub002_id, true),
    (NULL, 'Manager OTW Kemang', '0821-1100-0001', 'branch_manager', otw001_id, true),
    (NULL, 'Manager OTW BSD', '0821-1200-0001', 'branch_manager', otw002_id, true),
    (NULL, 'Manager OTW PIK', '0821-1300-0001', 'branch_manager', otw003_id, true),
    (NULL, 'Manager OTW Pondok Indah', '0821-1400-0001', 'branch_manager', otw004_id, true),
    (NULL, 'Manager OTW Kelapa Gading', '0821-1500-0001', 'branch_manager', otw005_id, true);
END $$;

-- Create inventory for all branches and products
INSERT INTO inventory (branch_id, product_id, stock_quantity, min_stock_level, max_stock_level)
SELECT 
    b.id as branch_id,
    p.id as product_id,
    CASE 
        WHEN b.branch_type = 'hub' THEN 
            CASE 
                WHEN p.category IN ('Espresso Based', 'Milk Based') THEN 100
                WHEN p.category = 'Signature' THEN 50
                ELSE 30
            END
        ELSE -- on_the_wheels
            CASE 
                WHEN p.category IN ('Espresso Based', 'Milk Based') THEN 50
                WHEN p.category = 'Signature' THEN 25
                ELSE 15
            END
    END as stock_quantity,
    CASE 
        WHEN p.category IN ('Espresso Based', 'Milk Based') THEN 20
        WHEN p.category = 'Signature' THEN 10
        ELSE 5
    END as min_stock_level,
    CASE 
        WHEN b.branch_type = 'hub' THEN 
            CASE 
                WHEN p.category IN ('Espresso Based', 'Milk Based') THEN 200
                WHEN p.category = 'Signature' THEN 100
                ELSE 50
            END
        ELSE -- on_the_wheels
            CASE 
                WHEN p.category IN ('Espresso Based', 'Milk Based') THEN 100
                WHEN p.category = 'Signature' THEN 50
                ELSE 25
            END
    END as max_stock_level
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;