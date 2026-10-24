DO $$
DECLARE result jsonb; request uuid:=gen_random_uuid(); pid uuid; old_total numeric; n integer;
BEGIN
 BEGIN
  SELECT id INTO pid FROM public.products WHERE name='(200ml) Americano' AND is_active AND show_in_customer_app LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'Test menu missing'; END IF;
  SELECT current_total INTO old_total FROM public.pos_tables WHERE branch_id='485c5e77-9c30-4429-ba16-90b92d3a5124' AND table_number='10';
  result:=public.submit_table_guest_order('485c5e77-9c30-4429-ba16-90b92d3a5124','10','Uji QR','081299998888',jsonb_build_array(jsonb_build_object('id',pid,'quantity',1,'customizations','{}'::jsonb)),request);
  IF (result->>'total')::int<>10000 THEN RAISE EXCEPTION 'Wrong server price'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pos_tables WHERE branch_id='485c5e77-9c30-4429-ba16-90b92d3a5124' AND table_number='10' AND status='occupied' AND current_total=old_total+10000 AND open_bill->'guest_request_ids' @> jsonb_build_array(request::text)) THEN RAISE EXCEPTION 'Bill not synced'; END IF;
  SELECT count(*) INTO n FROM public.pos_kds_ticket_items i JOIN public.pos_kds_tickets t ON t.id=i.ticket_id WHERE t.transaction_id=request AND i.product_id=pid AND i.qty=1;
  IF n<>1 THEN RAISE EXCEPTION 'Kitchen ticket missing'; END IF;
  result:=public.submit_table_guest_order('485c5e77-9c30-4429-ba16-90b92d3a5124','10','Uji QR','081299998888',jsonb_build_array(jsonb_build_object('id',pid,'quantity',1,'customizations','{}'::jsonb)),request);
  IF NOT coalesce((result->>'duplicate')::boolean,false) THEN RAISE EXCEPTION 'Duplicate guard failed'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='All guest order assertions passed; rolling test back';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN RAISE NOTICE 'Guest order assertions passed, test data rolled back';
 END;
END $$;