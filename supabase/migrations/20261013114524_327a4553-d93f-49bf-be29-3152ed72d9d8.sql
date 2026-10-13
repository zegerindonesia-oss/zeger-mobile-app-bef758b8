CREATE OR REPLACE FUNCTION public.get_public_receipt(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'transaction_number', t.transaction_number, 'created_at', t.created_at, 'order_type', t.order_type,
    'table_number', t.table_number, 'customer_name', t.customer_name, 'subtotal', t.subtotal,
    'discount', coalesce(t.discount_item,0) + coalesce(t.discount_bill,0), 'service_charge', t.service_charge,
    'tax', t.tax, 'total', t.total, 'payment_method_1', t.payment_method_1, 'amount_1', t.amount_1,
    'payment_method_2', t.payment_method_2, 'amount_2', t.amount_2, 'change_amount', t.change_amount,
    'status', t.status, 'branch_name', b.name,
    'layout', ps.config -> 'layout', 'footer', ps.config ->> 'receiptFooter',
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('product_name', i.product_name, 'qty', i.qty, 'price', i.price, 'subtotal', i.subtotal_item, 'notes', i.notes) ORDER BY i.created_at)
                       FROM pos_transaction_items i WHERE i.transaction_id = t.id), '[]'::jsonb))
  FROM pos_transactions t
  LEFT JOIN branches b ON b.id = t.branch_id
  LEFT JOIN pos_printer_settings ps ON ps.branch_id = t.branch_id
  WHERE t.id = _id;
$$;
REVOKE ALL ON FUNCTION public.get_public_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(uuid) TO anon, authenticated;