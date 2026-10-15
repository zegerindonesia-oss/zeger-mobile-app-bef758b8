CREATE OR REPLACE FUNCTION public.can_access_rider_row(_rider uuid, _hub uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()
    AND (p.id = _rider OR p.branch_id = _hub)) OR public.is_ho_user()
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_rider_row(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_rider_row(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_own_profile(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = _pid AND user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_own_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_own_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "rsr select" ON public.rider_stock_requests;
DROP POLICY IF EXISTS "rsr rider insert" ON public.rider_stock_requests;
DROP POLICY IF EXISTS "rsr rider cancel" ON public.rider_stock_requests;
CREATE POLICY "rsr select" ON public.rider_stock_requests FOR SELECT TO authenticated
  USING (public.can_access_rider_row(rider_id, hub_branch_id));
CREATE POLICY "rsr rider insert" ON public.rider_stock_requests FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND public.is_own_profile(rider_id));
CREATE POLICY "rsr update" ON public.rider_stock_requests FOR UPDATE TO authenticated
  USING (public.can_access_rider_row(rider_id, hub_branch_id) AND status IN ('pending','adjusted'))
  WITH CHECK (status IN ('pending','adjusted','cancelled','rejected'));

ALTER TABLE public.rider_stock_request_items REPLICA IDENTITY FULL;