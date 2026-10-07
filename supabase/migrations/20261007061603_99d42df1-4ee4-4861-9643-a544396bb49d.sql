REVOKE EXECUTE ON FUNCTION public.has_procurement_access() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid, jsonb, text, date, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_po_paid() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.has_procurement_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, jsonb, text, date, integer) TO authenticated;