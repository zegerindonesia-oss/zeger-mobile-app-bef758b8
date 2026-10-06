CREATE TABLE IF NOT EXISTS public.pos_display_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  video_url text,
  running_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_display_settings TO authenticated;
GRANT ALL ON public.pos_display_settings TO service_role;
ALTER TABLE public.pos_display_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch staff manage display settings" ON public.pos_display_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()
   AND (p.branch_id = pos_display_settings.branch_id OR p.role::text IN ('ho_admin','ho_owner','1_HO_Admin','1_HO_Owner'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()
   AND (p.branch_id = pos_display_settings.branch_id OR p.role::text IN ('ho_admin','ho_owner','1_HO_Admin','1_HO_Owner'))));

CREATE OR REPLACE FUNCTION public.get_queue_display(_branch_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'branch_name', (SELECT name FROM public.branches WHERE id = _branch_id),
    'video_url', (SELECT video_url FROM public.pos_display_settings WHERE branch_id = _branch_id),
    'running_text', (SELECT running_text FROM public.pos_display_settings WHERE branch_id = _branch_id),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'status', t.status, 'table_number', t.table_number,
        'customer_name', split_part(COALESCE(t.customer_name, ''), ' ', 1),
        'transaction_number', t.transaction_number, 'created_at', t.created_at
      ) ORDER BY t.created_at)
      FROM public.pos_kds_tickets t
      WHERE t.branch_id = _branch_id
        AND t.status IN ('queued', 'cooking', 'ready')
        AND t.created_at >= now() - interval '12 hours'
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_queue_display(uuid) TO anon, authenticated;