
ALTER TABLE public.product_price_history ALTER COLUMN changed_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
BEGIN
  SELECT id INTO v_user FROM public.profiles WHERE id = auth.uid();

  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO product_price_history (product_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'price', OLD.price, NEW.price, v_user);
  END IF;

  IF OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
    INSERT INTO product_price_history (product_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'cost_price', OLD.cost_price, NEW.cost_price, v_user);
  END IF;

  IF OLD.ck_price IS DISTINCT FROM NEW.ck_price THEN
    INSERT INTO product_price_history (product_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'ck_price', OLD.ck_price, NEW.ck_price, v_user);
  END IF;

  RETURN NEW;
END;
$function$;
