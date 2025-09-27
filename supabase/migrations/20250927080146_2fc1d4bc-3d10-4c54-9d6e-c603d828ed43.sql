-- Fix RLS policies to include sb_rider and bh_rider roles (corrected)

-- Helper function to check if user is any type of rider
CREATE OR REPLACE FUNCTION public.is_rider_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_current_user_role() IN ('rider', 'sb_rider', 'bh_rider');
$$;

-- Update customers policies (fix: use rider_id instead of created_by)
DROP POLICY IF EXISTS "Riders can create customers" ON public.customers;
CREATE POLICY "Riders can create customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can update their own customers" ON public.customers;
CREATE POLICY "Riders can update their own customers" 
ON public.customers 
FOR UPDATE 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can view their own customers" ON public.customers;
CREATE POLICY "Riders can view their own customers" 
ON public.customers 
FOR SELECT 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

-- Update other policies that use profile IDs correctly
DROP POLICY IF EXISTS "Riders can insert their own daily reports" ON public.daily_reports;
CREATE POLICY "Riders can insert their own daily reports" 
ON public.daily_reports 
FOR INSERT 
WITH CHECK (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can view their own daily reports" ON public.daily_reports;
CREATE POLICY "Riders can view their own daily reports" 
ON public.daily_reports 
FOR SELECT 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can insert their own inventory" ON public.inventory;
CREATE POLICY "Riders can insert their own inventory" 
ON public.inventory 
FOR INSERT 
WITH CHECK (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can update their own inventory" ON public.inventory;
CREATE POLICY "Riders can update their own inventory" 
ON public.inventory 
FOR UPDATE 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can view their own inventory" ON public.inventory;
CREATE POLICY "Riders can view their own inventory" 
ON public.inventory 
FOR SELECT 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can insert their own shifts" ON public.shift_management;
CREATE POLICY "Riders can insert their own shifts" 
ON public.shift_management 
FOR INSERT 
WITH CHECK (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can update their own shifts" ON public.shift_management;
CREATE POLICY "Riders can update their own shifts" 
ON public.shift_management 
FOR UPDATE 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can view their own shifts" ON public.shift_management;
CREATE POLICY "Riders can view their own shifts" 
ON public.shift_management 
FOR SELECT 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can confirm stock movements" ON public.stock_movements;
CREATE POLICY "Riders can confirm stock movements" 
ON public.stock_movements 
FOR UPDATE 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can create return movements" ON public.stock_movements;
CREATE POLICY "Riders can create return movements" 
ON public.stock_movements 
FOR INSERT 
WITH CHECK (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()) AND 
  movement_type = 'return'
);

DROP POLICY IF EXISTS "Riders can view their own transactions" ON public.transactions;
CREATE POLICY "Riders can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (
  public.is_rider_role() AND 
  rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Riders can view their transaction items" ON public.transaction_items;
CREATE POLICY "Riders can view their transaction items" 
ON public.transaction_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = transaction_items.transaction_id 
    AND t.rider_id = ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
    AND public.is_rider_role()
  )
);