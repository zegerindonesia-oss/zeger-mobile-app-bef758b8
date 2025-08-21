-- First, let's add branch type to differentiate Hub and On The Wheels
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_type text DEFAULT 'hub';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS description text;

-- Insert Branch Hub dummy data
INSERT INTO branches (name, code, branch_type, address, phone, description, is_active) VALUES
('Zeger Hub Jakarta Pusat', 'HUB001', 'hub', 'Jl. Thamrin No. 10, Jakarta Pusat', '021-12345678', 'Central Kitchen & Outlet - Jakarta Pusat', true),
('Zeger Hub Surabaya', 'HUB002', 'hub', 'Jl. Pemuda No. 25, Surabaya', '031-87654321', 'Central Kitchen & Outlet - Surabaya', true);

-- Insert Branch On The Wheels dummy data  
INSERT INTO branches (name, code, branch_type, address, phone, description, is_active) VALUES
('Zeger OTW Kemang', 'OTW001', 'on_the_wheels', 'Area Kemang, Jakarta Selatan', '021-11111111', 'Mobile Coffee Stand - Kemang Area', true),
('Zeger OTW BSD', 'OTW002', 'on_the_wheels', 'Area BSD City, Tangerang', '021-22222222', 'Mobile Coffee Stand - BSD Area', true), 
('Zeger OTW PIK', 'OTW003', 'on_the_wheels', 'Area PIK, Jakarta Utara', '021-33333333', 'Mobile Coffee Stand - PIK Area', true),
('Zeger OTW Pondok Indah', 'OTW004', 'on_the_wheels', 'Area Pondok Indah, Jakarta Selatan', '021-44444444', 'Mobile Coffee Stand - Pondok Indah Area', true),
('Zeger OTW Kelapa Gading', 'OTW005', 'on_the_wheels', 'Area Kelapa Gading, Jakarta Utara', '021-55555555', 'Mobile Coffee Stand - Kelapa Gading Area', true);

-- Insert comprehensive Zeger coffee menu based on the images
INSERT INTO products (name, code, category, price, cost_price, description, is_active) VALUES
-- Espresso Based
('Americano', 'ESP001', 'Espresso Based', 8000, 4000, 'Espresso dengan air dingin', true),
('Sunrise Americano', 'ESP002', 'Espresso Based', 12000, 6000, 'Americano dengan rasa buah tropical', true),
('Citrus Coffee', 'ESP003', 'Espresso Based', 12000, 6000, 'Americano dengan rasa buah lemon', true),
('Classic Latte', 'ESP004', 'Espresso Based', 8000, 4000, 'Espresso dengan susu creamy tanpa gula', true),
('Dolce Latte', 'ESP005', 'Espresso Based', 10000, 5000, 'Espresso dengan susu creamy dan SKM', true),
('Aren Creamy Latte', 'ESP006', 'Espresso Based', 13000, 6500, 'Latte dengan gula aren premium', true),
('Caramel Creamy Latte', 'ESP007', 'Espresso Based', 13000, 6500, 'Latte dengan sirup karamel premium', true),
('Baileys Creamy Latte', 'ESP008', 'Espresso Based', 15000, 7500, 'Latte dengan rasa Bailey premium', true),
('Butterscooth Creamy Latte', 'ESP009', 'Espresso Based', 15000, 7500, 'Latte dengan rasa butterscotch premium', true),
('Caramel Mocha', 'ESP010', 'Espresso Based', 15000, 7500, 'Mocha dengan sirup karamel', true),
('Zepresso', 'ESP011', 'Espresso Based', 10000, 5000, 'Double Shot Espresso Houseblend 50ml', true),

-- Milk Based  
('Cookies & Cream', 'MLK001', 'Milk Based', 12000, 6000, 'Minuman susu dengan cookies oreo', true),
('Chocomalt', 'MLK002', 'Milk Based', 10000, 5000, 'Minuman coklat malt premium', true),
('Matcha', 'MLK003', 'Milk Based', 13000, 6500, 'Minuman matcha premium Jepang', true),

