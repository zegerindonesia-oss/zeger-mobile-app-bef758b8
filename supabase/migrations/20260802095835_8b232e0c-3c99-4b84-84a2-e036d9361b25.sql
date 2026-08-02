CREATE OR REPLACE FUNCTION public.confirm_rider_stock_receipt(_movement_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  inv_id uuid;
  cnt integer := 0;
BEGIN
  FOR m IN
    SELECT * FROM public.stock_movements
    WHERE id = ANY(_movement_ids)
      AND movement_type = 'transfer'
      AND rider_id IS NOT NULL
      AND COALESCE(status, '') <> 'received'
    FOR UPDATE
  LOOP
    UPDATE public.stock_movements
      SET status = 'received',
          actual_delivery_date = now(),
          notes = COALESCE(notes, 'Stok diterima dan dikonfirmasi oleh rider')
      WHERE id = m.id;

    SELECT id INTO inv_id FROM public.inventory
      WHERE rider_id = m.rider_id AND product_id = m.product_id
      ORDER BY last_updated DESC NULLS LAST LIMIT 1;

    IF inv_id IS NOT NULL THEN
      UPDATE public.inventory
        SET stock_quantity = COALESCE(stock_quantity, 0) + m.quantity,
            last_updated = now()
        WHERE id = inv_id;
    ELSE
      INSERT INTO public.inventory (rider_id, branch_id, product_id, stock_quantity, last_updated)
      VALUES (m.rider_id, m.branch_id, m.product_id, m.quantity, now());
    END IF;

    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_rider_stock_receipt(uuid[]) TO authenticated;

-- Backfill: Matcha Latte 8 pcs for Z-005 Pak Tri (confirmed but never applied to inventory)
UPDATE public.inventory
SET stock_quantity = COALESCE(stock_quantity, 0) + 8,
    last_updated = now()
WHERE id = 'fcb36d66-f14d-4c03-8f10-26f5cf4a15df';