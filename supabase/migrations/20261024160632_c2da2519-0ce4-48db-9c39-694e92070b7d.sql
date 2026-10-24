CREATE OR REPLACE FUNCTION public.get_table_guest_menu(_branch_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'price',p.price,'image_url',p.image_url,'category',p.category,'sub_category',p.sub_category,'brand',p.brand,'custom_options',p.custom_options) ORDER BY p.name),'[]'::jsonb) FROM public.products p JOIN public.branches b ON b.id=_branch_id AND b.is_active AND b.tenant_id=p.tenant_id WHERE p.is_active AND p.show_in_customer_app;
$$;
REVOKE ALL ON FUNCTION public.get_table_guest_menu(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_guest_menu(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.ensure_phone_customer(_name text DEFAULT 'Member') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); ph text; mid uuid; other_owner uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
 SELECT regexp_replace(phone,'\D','','g') INTO ph FROM auth.users WHERE id=uid AND phone_confirmed_at IS NOT NULL;
 IF ph IS NULL OR ph='' THEN RAISE EXCEPTION 'Nomor HP belum diverifikasi'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(ph,0));
 SELECT id INTO mid FROM public.customer_users WHERE user_id=uid;
 IF mid IS NOT NULL THEN RETURN mid; END IF;
 SELECT id,user_id INTO mid,other_owner FROM public.customer_users WHERE regexp_replace(phone,'\D','','g') IN (ph,'0'||substr(ph,3)) FOR UPDATE;
 IF mid IS NOT NULL THEN
  IF other_owner IS NOT NULL AND other_owner<>uid THEN RAISE EXCEPTION 'Nomor ini sudah terhubung ke akun lain. Hubungi Zeger Care untuk penggabungan akun.'; END IF;
  UPDATE public.customer_users SET user_id=uid WHERE id=mid;
 ELSE
  INSERT INTO public.customer_users(user_id,phone,name,role) VALUES(uid,ph,coalesce(nullif(trim(_name),''),'Member'),'customer') RETURNING id INTO mid;
 END IF;
 RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.ensure_phone_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_phone_customer(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_table_guest_order(_branch_id uuid,_table text,_name text,_phone text,_items jsonb,_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tb public.pos_tables%ROWTYPE; tenant uuid; ph text; mid uuid; oid uuid; item jsonb; prod public.products%ROWTYPE; qty int; price int; total int:=0; opts jsonb; lines jsonb:='[]'; old_oid uuid; ticket uuid; top text;
BEGIN
 ph:=regexp_replace(coalesce(_phone,''),'\D','','g'); IF ph LIKE '0%' THEN ph:='62'||substr(ph,2); END IF;
 IF ph !~ '^628[0-9]{7,11}$' OR length(trim(_name)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Nama atau nomor HP tidak valid'; END IF;
 IF jsonb_typeof(_items)<>'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Keranjang tidak valid'; END IF;
 SELECT b.tenant_id INTO tenant FROM public.branches b WHERE b.id=_branch_id AND b.is_active;
 IF tenant IS NULL THEN RAISE EXCEPTION 'Outlet tidak aktif'; END IF;
 SELECT * INTO tb FROM public.pos_tables WHERE branch_id=_branch_id AND table_number=_table AND is_active AND merged_into IS NULL FOR UPDATE;
 IF tb.id IS NULL THEN RAISE EXCEPTION 'Meja tidak tersedia'; END IF;
 -- Idempotency is scoped to the table bill, never a public order lookup.
 IF coalesce(tb.open_bill->'guest_request_ids','[]') @> jsonb_build_array(_request_id::text) THEN RETURN jsonb_build_object('order_id',_request_id,'table',_table,'duplicate',true); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(ph,0));
 SELECT id INTO mid FROM public.customer_users WHERE tenant_id=tenant AND regexp_replace(phone,'\D','','g') IN (ph,'0'||substr(ph,3)) LIMIT 1;
 IF mid IS NOT NULL AND (SELECT count(*) FROM public.customer_orders WHERE user_id=mid AND created_at>now()-interval '5 minutes' AND table_number IS NOT NULL)>=3 THEN RAISE EXCEPTION 'Terlalu banyak pesanan. Tunggu beberapa menit.'; END IF;
 IF mid IS NULL THEN INSERT INTO public.customer_users(name,phone,role,tenant_id) VALUES(trim(_name),ph,'customer',tenant) RETURNING id INTO mid; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
  SELECT * INTO prod FROM public.products WHERE id=(item->>'id')::uuid AND tenant_id=tenant AND is_active AND show_in_customer_app;
  IF prod.id IS NULL THEN RAISE EXCEPTION 'Menu tidak tersedia'; END IF;
  qty:=(item->>'quantity')::int; IF qty IS NULL OR qty NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
  opts:=coalesce(item->'customizations','{}'); price:=prod.price;
  price:=price+CASE opts->>'size' WHEN 'large' THEN 5000 WHEN 'ultimate' THEN 10000 WHEN '1lt' THEN 15000 ELSE 0 END;
  FOR top IN SELECT DISTINCT value FROM jsonb_array_elements_text(coalesce(opts->'toppings','[]')) LOOP
   price:=price+CASE top WHEN 'espresso' THEN 5000 WHEN 'oreo' THEN 4000 WHEN 'cheese' THEN 5000 WHEN 'jelly' THEN 5000 WHEN 'icecream' THEN 5000 ELSE 0 END;
  END LOOP;
  total:=total+price*qty;
  lines:=lines||jsonb_build_array(jsonb_build_object('line_id',gen_random_uuid(),'product_id',prod.id,'product_code',prod.code,'product_name',prod.name,'category',prod.category,'size',opts->>'size','price',price,'qty',qty,'discount_item',0,'is_custom',false,'modifiers','[]'::jsonb,'notes',left(opts::text,1000)));
 END LOOP;
 INSERT INTO public.customer_orders(id,user_id,outlet_id,order_type,table_number,total_price,payment_method,status,tenant_id) VALUES(_request_id,mid,_branch_id,'outlet_pickup',_table,total,'pay_at_counter','pending',tenant) RETURNING id INTO oid;
 INSERT INTO public.customer_order_items(order_id,product_id,quantity,price,custom_options) SELECT oid,(l->>'product_id')::uuid,(l->>'qty')::int,(l->>'price')::int,jsonb_build_object('notes',l->>'notes') FROM jsonb_array_elements(lines) l;
 -- The existing occupancy trigger adds the total; retain the existing bill and append new lines.
 UPDATE public.pos_tables SET guest_name=coalesce(guest_name,trim(_name)), open_bill=coalesce(open_bill,'{}')||jsonb_build_object('items',coalesce(open_bill->'items','[]')||lines,'discount_bill',coalesce(open_bill->'discount_bill','0'),'guest_request_ids',coalesce(open_bill->'guest_request_ids','[]')||jsonb_build_array(_request_id::text)) WHERE id=tb.id;
 INSERT INTO public.pos_kds_tickets(transaction_id,branch_id,status,order_type,table_number,customer_name,transaction_number,external_order_id) VALUES(oid,_branch_id,'queued','dine_in',_table,trim(_name),'MEJA '||_table,oid::text) RETURNING id INTO ticket;
 INSERT INTO public.pos_kds_ticket_items(ticket_id,product_id,product_name,qty,notes) SELECT ticket,(l->>'product_id')::uuid,l->>'product_name',(l->>'qty')::int,l->>'notes' FROM jsonb_array_elements(lines) l;
 RETURN jsonb_build_object('order_id',oid,'table',_table,'total',total);
END $$;
REVOKE ALL ON FUNCTION public.submit_table_guest_order(uuid,text,text,text,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_table_guest_order(uuid,text,text,text,jsonb,uuid) TO anon,authenticated;