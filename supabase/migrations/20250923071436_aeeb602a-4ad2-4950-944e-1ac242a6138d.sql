-- Add RLS policy to allow bh_report users to read their assigned rider's profile
CREATE POLICY "BH Report users can view assigned rider profile" 
ON public.profiles 
FOR SELECT 
USING (
  has_role('bh_report'::user_role) AND 
  id = get_assigned_rider_id()
);