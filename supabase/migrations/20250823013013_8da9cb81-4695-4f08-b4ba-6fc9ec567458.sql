-- Add comprehensive status tracking and shift management to stock movements
-- Add proper status fields and shift validation logic

-- First, add missing RLS policy for transaction_items table
CREATE POLICY "Users can view relevant transaction items" 
ON public.transaction_items 
FOR SELECT 
TO authenticated
USING (
  -- HO Admin can see all
  get_current_user_role() = 'ho_admin'::user_role
  OR
  -- Branch managers can see items from their branch
  (get_current_user_role() = 'branch_manager'::user_role 
   AND transaction_id IN (
     SELECT id FROM transactions 
     WHERE branch_id = get_current_user_branch()
   ))
  OR
  -- Riders can see their own transaction items
  (get_current_user_role() = 'rider'::user_role 
   AND transaction_id IN (
     SELECT id FROM transactions 
     WHERE rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
   ))
  OR
  -- Customers can see their own transaction items
  (get_current_user_role() = 'customer'::user_role 
   AND transaction_id IN (
     SELECT id FROM transactions 
     WHERE customer_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
   ))
);

-- Add status field to stock_movements for better tracking
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add verification photo URL field
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS verification_photo_url TEXT;

-- Add expected delivery date
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP WITH TIME ZONE;

-- Add actual delivery date  
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS actual_delivery_date TIMESTAMP WITH TIME ZONE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON public.stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_rider_status ON public.stock_movements(rider_id, status);

-- Create shift management table for tracking active shifts
CREATE TABLE IF NOT EXISTS public.shift_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_number INTEGER NOT NULL DEFAULT 1,
  shift_start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  shift_end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  cash_collected NUMERIC DEFAULT 0,
  total_sales NUMERIC DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  report_submitted BOOLEAN DEFAULT false,
  report_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(rider_id, shift_date, shift_number)
);

-- Enable RLS on shift_management
ALTER TABLE public.shift_management ENABLE ROW LEVEL SECURITY;

-- RLS policies for shift_management
CREATE POLICY "Riders can view own shifts" 
ON public.shift_management 
FOR SELECT 
TO authenticated
USING (
  get_current_user_role() = 'rider'::user_role 
  AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Riders can create own shifts" 
ON public.shift_management 
FOR INSERT 
TO authenticated
WITH CHECK (
  get_current_user_role() = 'rider'::user_role 
  AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Riders can update own shifts" 
ON public.shift_management 
FOR UPDATE 
TO authenticated
USING (
  get_current_user_role() = 'rider'::user_role 
  AND rider_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Staff can manage shifts in their scope" 
ON public.shift_management 
FOR ALL 
TO authenticated
USING (
  get_current_user_role() = 'ho_admin'::user_role
  OR 
  (get_current_user_role() = 'branch_manager'::user_role 
   AND branch_id = get_current_user_branch())
);

-- Function to check if rider has active shift
CREATE OR REPLACE FUNCTION public.has_active_shift(rider_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.shift_management 
    WHERE rider_id = rider_uuid 
    AND shift_date = CURRENT_DATE
    AND status = 'active'
    AND shift_end_time IS NULL
  );
$$;

-- Function to check if rider can receive stock (no active incomplete shift)
CREATE OR REPLACE FUNCTION public.can_receive_stock(rider_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS(
    SELECT 1 FROM public.shift_management 
    WHERE rider_id = rider_uuid 
    AND status = 'active'
    AND report_submitted = false
  );
$$;

-- Trigger to automatically update shift_management when attendance changes
CREATE OR REPLACE FUNCTION public.update_shift_on_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When rider checks in, create new shift if none exists
  IF NEW.status = 'checked_in' AND OLD.status IS DISTINCT FROM 'checked_in' THEN
    INSERT INTO public.shift_management (
      rider_id, 
      branch_id, 
      shift_date, 
      shift_start_time,
      status
    ) VALUES (
      NEW.rider_id,
      NEW.branch_id,
      NEW.work_date,
      NEW.check_in_time,
      'active'
    )
    ON CONFLICT (rider_id, shift_date, shift_number) 
    DO UPDATE SET 
      shift_start_time = NEW.check_in_time,
      status = 'active';
  END IF;
  
  -- When rider checks out, update shift end time but keep status active until report
  IF NEW.status = 'checked_out' AND OLD.status = 'checked_in' THEN
    UPDATE public.shift_management 
    SET shift_end_time = NEW.check_out_time
    WHERE rider_id = NEW.rider_id 
    AND shift_date = NEW.work_date
    AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for attendance updates
DROP TRIGGER IF EXISTS trigger_update_shift_on_attendance ON public.attendance;
CREATE TRIGGER trigger_update_shift_on_attendance
  AFTER UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shift_on_attendance();

-- Update updated_at trigger for shift_management
CREATE TRIGGER update_shift_management_updated_at
  BEFORE UPDATE ON public.shift_management
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();