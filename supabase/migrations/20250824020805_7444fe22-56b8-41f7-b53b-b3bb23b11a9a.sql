-- Harden can_receive_stock with explicit search_path
CREATE OR REPLACE FUNCTION public.can_receive_stock(rider_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS(
    SELECT 1 FROM public.shift_management 
    WHERE rider_id = rider_uuid 
      AND status = 'active'
      AND report_submitted = false
      AND shift_date < CURRENT_DATE
  );
$function$;