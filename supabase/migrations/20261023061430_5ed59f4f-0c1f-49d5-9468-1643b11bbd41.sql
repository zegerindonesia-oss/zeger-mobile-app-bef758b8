ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS table_number text;

CREATE OR REPLACE FUNCTION public.get_table_qr_info(_branch_id uuid, _table text)
RETURNS TABLE(branch_id uuid, branch_name text, branch_address text, table_number text, table_exists boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.name, b.address, _table,
    EXISTS (SELECT 1 FROM public.pos_tables t WHERE t.branch_id = b.id AND t.table_number = _table AND t.is_active)
  FROM public.branches b WHERE b.id = _branch_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_table_qr_info(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_table_from_customer_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.table_number IS NULL OR NEW.outlet_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IN ('pending_payment','cancelled','rejected') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending_payment') THEN RETURN NEW; END IF;
  UPDATE public.pos_tables SET
    status = CASE WHEN status = 'available' OR status = 'reserved' THEN 'occupied' ELSE status END,
    occupied_at = COALESCE(occupied_at, now()),
    current_total = COALESCE(current_total, 0) + COALESCE(NEW.total_price, 0),
    guest_name = COALESCE(guest_name, 'Order App')
  WHERE branch_id = NEW.outlet_id AND table_number = NEW.table_number AND is_active AND merged_into IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mark_table_from_customer_order ON public.customer_orders;
CREATE TRIGGER trg_mark_table_from_customer_order
AFTER INSERT OR UPDATE OF status ON public.customer_orders
FOR EACH ROW EXECUTE FUNCTION public.mark_table_from_customer_order();