CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Umum',
  unit text NOT NULL DEFAULT 'gr',
  cost_per_unit numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_materials TO authenticated;
GRANT ALL ON public.raw_materials TO service_role;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.raw_material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_material_stock TO authenticated;
GRANT ALL ON public.raw_material_stock TO service_role;
ALTER TABLE public.raw_material_stock ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.product_recipes TO service_role;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.raw_material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  movement_type text NOT NULL, -- in | out | adjust
  quantity numeric NOT NULL,
  unit_cost numeric,
  reference_type text, -- purchase | sale | opname | waste
  reference_id text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.raw_material_movements TO authenticated;
GRANT ALL ON public.raw_material_movements TO service_role;
ALTER TABLE public.raw_material_movements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_material_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_active = true
    AND role::text IN ('ho_admin','ho_owner','ho_staff','1_HO_Admin','1_HO_Owner','1_HO_Staff',
      'branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager'))
$$;
CREATE OR REPLACE FUNCTION public.is_ho_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_active = true
    AND role::text IN ('ho_admin','ho_owner','ho_staff','1_HO_Admin','1_HO_Owner','1_HO_Staff'))
$$;

CREATE POLICY "Staff view materials" ON public.raw_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers edit materials" ON public.raw_materials FOR ALL TO authenticated USING (is_material_manager()) WITH CHECK (is_material_manager());

CREATE POLICY "Staff view recipes" ON public.product_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers edit recipes" ON public.product_recipes FOR ALL TO authenticated USING (is_material_manager()) WITH CHECK (is_material_manager());

CREATE POLICY "Branch stock access" ON public.raw_material_stock FOR ALL TO authenticated
USING (is_ho_user() OR branch_id = get_current_user_branch())
WITH CHECK (is_ho_user() OR branch_id = get_current_user_branch());

CREATE POLICY "Branch movement view" ON public.raw_material_movements FOR SELECT TO authenticated
USING (is_ho_user() OR branch_id = get_current_user_branch());
CREATE POLICY "Branch movement insert" ON public.raw_material_movements FOR INSERT TO authenticated
WITH CHECK (is_ho_user() OR branch_id = get_current_user_branch());

-- Record a stock movement and update balance atomically
CREATE OR REPLACE FUNCTION public.record_material_movement(
  _branch_id uuid, _material_id uuid, _type text, _qty numeric,
  _unit_cost numeric DEFAULT NULL, _ref_type text DEFAULT NULL, _ref_id text DEFAULT NULL, _notes text DEFAULT NULL
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE delta numeric; new_qty numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (is_ho_user() OR _branch_id = get_current_user_branch()) THEN
    RAISE EXCEPTION 'Tidak punya akses ke cabang ini';
  END IF;
  IF _type NOT IN ('in','out','adjust') THEN RAISE EXCEPTION 'Tipe tidak valid'; END IF;
  INSERT INTO raw_material_stock(branch_id, material_id, quantity) VALUES (_branch_id, _material_id, 0)
  ON CONFLICT (branch_id, material_id) DO NOTHING;
  IF _type = 'adjust' THEN
    SELECT _qty - quantity INTO delta FROM raw_material_stock WHERE branch_id=_branch_id AND material_id=_material_id FOR UPDATE;
  ELSIF _type = 'in' THEN delta := _qty;
  ELSE delta := -_qty; END IF;
  UPDATE raw_material_stock SET quantity = quantity + delta, updated_at = now()
   WHERE branch_id=_branch_id AND material_id=_material_id RETURNING quantity INTO new_qty;
  INSERT INTO raw_material_movements(branch_id, material_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
  VALUES (_branch_id, _material_id, _type, CASE WHEN _type='adjust' THEN delta ELSE _qty END, _unit_cost, _ref_type, _ref_id, _notes, auth.uid());
  IF _type = 'in' AND _unit_cost IS NOT NULL AND _unit_cost > 0 THEN
    UPDATE raw_materials SET cost_per_unit = _unit_cost, updated_at = now() WHERE id = _material_id;
  END IF;
  RETURN new_qty;
END $$;

-- Deduct recipe ingredients for a paid POS transaction (idempotent per transaction)
CREATE OR REPLACE FUNCTION public.deduct_recipe_for_transaction(_transaction_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid; r record; n int := 0;
BEGIN
  SELECT branch_id INTO b FROM pos_transactions WHERE id = _transaction_id;
  IF b IS NULL THEN RETURN 0; END IF;
  IF auth.uid() IS NULL OR NOT (is_ho_user() OR b = get_current_user_branch()) THEN
    RAISE EXCEPTION 'Tidak punya akses';
  END IF;
  IF EXISTS (SELECT 1 FROM raw_material_movements WHERE reference_type='sale' AND reference_id=_transaction_id::text) THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT pr.material_id, SUM(pr.quantity * ti.qty) AS used
    FROM pos_transaction_items ti JOIN product_recipes pr ON pr.product_id = ti.product_id
    WHERE ti.transaction_id = _transaction_id GROUP BY pr.material_id
  LOOP
    INSERT INTO raw_material_stock(branch_id, material_id, quantity) VALUES (b, r.material_id, 0)
    ON CONFLICT (branch_id, material_id) DO NOTHING;
    UPDATE raw_material_stock SET quantity = quantity - r.used, updated_at = now()
     WHERE branch_id=b AND material_id=r.material_id;
    INSERT INTO raw_material_movements(branch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
    VALUES (b, r.material_id, 'out', r.used, 'sale', _transaction_id::text, auth.uid());
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_material_movement(uuid,uuid,text,numeric,numeric,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.deduct_recipe_for_transaction(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_material_movement(uuid,uuid,text,numeric,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_recipe_for_transaction(uuid) TO authenticated;

CREATE TRIGGER trg_raw_materials_updated BEFORE UPDATE ON public.raw_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();