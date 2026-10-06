ALTER TABLE public.pos_display_settings ADD COLUMN IF NOT EXISTS media_items jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_queue_display(_branch_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'branch_name', (SELECT name FROM public.branches WHERE id = _branch_id),
    'video_url', (SELECT video_url FROM public.pos_display_settings WHERE branch_id = _branch_id),
    'media_items', COALESCE((SELECT media_items FROM public.pos_display_settings WHERE branch_id = _branch_id), '[]'::jsonb),
    'running_text', (SELECT running_text FROM public.pos_display_settings WHERE branch_id = _branch_id),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'status', t.status, 'table_number', t.table_number,
        'customer_name', split_part(COALESCE(t.customer_name, ''), ' ', 1),
        'transaction_number', t.transaction_number, 'created_at', t.created_at
      ) ORDER BY t.created_at)
      FROM public.pos_kds_tickets t
      WHERE t.branch_id = _branch_id AND t.status IN ('queued','cooking','ready')
        AND t.created_at >= now() - interval '12 hours'
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_queue_display(uuid) TO anon, authenticated;