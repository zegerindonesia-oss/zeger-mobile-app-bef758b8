-- Create checkpoints table for rider location tracking
CREATE TABLE public.checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  checkpoint_name TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS for checkpoints
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

-- Create policies for checkpoints
CREATE POLICY "Riders can create own checkpoints" 
ON public.checkpoints 
FOR INSERT 
WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = rider_id));

CREATE POLICY "Users can view relevant checkpoints" 
ON public.checkpoints 
FOR SELECT 
USING (
  has_role('ho_admin'::user_role) OR 
  (has_role('branch_manager'::user_role) AND branch_id = get_current_user_branch()) OR
  (has_role('rider'::user_role) AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Create daily_operational_expenses table for rider expenses
CREATE TABLE public.daily_operational_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL,
  shift_id UUID,
  expense_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  receipt_photo_url TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for daily_operational_expenses
ALTER TABLE public.daily_operational_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_operational_expenses
CREATE POLICY "Riders can create own expenses" 
ON public.daily_operational_expenses 
FOR INSERT 
WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = rider_id));

CREATE POLICY "Riders can update own expenses" 
ON public.daily_operational_expenses 
FOR UPDATE 
USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = rider_id));

CREATE POLICY "Users can view relevant expenses" 
ON public.daily_operational_expenses 
FOR SELECT 
USING (
  has_role('ho_admin'::user_role) OR 
  (has_role('branch_manager'::user_role) AND shift_id IN (
    SELECT id FROM shift_management WHERE branch_id = get_current_user_branch()
  )) OR
  (has_role('rider'::user_role) AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Add payment proof columns to transactions
ALTER TABLE public.transactions 
ADD COLUMN payment_proof_url TEXT,
ADD COLUMN payment_verified BOOLEAN DEFAULT false,
ADD COLUMN payment_verified_by UUID,
ADD COLUMN payment_verified_at TIMESTAMP WITH TIME ZONE;

-- Create storage buckets for new photo requirements
INSERT INTO storage.buckets (id, name, public) VALUES ('checkpoint-photos', 'checkpoint-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false);

-- Create policies for checkpoint-photos bucket
CREATE POLICY "Riders can upload checkpoint photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'checkpoint-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view relevant checkpoint photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'checkpoint-photos');

-- Create policies for payment-proofs bucket
CREATE POLICY "Riders can upload payment proofs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view payment proofs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'payment-proofs');

-- Create policies for expense-receipts bucket
CREATE POLICY "Riders can upload expense receipts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view expense receipts" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'expense-receipts');