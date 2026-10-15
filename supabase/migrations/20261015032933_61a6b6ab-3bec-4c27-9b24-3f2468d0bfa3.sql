CREATE TABLE public.rider_stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  rider_id uuid NOT NULL REFERENCES public.profiles(id),
  hub_branch_id uuid NOT NULL REFERENCES public.branches(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  hub_notes text,
  total_transfer_value numeric NOT NULL DEFAULT 0,
  processed_by uuid,
  transferred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rider_stock_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.rider_stock_requests(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  requested_qty integer NOT NULL,
  approved_qty integer,
  transfer_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rider_stock_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rider_stock_request_items TO authenticated;
GRANT ALL ON public.rider_stock_requests TO service_role;
GRANT ALL ON public.rider_stock_request_items TO service_role;
ALTER TABLE public.rider_stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_stock_request_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_rider_request(_req uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM rider_stock_requests r JOIN profiles p ON p.user_id = auth.uid()
    WHERE r.id = _req AND (r.rider_id = p.id OR p.branch_id = r.hub_branch_id OR public.is_ho_user()))
$$;

CREATE POLICY "rsr select" ON public.rider_stock_requests FOR SELECT TO authenticated
  USING (public.can_access_rider_request(id));
CREATE POLICY "rsr rider insert" ON public.rider_stock_requests FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND rider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "rsr rider cancel" ON public.rider_stock_requests FOR UPDATE TO authenticated
  USING (public.can_access_rider_request(id) AND status IN ('pending','adjusted'))
  WITH CHECK (status IN ('pending','adjusted','cancelled','rejected'));
CREATE POLICY "rsri select" ON public.rider_stock_request_items FOR SELECT TO authenticated
  USING (public.can_access_rider_request(request_id));
CREATE POLICY "rsri write" ON public.rider_stock_request_items FOR ALL TO authenticated
  USING (public.can_access_rider_request(request_id) AND EXISTS (SELECT 1 FROM rider_stock_requests r WHERE r.id=request_id AND r.status IN ('pending','adjusted')))
  WITH CHECK (public.can_access_rider_request(request_id) AND EXISTS (SELECT 1 FROM rider_stock_requests r WHERE r.id=request_id AND r.status IN ('pending','adjusted')));

CREATE TRIGGER rsr_updated BEFORE UPDATE ON public.rider_stock_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hub fulfils: creates 'sent' stock movements (existing rider confirmation flow) at CK transfer price
CREATE OR REPLACE FUNCTION public.fulfill_rider_stock_request(_request_id uuid, _hub_notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r rider_stock_requests; me profiles; n integer := 0; total numeric := 0;
BEGIN
  SELECT * INTO me FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT * INTO r FROM rider_stock_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Permintaan tidak ditemukan'; END IF;
  IF NOT (me.branch_id = r.hub_branch_id OR public.is_ho_user()) THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  IF r.status NOT IN ('pending','adjusted') THEN RAISE EXCEPTION 'Permintaan sudah diproses'; END IF;

  UPDATE rider_stock_request_items i SET
    approved_qty = COALESCE(i.approved_qty, i.requested_qty),
    transfer_price = COALESCE(NULLIF(p.ck_price,0), p.cost_price, 0)
  FROM products p WHERE p.id = i.product_id AND i.request_id = _request_id;

  INSERT INTO stock_movements (product_id, quantity, movement_type, branch_id, rider_id, created_by, status, reference_type, reference_id, notes, expected_delivery_date, tenant_id)
  SELECT i.product_id, i.approved_qty, 'transfer', r.hub_branch_id, r.rider_id, me.id, 'sent', 'rider_request', r.id,
         'Order rider ke Central Kitchen', now() + interval '1 hour', r.tenant_id
  FROM rider_stock_request_items i WHERE i.request_id = _request_id AND i.approved_qty > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'Tidak ada item untuk dikirim'; END IF;

  SELECT COALESCE(SUM(approved_qty * transfer_price),0) INTO total FROM rider_stock_request_items WHERE request_id = _request_id;
  UPDATE rider_stock_requests SET status='transferred', processed_by=me.id, transferred_at=now(),
    hub_notes=COALESCE(_hub_notes, hub_notes), total_transfer_value=total WHERE id=_request_id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.fulfill_rider_stock_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_rider_request(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_stock_requests;