-- Signature Drinks
('Zeger Coffee Jelly', 'SIG001', 'Signature', 15000, 7500, 'Espresso dengan susu creamy & Pearl Jelly', true),
('Caramel Machiato', 'SIG002', 'Signature', 20000, 10000, 'Signature caramel machiato', true),
('Choco Lava Ice Cream', 'SIG003', 'Signature', 18000, 9000, 'Es krim coklat dengan lava sauce', true),
('Choco Matcha Ice Cream', 'SIG004', 'Signature', 20000, 10000, 'Es krim matcha coklat premium', true),
('Taro Cheese Velvet', 'SIG005', 'Signature', 18000, 9000, 'Minuman taro dengan cheese foam', true),

-- Creampresso
('Classic Affogato', 'CRM001', 'Creampresso', 13000, 6500, 'Es krim vanilla dengan espresso', true),
('Zeger Supreme', 'CRM002', 'Creampresso', 15000, 7500, 'Es krim vanilla dengan espresso & Oreo', true),
('Vanilla Cookies Crumb', 'CRM003', 'Creampresso', 14000, 7000, 'Es krim vanilla & Oreo crumb', true),
('Choco Affogato', 'CRM004', 'Creampresso', 15000, 7500, 'Es krim vanilla dengan coklat', true),
('Matcha Affogato', 'CRM005', 'Creampresso', 15000, 7500, 'Es krim vanilla dengan matcha', true),
('Sunny Mango', 'CRM006', 'Creampresso', 14000, 7000, 'Es krim vanilla dengan selai mango', true),

-- Additional Milk Based Items
('Zeger Milk Tea', 'MLK004', 'Milk Based', 15000, 7500, 'Thai milk tea signature', true),
('Hazelnut Choco Pearl Jelly Milktea', 'MLK005', 'Milk Based', 18000, 9000, 'Milk tea hazelnut dengan pearl jelly', true),
('Brown Sugar Pearl Jelly Freshmilk', 'MLK006', 'Milk Based', 18000, 9000, 'Fresh milk dengan brown sugar pearl', true),
('Brown Sugar Pearl Jelly Milktea', 'MLK007', 'Milk Based', 18000, 9000, 'Milk tea dengan brown sugar pearl', true),
('Taro Milktea', 'MLK008', 'Milk Based', 10000, 5000, 'Milk tea rasa taro', true),
('Thai Tea', 'MLK009', 'Milk Based', 8000, 4000, 'Thai tea original', true),

-- Refresher
('Java Tea', 'REF001', 'Refresher', 7000, 3500, 'Teh jawa segar', true),
('Java Lemon Tea', 'REF002', 'Refresher', 8000, 4000, 'Teh jawa dengan perasan lemon', true),
('Lychee Tea', 'REF003', 'Refresher', 8000, 4000, 'Teh leci segar', true),
('Lemonade', 'REF004', 'Refresher', 8000, 4000, 'Lemon segar', true),
('Tropicool Mango', 'REF005', 'Refresher', 12000, 6000, 'Minuman mangga tropical', true),

-- Toppings & Add-ons
('Espresso One Shot', 'TOP001', 'Topping', 6000, 3000, 'Tambahan espresso shot', true),
('Cookie Crumb', 'TOP002', 'Topping', 4000, 2000, 'Tambahan cookie crumb', true),
('Ice Cream One Scoop', 'TOP003', 'Topping', 4000, 2000, 'Tambahan es krim 1 scoop', true),
('Cheese Cream', 'TOP004', 'Topping', 5000, 2500, 'Tambahan cheese foam', true),
('Pearl Jelly', 'TOP005', 'Topping', 4000, 2000, 'Tambahan pearl jelly', true),

-- Syrup
('Caramel Syrup', 'SYR001', 'Syrup', 5000, 2500, 'Sirup karamel premium', true),
('Aren Syrup', 'SYR002', 'Syrup', 5000, 2500, 'Sirup gula aren', true),
('Baileys Syrup', 'SYR003', 'Syrup', 5000, 2500, 'Sirup rasa Bailey', true),
('Butterscooth Syrup', 'SYR004', 'Syrup', 5000, 2500, 'Sirup butterscotch', true);