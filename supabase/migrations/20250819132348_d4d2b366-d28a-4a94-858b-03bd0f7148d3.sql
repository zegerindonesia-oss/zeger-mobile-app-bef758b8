-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('ho_admin', 'branch_manager', 'rider', 'finance', 'customer');

-- Create enum for transaction status
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled', 'returned');

-- Create enum for stock movement type
CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'transfer', 'adjustment', 'return');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  branch_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  manager_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2),
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES profiles(id),
  stock_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER DEFAULT 100,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, branch_id, rider_id)
);

-- Create stock movements table
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  rider_id UUID REFERENCES profiles(id),
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  reference_type TEXT, -- 'sale', 'purchase', 'transfer', 'adjustment'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES profiles(id),
  rider_id UUID REFERENCES profiles(id),
  branch_id UUID REFERENCES branches(id),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT, -- 'cash', 'qris', 'transfer'
  status transaction_status DEFAULT 'pending',
  notes TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transaction items table
CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create daily reports table
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  report_date DATE NOT NULL,
  total_sales DECIMAL(10,2) DEFAULT 0,
  cash_collected DECIMAL(10,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  start_location TEXT,
  end_location TEXT,
  photos JSONB, -- Array of photo URLs for returned stock
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(rider_id, report_date)
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  check_in_location TEXT,
  check_in_photo_url TEXT,
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_out_location TEXT,
  check_out_photo_url TEXT,
  work_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'checked_in',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create customer loyalty table
CREATE TABLE public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  points_balance INTEGER DEFAULT 0,
  total_earned_points INTEGER DEFAULT 0,
  total_redeemed_points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze', -- bronze, silver, gold, platinum
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;

-- Function to get user profile
CREATE OR REPLACE FUNCTION get_user_profile()
RETURNS profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM profiles WHERE user_id = auth.uid();
$$;

-- Function to check user role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = required_role 
    AND is_active = true
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "HO admin can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ho_admin')
  );

CREATE POLICY "Branch managers can view branch staff" ON profiles
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() 
           AND (p.role = 'branch_manager' AND p.branch_id = profiles.branch_id))
  );

-- RLS Policies for branches
CREATE POLICY "All authenticated users can view branches" ON branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "HO admin can manage branches" ON branches
  FOR ALL USING (has_role('ho_admin'));

-- RLS Policies for products
CREATE POLICY "All authenticated users can view products" ON products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "HO admin and branch managers can manage products" ON products
  FOR ALL USING (has_role('ho_admin') OR has_role('branch_manager'));

-- RLS Policies for inventory
CREATE POLICY "Users can view relevant inventory" ON inventory
  FOR SELECT USING (
    has_role('ho_admin') OR
    (has_role('branch_manager') AND branch_id = (SELECT branch_id FROM profiles WHERE user_id = auth.uid())) OR
    (has_role('rider') AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "Authorized users can manage inventory" ON inventory
  FOR ALL USING (
    has_role('ho_admin') OR 
    has_role('branch_manager')
  );

-- RLS Policies for transactions
CREATE POLICY "Users can view relevant transactions" ON transactions
  FOR SELECT USING (
    has_role('ho_admin') OR
    (has_role('branch_manager') AND branch_id = (SELECT branch_id FROM profiles WHERE user_id = auth.uid())) OR
    (has_role('rider') AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
    (has_role('customer') AND customer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "Riders and staff can create transactions" ON transactions
  FOR INSERT WITH CHECK (
    has_role('rider') OR has_role('branch_manager') OR has_role('ho_admin')
  );

-- RLS Policies for daily reports
CREATE POLICY "Users can view relevant daily reports" ON daily_reports
  FOR SELECT USING (
    has_role('ho_admin') OR
    (has_role('branch_manager') AND branch_id = (SELECT branch_id FROM profiles WHERE user_id = auth.uid())) OR
    (has_role('rider') AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "Riders can create own daily reports" ON daily_reports
  FOR INSERT WITH CHECK (
    has_role('rider') AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO branches (name, code, address, phone) VALUES 
('Cabang Pusat Jakarta', 'JKT001', 'Jl. Sudirman No. 1, Jakarta', '021-12345678'),
('Cabang Bandung', 'BDG001', 'Jl. Asia Afrika No. 10, Bandung', '022-87654321'),
('Cabang Surabaya', 'SBY001', 'Jl. Tunjungan No. 5, Surabaya', '031-11223344');

INSERT INTO products (name, code, category, price, cost_price, description) VALUES 
('Americano', 'AMR001', 'Coffee', 8000, 3000, 'Classic black coffee'),
('Classic Latte', 'LAT001', 'Coffee', 8000, 3500, 'Espresso with steamed milk'),
('Dolce Latte', 'DOL001', 'Coffee', 10000, 4000, 'Sweet latte with caramel'),
('Aren Creamy Latte', 'ARE001', 'Coffee', 13000, 5000, 'Latte with aren sugar'),
('Baileys Creamy Latte', 'BAI001', 'Coffee', 15000, 6000, 'Premium latte with Bailey''s flavor'),
('Butterscooth Creamy Latte', 'BUT001', 'Coffee', 15000, 6000, 'Creamy latte with butterscotch'),
('Matcha', 'MAT001', 'Tea', 13000, 5000, 'Japanese green tea'),
('Lychee Tea', 'LYC001', 'Tea', 8000, 3000, 'Refreshing lychee tea'),
('Lemonade', 'LEM001', 'Beverage', 8000, 2500, 'Fresh lemon drink'),
('Cookies and Cream', 'COO001', 'Beverage', 12000, 4500, 'Creamy cookies drink'),
('Caramel Mocca', 'CAR001', 'Coffee', 13000, 5000, 'Caramel flavored mocca'),
('Caramel Creamy Latte Baru', 'CAR002', 'Coffee', 13000, 5000, 'New caramel latte variant'),
('ZEPPRESSO', 'ZEP001', 'Coffee', 10000, 4000, 'Signature espresso blend');