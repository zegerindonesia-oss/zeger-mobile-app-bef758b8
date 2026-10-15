REVOKE EXECUTE ON FUNCTION public.fulfill_rider_stock_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_rider_request(uuid) FROM PUBLIC, anon;