-- First drop all triggers that depend on the function
DROP TRIGGER IF EXISTS trigger_update_shift_on_attendance ON public.attendance;
DROP TRIGGER IF EXISTS trg_update_shift_on_attendance ON public.attendance;
DROP TRIGGER IF EXISTS update_shift_on_attendance_trigger ON public.attendance;

-- Now drop the function
DROP FUNCTION IF EXISTS public.update_shift_on_attendance();