-- Add dummy data for products
INSERT INTO products (name, code, description, category, price, cost_price, image_url) VALUES
('Espresso', 'ESP001', 'Kopi espresso klasik dengan rasa yang kuat', 'Coffee', 15000, 8000, '/placeholder-coffee.jpg'),
('Cappuccino', 'CAP001', 'Kopi cappuccino dengan foam susu yang lembut', 'Coffee', 25000, 12000, '/placeholder-coffee.jpg'),
('Latte', 'LAT001', 'Kopi latte dengan susu steamed yang creamy', 'Coffee', 28000, 14000, '/placeholder-coffee.jpg'),
('Americano', 'AME001', 'Kopi americano yang segar dan tidak terlalu kuat', 'Coffee', 20000, 10000, '/placeholder-coffee.jpg'),
('Mocha', 'MOC001', 'Kopi mocha dengan cokelat yang manis', 'Coffee', 30000, 15000, '/placeholder-coffee.jpg'),
('Croissant', 'CRO001', 'Croissant butter yang renyah dan lezat', 'Pastry', 18000, 9000, '/placeholder-pastry.jpg'),
('Sandwich Club', 'SAN001', 'Sandwich club dengan daging dan sayuran segar', 'Food', 35000, 18000, '/placeholder-food.jpg'),
('Cheesecake', 'CHE001', 'Cheesecake New York yang lembut dan creamy', 'Dessert', 25000, 12000, '/placeholder-dessert.jpg'),
('Mineral Water', 'WAT001', 'Air mineral dalam kemasan botol', 'Beverage', 5000, 2500, '/placeholder-water.jpg'),
('Green Tea', 'TEA001', 'Teh hijau segar tanpa gula', 'Beverage', 12000, 6000, '/placeholder-tea.jpg')
ON CONFLICT (code) DO NOTHING;

-- Add dummy data for branches
INSERT INTO branches (name, code, description, address, phone, branch_type) VALUES
('Zeger Coffee Central', 'ZCC001', 'Cabang utama di pusat kota', 'Jl. Sudirman No. 123, Jakarta Pusat', '021-1234567', 'hub'),
('Zeger Coffee Mall Plaza', 'ZCM001', 'Cabang di Mall Plaza Indonesia', 'Mall Plaza Indonesia Lt. 2, Jakarta', '021-2345678', 'hub'),
('Zeger Coffee Kemang', 'ZCK001', 'Cabang di area Kemang', 'Jl. Kemang Raya No. 45, Jakarta Selatan', '021-3456789', 'hub'),
('Mobile Unit 1', 'MOB001', 'Unit mobile untuk area Jakarta Utara', 'Base Jakarta Utara', '081-1111111', 'mobile'),
('Mobile Unit 2', 'MOB002', 'Unit mobile untuk area Jakarta Barat', 'Base Jakarta Barat', '081-2222222', 'mobile')
ON CONFLICT (code) DO NOTHING;