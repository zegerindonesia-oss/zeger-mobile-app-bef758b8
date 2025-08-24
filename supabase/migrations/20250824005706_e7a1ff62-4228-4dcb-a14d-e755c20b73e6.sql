-- Create trigger to update shifts on attendance changes
DROP TRIGGER IF EXISTS trg_update_shift_on_attendance ON public.attendance;
CREATE TRIGGER trg_update_shift_on_attendance
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_shift_on_attendance();