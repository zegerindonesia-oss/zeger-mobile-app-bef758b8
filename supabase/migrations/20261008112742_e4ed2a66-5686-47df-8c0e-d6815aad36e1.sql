ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text, ADD COLUMN IF NOT EXISTS sub_category text;
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS material_type text NOT NULL DEFAULT 'raw',
  ADD COLUMN IF NOT EXISTS yield_quantity numeric NOT NULL DEFAULT 1;

CREATE TABLE public.wip_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wip_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wip_components TO authenticated;
GRANT ALL ON public.wip_components TO service_role;
ALTER TABLE public.wip_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read wip components" ON public.wip_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Material managers write wip components" ON public.wip_components FOR ALL TO authenticated
  USING (is_material_manager()) WITH CHECK (is_material_manager());

CREATE OR REPLACE FUNCTION public.produce_wip(_branch_id uuid, _wip_id uuid, _batches numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE y numeric; r record; ref text := gen_random_uuid()::text;
BEGIN
  IF auth.uid() IS NULL OR NOT is_material_manager() OR NOT (is_ho_user() OR _branch_id = get_current_user_branch()) THEN
    RAISE EXCEPTION 'Tidak punya akses';
  END IF;
  IF _batches IS NULL OR _batches <= 0 THEN RAISE EXCEPTION 'Jumlah batch harus > 0'; END IF;
  SELECT yield_quantity INTO y FROM raw_materials WHERE id = _wip_id AND material_type = 'wip';
  IF y IS NULL THEN RAISE EXCEPTION 'Bahan bukan WIP'; END IF;
  IF NOT EXISTS (SELECT 1 FROM wip_components WHERE wip_id = _wip_id) THEN RAISE EXCEPTION 'Komposisi WIP belum diisi'; END IF;
  FOR r IN SELECT material_id, quantity FROM wip_components WHERE wip_id = _wip_id LOOP
    INSERT INTO raw_material_stock(branch_id, material_id, quantity) VALUES (_branch_id, r.material_id, 0) ON CONFLICT (branch_id, material_id) DO NOTHING;
    UPDATE raw_material_stock SET quantity = quantity - r.quantity * _batches, updated_at = now() WHERE branch_id = _branch_id AND material_id = r.material_id;
    INSERT INTO raw_material_movements(branch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by, notes)
    VALUES (_branch_id, r.material_id, 'out', r.quantity * _batches, 'wip_production', ref, auth.uid(), 'Bahan untuk produksi WIP');
  END LOOP;
  INSERT INTO raw_material_stock(branch_id, material_id, quantity) VALUES (_branch_id, _wip_id, 0) ON CONFLICT (branch_id, material_id) DO NOTHING;
  UPDATE raw_material_stock SET quantity = quantity + y * _batches, updated_at = now() WHERE branch_id = _branch_id AND material_id = _wip_id;
  INSERT INTO raw_material_movements(branch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by, notes)
  VALUES (_branch_id, _wip_id, 'in', y * _batches, 'wip_production', ref, auth.uid(), 'Hasil produksi WIP');
  RETURN y * _batches;
END $$;
REVOKE EXECUTE ON FUNCTION public.produce_wip(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.produce_wip(uuid, uuid, numeric) TO authenticated;