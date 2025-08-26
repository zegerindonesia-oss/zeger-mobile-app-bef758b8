-- Create customers table for customer management
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  branch_id UUID REFERENCES public.branches(id),
  rider_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS for customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Add location tracking fields to transactions table (excluding customer_id since it exists)
ALTER TABLE public.transactions 
ADD COLUMN transaction_latitude NUMERIC,
ADD COLUMN transaction_longitude NUMERIC,
ADD COLUMN location_name TEXT;

-- Create policies for customers table
CREATE POLICY "Users can view relevant customers" 
ON public.customers 
FOR SELECT 
USING (
  has_role('ho_admin'::user_role) OR 
  (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch()) OR
  (has_role('rider'::user_role) AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

CREATE POLICY "Riders can create customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  has_role('rider'::user_role) AND 
  rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update relevant customers" 
ON public.customers 
FOR UPDATE 
USING (
  has_role('ho_admin'::user_role) OR 
  (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch()) OR
  (has_role('rider'::user_role) AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Create trigger for customers updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_customers_rider_id ON public.customers(rider_id);
CREATE INDEX idx_customers_branch_id ON public.customers(branch_id);
CREATE INDEX idx_transactions_location ON public.transactions(transaction_latitude, transaction_longitude);
CREATE INDEX idx_transactions_customer_id ON public.transactions(customer_id);