-- The membership check only needs the caller's own customer row, which row
-- level security already exposes to them, so it does not need elevated rights.
CREATE OR REPLACE FUNCTION public.is_customer_member(_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT _member_id IS NOT NULL AND (
    _member_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.customer_users cu WHERE cu.id = _member_id AND cu.user_id = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.is_customer_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_customer_member(uuid) TO authenticated, service_role;