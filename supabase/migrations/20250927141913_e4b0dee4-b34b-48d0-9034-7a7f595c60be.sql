-- Create customer users table for the customer app
CREATE TABLE public.customer_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  photo_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create customer orders table
CREATE TABLE public.customer_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.customer_users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total_price INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  delivery_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  voucher_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer order items table
CREATE TABLE public.customer_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL,
  custom_options JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer vouchers table
CREATE TABLE public.customer_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value INTEGER NOT NULL,
  min_order INTEGER DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer user vouchers table (claimed vouchers)
CREATE TABLE public.customer_user_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL REFERENCES public.customer_vouchers(id),
  is_used BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, voucher_id)
);

-- Create customer points history table
CREATE TABLE public.customer_points_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  description TEXT NOT NULL,
  order_id UUID REFERENCES public.customer_orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rider locations table for real-time tracking
CREATE TABLE public.rider_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rider_id)
);

-- Add customization options to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custom_options JSONB DEFAULT '{}';

-- Enable RLS on all customer tables
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_user_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customer users
CREATE POLICY "Users can view own profile" ON public.customer_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.customer_users
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.customer_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for customer orders
CREATE POLICY "Users can view own orders" ON public.customer_orders
  FOR SELECT USING (user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own orders" ON public.customer_orders
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

CREATE POLICY "Riders can view assigned orders" ON public.customer_orders
  FOR SELECT USING (rider_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

CREATE POLICY "Riders can update assigned orders" ON public.customer_orders
  FOR UPDATE USING (rider_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

-- Create RLS policies for order items
CREATE POLICY "Users can view own order items" ON public.customer_order_items
  FOR SELECT USING (order_id IN (
    SELECT id FROM customer_orders WHERE user_id IN (
      SELECT id FROM customer_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create order items" ON public.customer_order_items
  FOR INSERT WITH CHECK (order_id IN (
    SELECT id FROM customer_orders WHERE user_id IN (
      SELECT id FROM customer_users WHERE user_id = auth.uid()
    )
  ));

-- Create RLS policies for vouchers
CREATE POLICY "All users can view active vouchers" ON public.customer_vouchers
  FOR SELECT USING (is_active = true AND valid_until >= CURRENT_DATE);

-- Create RLS policies for user vouchers
CREATE POLICY "Users can view own vouchers" ON public.customer_user_vouchers
  FOR SELECT USING (user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can claim vouchers" ON public.customer_user_vouchers
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can use own vouchers" ON public.customer_user_vouchers
  FOR UPDATE USING (user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

-- Create RLS policies for points history
CREATE POLICY "Users can view own points history" ON public.customer_points_history
  FOR SELECT USING (user_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

-- Create RLS policies for rider locations
CREATE POLICY "All users can view rider locations" ON public.rider_locations
  FOR SELECT USING (true);

CREATE POLICY "Riders can update own location" ON public.rider_locations
  FOR ALL USING (rider_id IN (SELECT id FROM customer_users WHERE user_id = auth.uid()));

-- Create functions for points management
CREATE OR REPLACE FUNCTION public.award_points_for_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Award 1 point per 1000 rupiah
  INSERT INTO public.customer_points_history (user_id, change, description, order_id)
  VALUES (NEW.user_id, NEW.total_price / 1000, 'Points from order #' || NEW.id, NEW.id);
  
  -- Update user points balance
  UPDATE public.customer_users 
  SET points = points + (NEW.total_price / 1000)
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic points award
CREATE TRIGGER award_points_trigger
  AFTER INSERT ON public.customer_orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered')
  EXECUTE FUNCTION public.award_points_for_order();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_customer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_customer_users_updated_at
  BEFORE UPDATE ON public.customer_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_updated_at();

CREATE TRIGGER update_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_updated_at();

-- Enable realtime for real-time features
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_locations;

-- Set replica identity for realtime
ALTER TABLE public.customer_orders REPLICA IDENTITY FULL;
ALTER TABLE public.rider_locations REPLICA IDENTITY FULL;