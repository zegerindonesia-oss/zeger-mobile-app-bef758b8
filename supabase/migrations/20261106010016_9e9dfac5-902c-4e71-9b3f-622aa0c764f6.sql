ALTER TABLE public.pos_kds_tickets ADD COLUMN IF NOT EXISTS queue_number integer;

-- 1. Ticket creation carries queue number; items are attached as they arrive.
CREATE OR REPLACE FUNCTION public.auto_create_kds_ticket() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_ticket_id uuid;
BEGIN
  IF NEW.status NOT IN ('paid','preparing') OR NEW.order_type = 'internal' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM pos_kds_tickets WHERE transaction_id = NEW.id) THEN RETURN NEW; END IF;
  INSERT INTO pos_kds_tickets (transaction_id, branch_id, status, order_type, table_number,
    external_order_id, customer_name, transaction_number, notes, queue_number)
  VALUES (NEW.id, NEW.branch_id, 'queued', NEW.order_type, NEW.table_number,
    NEW.external_order_id, NEW.customer_name, NEW.transaction_number, NEW.notes, NEW.queue_number)
  RETURNING id INTO new_ticket_id;
  INSERT INTO pos_kds_ticket_items (ticket_id, product_id, product_name, qty, notes)
  SELECT new_ticket_id, ti.product_id, ti.product_name, ti.qty, ti.notes
  FROM pos_transaction_items ti WHERE ti.transaction_id = NEW.id;
  UPDATE pos_transactions SET kitchen_status = 'preparing' WHERE id = NEW.id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kds_attach_transaction_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  SELECT id INTO tid FROM pos_kds_tickets WHERE transaction_id = NEW.transaction_id
    AND status IN ('queued','cooking','ready') ORDER BY created_at LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pos_kds_ticket_items WHERE ticket_id = tid AND product_name = NEW.product_name
      AND qty = NEW.qty AND coalesce(notes,'') = coalesce(NEW.notes,'') AND created_at > now() - interval '5 seconds') THEN
    INSERT INTO pos_kds_ticket_items (ticket_id, product_id, product_name, qty, notes)
    VALUES (tid, NEW.product_id, NEW.product_name, NEW.qty, NEW.notes);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_kds_attach_item ON public.pos_transaction_items;
CREATE TRIGGER trg_kds_attach_item AFTER INSERT ON public.pos_transaction_items
FOR EACH ROW EXECUTE FUNCTION public.kds_attach_transaction_item();

-- Backfill empty tickets + queue numbers
INSERT INTO public.pos_kds_ticket_items (ticket_id, product_id, product_name, qty, notes)
SELECT t.id, ti.product_id, ti.product_name, ti.qty, ti.notes
FROM public.pos_kds_tickets t JOIN public.pos_transaction_items ti ON ti.transaction_id = t.transaction_id
WHERE NOT EXISTS (SELECT 1 FROM public.pos_kds_ticket_items x WHERE x.ticket_id = t.id);
UPDATE public.pos_kds_tickets t SET queue_number = p.queue_number
FROM public.pos_transactions p WHERE p.id = t.transaction_id AND t.queue_number IS NULL;

-- 2. Notify app member when ready
CREATE OR REPLACE FUNCTION public.kds_notify_ready() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid; q text;
BEGIN
  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' THEN
    UPDATE pos_transactions SET kitchen_status = 'ready' WHERE id = NEW.transaction_id;
    SELECT member_id INTO mid FROM pos_transactions WHERE id = NEW.transaction_id;
    IF mid IS NOT NULL THEN
      q := coalesce(lpad(NEW.queue_number::text,3,'0'), right(coalesce(NEW.transaction_number,''),4));
      INSERT INTO customer_notifications (user_id, title, body, link)
      VALUES (mid, 'Pesanan #'||q||' siap diambil', 'Pesanan Anda sudah selesai dan bisa diambil di counter.', '/customer-app');
    END IF;
  ELSIF NEW.status = 'served' AND OLD.status IS DISTINCT FROM 'served' THEN
    UPDATE pos_transactions SET kitchen_status = 'served' WHERE id = NEW.transaction_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_kds_notify_ready ON public.pos_kds_tickets;
CREATE TRIGGER trg_kds_notify_ready AFTER UPDATE OF status ON public.pos_kds_tickets
FOR EACH ROW EXECUTE FUNCTION public.kds_notify_ready();

