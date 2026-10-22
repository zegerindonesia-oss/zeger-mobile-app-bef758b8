ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pos_pin_hash text;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS cashier_name text;
ALTER TABLE public.pos_shifts ADD COLUMN IF NOT EXISTS cashier_name text;

CREATE OR REPLACE FUNCTION public.set_cashier_pin(_profile_id uuid, _pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE me record; target record;
BEGIN
  IF _pin !~ '^[0-9]{4,6}$' THEN RAISE EXCEPTION 'PIN harus 4-6 digit angka'; END IF;
  SELECT id, role::text AS role, branch_id INTO me FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT id, branch_id INTO target FROM profiles WHERE id = _profile_id;
  IF me.id IS NULL OR target.id IS NULL THEN RAISE EXCEPTION 'Tidak diizinkan'; END IF;
  IF NOT (me.role IN ('ho_admin','ho_owner','1_HO_Admin','1_HO_Owner')
       OR (me.role IN ('branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager') AND me.branch_id = target.branch_id)) THEN
    RAISE EXCEPTION 'Hanya owner/manager yang dapat mengatur PIN';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles p WHERE p.branch_id = target.branch_id AND p.id <> _profile_id
             AND p.pos_pin_hash IS NOT NULL AND p.pos_pin_hash = crypt(_pin, p.pos_pin_hash)) THEN
    RAISE EXCEPTION 'PIN sudah dipakai staf lain di cabang ini';
  END IF;
  UPDATE profiles SET pos_pin_hash = crypt(_pin, gen_salt('bf')) WHERE id = _profile_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.verify_cashier_pin(_branch_id uuid, _pin text)
RETURNS TABLE(profile_id uuid, full_name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Tidak diizinkan'; END IF;
  RETURN QUERY SELECT p.id, p.full_name::text FROM profiles p
    WHERE p.branch_id = _branch_id AND p.pos_pin_hash IS NOT NULL
      AND p.pos_pin_hash = crypt(_pin, p.pos_pin_hash) LIMIT 1;
END $$;

CREATE OR REPLACE FUNCTION public.list_branch_cashiers(_branch_id uuid)
RETURNS TABLE(profile_id uuid, full_name text, role text, has_pin boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name::text, p.role::text, p.pos_pin_hash IS NOT NULL
  FROM profiles p WHERE p.branch_id = _branch_id AND auth.uid() IS NOT NULL
    AND COALESCE(p.is_active, true) ORDER BY p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.set_cashier_pin(uuid,text), public.verify_cashier_pin(uuid,text), public.list_branch_cashiers(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_cashier_pin(uuid,text), public.verify_cashier_pin(uuid,text), public.list_branch_cashiers(uuid) TO authenticated;