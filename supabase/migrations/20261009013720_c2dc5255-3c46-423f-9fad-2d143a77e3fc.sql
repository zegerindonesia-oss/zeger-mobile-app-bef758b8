-- 1) Award loyalty points when a customer app order is actually completed,
--    using the configurable earning rule (award_loyalty_points) instead of a hardcoded rate.
CREATE OR REPLACE FUNCTION public.award_points_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.total_price, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- never award twice for the same order
  IF EXISTS (SELECT 1 FROM public.customer_points_history h WHERE h.order_id = NEW.id AND h.change > 0) THEN
    RETURN NEW;
  END IF;

  PERFORM public.award_loyalty_points(
    NEW.user_id,
    NEW.total_price,
    'customer_app_order',
    NEW.id::text,
    'Poin dari pesanan aplikasi'
  );

  UPDATE public.customer_points_history
     SET order_id = NEW.id
   WHERE source = 'customer_app_order'
     AND reference_id = NEW.id::text
     AND order_id IS NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS award_points_trigger ON public.customer_orders;

CREATE TRIGGER award_points_on_insert
AFTER INSERT ON public.customer_orders
FOR EACH ROW
WHEN (NEW.status IN ('delivered', 'completed'))
EXECUTE FUNCTION public.award_points_for_order();

CREATE TRIGGER award_points_on_complete
AFTER UPDATE ON public.customer_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('delivered', 'completed'))
EXECUTE FUNCTION public.award_points_for_order();

-- 2) Spending points at checkout must be atomic and recorded in the points history.
CREATE OR REPLACE FUNCTION public.spend_customer_points(_order_id uuid, _points integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _member uuid;
  _balance integer;
BEGIN
  IF _points IS NULL OR _points <= 0 THEN
    RAISE EXCEPTION 'Jumlah poin tidak valid';
  END IF;

  SELECT id INTO _member FROM public.customer_users WHERE user_id = auth.uid() LIMIT 1;
  IF _member IS NULL THEN
    RAISE EXCEPTION 'Akun customer tidak ditemukan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customer_orders o WHERE o.id = _order_id AND o.user_id = _member) THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan';
  END IF;

  -- idempotent: the same order can only burn points once
  IF EXISTS (
    SELECT 1 FROM public.customer_points_history h
     WHERE h.source = 'order_points_redeem' AND h.reference_id = _order_id::text
  ) THEN
    SELECT COALESCE(points, 0) INTO _balance FROM public.customer_users WHERE id = _member;
    RETURN _balance;
  END IF;

  SELECT COALESCE(points, 0) INTO _balance FROM public.customer_users WHERE id = _member FOR UPDATE;
  IF _balance < _points THEN
    RAISE EXCEPTION 'Poin tidak mencukupi';
  END IF;

  UPDATE public.customer_users SET points = _balance - _points WHERE id = _member;

  INSERT INTO public.customer_points_history (user_id, change, description, source, reference_id, order_id, status)
  VALUES (_member, -_points, 'Potongan poin untuk pesanan', 'order_points_redeem', _order_id::text, _order_id, 'redeemed');

  RETURN _balance - _points;
END;
$function$;

REVOKE ALL ON FUNCTION public.spend_customer_points(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_customer_points(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_customer_points(uuid, integer) TO service_role;