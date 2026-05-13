
-- KDS tickets
CREATE TABLE public.pos_kds_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued', -- queued | cooking | ready | served | cancelled
  order_type text,
  table_number text,
  external_order_id text,
  customer_name text,
  transaction_number text,
  notes text,
  started_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kds_tickets_branch_status ON public.pos_kds_tickets(branch_id, status);
CREATE INDEX idx_kds_tickets_txn ON public.pos_kds_tickets(transaction_id);

CREATE TABLE public.pos_kds_ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.pos_kds_tickets(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  notes text,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kds_items_ticket ON public.pos_kds_ticket_items(ticket_id);

ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS kitchen_status text DEFAULT 'pending';

-- updated_at trigger
CREATE TRIGGER tg_kds_tickets_updated
BEFORE UPDATE ON public.pos_kds_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.pos_kds_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_kds_ticket_items ENABLE ROW LEVEL SECURITY;

-- RLS: HO admin full access
CREATE POLICY "HO admin manage kds tickets" ON public.pos_kds_tickets
FOR ALL USING (has_role('ho_admin'::user_role)) WITH CHECK (has_role('ho_admin'::user_role));

CREATE POLICY "HO admin manage kds items" ON public.pos_kds_ticket_items
FOR ALL USING (has_role('ho_admin'::user_role)) WITH CHECK (has_role('ho_admin'::user_role));

-- Branch staff (manager + kasir) can view & update tickets at their branch
CREATE POLICY "Branch staff view kds tickets" ON public.pos_kds_tickets
FOR SELECT USING (
  branch_id = get_current_user_branch()
);

CREATE POLICY "Branch staff insert kds tickets" ON public.pos_kds_tickets
FOR INSERT WITH CHECK (
  branch_id = get_current_user_branch()
);

CREATE POLICY "Branch staff update kds tickets" ON public.pos_kds_tickets
FOR UPDATE USING (
  branch_id = get_current_user_branch()
) WITH CHECK (
  branch_id = get_current_user_branch()
);

CREATE POLICY "Branch staff view kds items" ON public.pos_kds_ticket_items
FOR SELECT USING (
  ticket_id IN (SELECT id FROM public.pos_kds_tickets WHERE branch_id = get_current_user_branch())
);

CREATE POLICY "Branch staff insert kds items" ON public.pos_kds_ticket_items
FOR INSERT WITH CHECK (
  ticket_id IN (SELECT id FROM public.pos_kds_tickets WHERE branch_id = get_current_user_branch())
);

CREATE POLICY "Branch staff update kds items" ON public.pos_kds_ticket_items
FOR UPDATE USING (
  ticket_id IN (SELECT id FROM public.pos_kds_tickets WHERE branch_id = get_current_user_branch())
) WITH CHECK (
  ticket_id IN (SELECT id FROM public.pos_kds_tickets WHERE branch_id = get_current_user_branch())
);

-- Auto-create KDS ticket when pos_transaction is paid or preparing
CREATE OR REPLACE FUNCTION public.auto_create_kds_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ticket_id uuid;
BEGIN
  -- Only create when newly paid or preparing, and not internal/test
  IF NEW.status NOT IN ('paid', 'preparing') THEN
    RETURN NEW;
  END IF;
  IF NEW.order_type = 'internal' THEN
    RETURN NEW;
  END IF;
  -- Skip if ticket already exists
  IF EXISTS (SELECT 1 FROM public.pos_kds_tickets WHERE transaction_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pos_kds_tickets (
    transaction_id, branch_id, status, order_type, table_number,
    external_order_id, customer_name, transaction_number, notes
  ) VALUES (
    NEW.id, NEW.branch_id, 'queued', NEW.order_type, NEW.table_number,
    NEW.external_order_id, NEW.customer_name, NEW.transaction_number, NEW.notes
  ) RETURNING id INTO new_ticket_id;

  INSERT INTO public.pos_kds_ticket_items (ticket_id, product_id, product_name, qty, notes)
  SELECT new_ticket_id, ti.product_id, ti.product_name, ti.qty, ti.notes
  FROM public.pos_transaction_items ti
  WHERE ti.transaction_id = NEW.id;

  UPDATE public.pos_transactions SET kitchen_status = 'preparing' WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_auto_create_kds_ticket
AFTER INSERT OR UPDATE OF status ON public.pos_transactions
FOR EACH ROW EXECUTE FUNCTION public.auto_create_kds_ticket();

-- Realtime
ALTER TABLE public.pos_kds_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.pos_kds_ticket_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_kds_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_kds_ticket_items;
