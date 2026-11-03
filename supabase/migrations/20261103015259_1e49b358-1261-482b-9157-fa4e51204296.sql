ALTER TABLE public.pos_branch_settings ADD COLUMN IF NOT EXISTS queue_reset text NOT NULL DEFAULT 'daily';
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS queue_number integer;

CREATE OR REPLACE FUNCTION public.assign_pos_queue_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _mode text; _n integer;
BEGIN
  IF NEW.queue_number IS NOT NULL OR NEW.branch_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(queue_reset,'daily') INTO _mode FROM pos_branch_settings WHERE branch_id = NEW.branch_id;
  _mode := COALESCE(_mode,'daily');
  PERFORM pg_advisory_xact_lock(hashtext('posq'||NEW.branch_id::text));
  IF _mode = 'shift' AND NEW.shift_id IS NOT NULL THEN
    SELECT COALESCE(MAX(queue_number),0)+1 INTO _n FROM pos_transactions WHERE branch_id = NEW.branch_id AND shift_id = NEW.shift_id;
  ELSIF _mode = 'continuous' THEN
    SELECT COALESCE(MAX(queue_number),0)+1 INTO _n FROM pos_transactions WHERE branch_id = NEW.branch_id;
  ELSE
    SELECT COALESCE(MAX(queue_number),0)+1 INTO _n FROM pos_transactions WHERE branch_id = NEW.branch_id
      AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;
  NEW.queue_number := _n;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_pos_queue_number ON public.pos_transactions;
CREATE TRIGGER trg_assign_pos_queue_number BEFORE INSERT ON public.pos_transactions
FOR EACH ROW EXECUTE FUNCTION public.assign_pos_queue_number();