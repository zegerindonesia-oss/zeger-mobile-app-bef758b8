-- Ensure attendance triggers shift updates
DROP TRIGGER IF EXISTS trg_update_shift_on_attendance ON public.attendance;
CREATE TRIGGER trg_update_shift_on_attendance
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_shift_on_attendance();

-- Allow branch to send stock during current shift; only block if previous day has unresolved active shift
CREATE OR REPLACE FUNCTION public.can_receive_stock(rider_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT NOT EXISTS(
    SELECT 1 FROM public.shift_management 
    WHERE rider_id = rider_uuid 
      AND status = 'active'
      AND report_submitted = false
      AND shift_date < CURRENT_DATE
  );
$function$;