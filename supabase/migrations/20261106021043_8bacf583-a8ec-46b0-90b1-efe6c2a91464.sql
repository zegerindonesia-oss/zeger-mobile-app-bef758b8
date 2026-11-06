CREATE TABLE public.pos_tv_pair_codes (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pos_tv_pair_codes TO service_role;
ALTER TABLE public.pos_tv_pair_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tv_pairing_code(_branch_id uuid, _rotate boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c text; ok boolean; tries int := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()
    AND (p.role::text IN ('ho_admin','1_HO_Admin','ho_owner','1_HO_Owner') OR p.branch_id = _branch_id)) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Tidak punya akses cabang ini'; END IF;
  IF _rotate THEN DELETE FROM pos_tv_pair_codes WHERE branch_id = _branch_id; END IF;
  SELECT code INTO c FROM pos_tv_pair_codes WHERE branch_id = _branch_id;
  IF c IS NOT NULL THEN RETURN c; END IF;
  LOOP
    c := lpad((floor(random()*1000000))::int::text, 6, '0');
    BEGIN
      INSERT INTO pos_tv_pair_codes (branch_id, code) VALUES (_branch_id, c);
      RETURN c;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1; IF tries > 20 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tv_pair(_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT branch_id FROM pos_tv_pair_codes WHERE code = trim(_code)
$$;

REVOKE ALL ON FUNCTION public.tv_pairing_code(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tv_pairing_code(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tv_pair(text) TO anon, authenticated;