-- 3. Kiosk pairing
CREATE TABLE IF NOT EXISTS public.pos_kds_devices (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pos_kds_devices TO service_role;
ALTER TABLE public.pos_kds_devices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.kds_pairing_token(_branch_id uuid, _rotate boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tok uuid; ok boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()
    AND (p.role::text IN ('ho_admin','1_HO_Admin','ho_owner','1_HO_Owner') OR p.branch_id = _branch_id)) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Tidak punya akses cabang ini'; END IF;
  IF _rotate THEN DELETE FROM pos_kds_devices WHERE branch_id = _branch_id; END IF;
  INSERT INTO pos_kds_devices (branch_id) VALUES (_branch_id) ON CONFLICT (branch_id) DO NOTHING;
  SELECT token INTO tok FROM pos_kds_devices WHERE branch_id = _branch_id;
  RETURN tok;
END $$;

CREATE OR REPLACE FUNCTION public.kds_kiosk_tickets(_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'branch_id', d.branch_id,
    'branch_name', (SELECT name FROM branches WHERE id = d.branch_id),
    'tickets', coalesce((SELECT jsonb_agg(to_jsonb(t) || jsonb_build_object('items', coalesce((
        SELECT jsonb_agg(to_jsonb(i) || jsonb_build_object('category', pr.category) ORDER BY i.created_at)
        FROM pos_kds_ticket_items i LEFT JOIN products pr ON pr.id = i.product_id WHERE i.ticket_id = t.id),'[]'::jsonb))
        ORDER BY t.created_at)
      FROM pos_kds_tickets t WHERE t.branch_id = d.branch_id AND t.status IN ('queued','cooking','ready')
        AND t.created_at >= now() - interval '24 hours'), '[]'::jsonb),
    'recent', coalesce((SELECT jsonb_agg(to_jsonb(t) || '{"items":[]}'::jsonb ORDER BY t.served_at DESC)
      FROM (SELECT * FROM pos_kds_tickets WHERE branch_id = d.branch_id AND status = 'served'
        AND served_at >= now() - interval '2 hours' ORDER BY served_at DESC LIMIT 20) t), '[]'::jsonb))
  FROM pos_kds_devices d WHERE d.token = _token;
$$;

CREATE OR REPLACE FUNCTION public.kds_kiosk_update(_token uuid, _ticket_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  SELECT branch_id INTO b FROM pos_kds_devices WHERE token = _token;
  IF b IS NULL THEN RAISE EXCEPTION 'Perangkat tidak terhubung'; END IF;
  IF _status NOT IN ('queued','cooking','ready','served','cancelled') THEN RAISE EXCEPTION 'Status tidak valid'; END IF;
  UPDATE pos_kds_tickets SET status = _status,
    started_at = CASE WHEN _status='cooking' THEN now() ELSE started_at END,
    ready_at = CASE WHEN _status='ready' THEN now() ELSE ready_at END,
    served_at = CASE WHEN _status='served' THEN now() WHEN _status='ready' THEN NULL ELSE served_at END
  WHERE id = _ticket_id AND branch_id = b;
END $$;

CREATE OR REPLACE FUNCTION public.kds_kiosk_toggle_item(_token uuid, _item_id uuid, _done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  SELECT branch_id INTO b FROM pos_kds_devices WHERE token = _token;
  IF b IS NULL THEN RAISE EXCEPTION 'Perangkat tidak terhubung'; END IF;
  UPDATE pos_kds_ticket_items i SET is_done = _done, done_at = CASE WHEN _done THEN now() END
  FROM pos_kds_tickets t WHERE i.id = _item_id AND t.id = i.ticket_id AND t.branch_id = b;
END $$;

GRANT EXECUTE ON FUNCTION public.kds_kiosk_tickets(uuid), public.kds_kiosk_update(uuid,uuid,text), public.kds_kiosk_toggle_item(uuid,uuid,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kds_pairing_token(uuid,boolean) TO authenticated;

-- TV shows queue number too
CREATE OR REPLACE FUNCTION public.get_queue_display(_branch_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'branch_name', (SELECT name FROM public.branches WHERE id = _branch_id),
    'video_url', (SELECT video_url FROM public.pos_display_settings WHERE branch_id = _branch_id),
    'media_items', COALESCE((SELECT media_items FROM public.pos_display_settings WHERE branch_id = _branch_id), '[]'::jsonb),
    'running_text', (SELECT running_text FROM public.pos_display_settings WHERE branch_id = _branch_id),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'status', t.status, 'table_number', t.table_number,
        'customer_name', split_part(COALESCE(t.customer_name, ''), ' ', 1),
        'transaction_number', t.transaction_number, 'queue_number', t.queue_number, 'created_at', t.created_at
      ) ORDER BY t.created_at)
      FROM public.pos_kds_tickets t
      WHERE t.branch_id = _branch_id AND t.status IN ('queued','cooking','ready')
        AND t.created_at >= now() - interval '12 hours'
    ), '[]'::jsonb)
  );
$$;