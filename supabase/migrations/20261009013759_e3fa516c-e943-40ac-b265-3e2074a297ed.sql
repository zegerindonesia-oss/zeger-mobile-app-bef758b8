-- Trigger functions must not be callable through the API.
REVOKE ALL ON FUNCTION public.award_points_for_order() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_points_for_order() TO service_role;

-- The points-spending RPC stays callable only by signed-in customers.
REVOKE ALL ON FUNCTION public.spend_customer_points(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_customer_points(uuid, integer) TO authenticated, service_role;