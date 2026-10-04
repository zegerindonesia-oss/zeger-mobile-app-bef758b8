CREATE OR REPLACE FUNCTION public.get_staff_emails()
RETURNS TABLE(user_id uuid, email text, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _role text;
  _branch uuid;
BEGIN
  SELECT p.role::text, p.branch_id INTO _role, _branch
  FROM public.profiles p WHERE p.user_id = auth.uid() AND COALESCE(p.is_active, true) LIMIT 1;

  IF _role IN ('ho_admin','1_HO_Admin','ho_owner','1_HO_Owner') THEN
    RETURN QUERY
      SELECT u.id, u.email::text, u.last_sign_in_at
      FROM auth.users u JOIN public.profiles p ON p.user_id = u.id
      WHERE p.role <> 'customer';
  ELSIF _role IN ('branch_manager','2_Hub_Branch_Manager','sb_branch_manager','3_SB_Branch_Manager') AND _branch IS NOT NULL THEN
    RETURN QUERY
      SELECT u.id, u.email::text, u.last_sign_in_at
      FROM auth.users u JOIN public.profiles p ON p.user_id = u.id
      WHERE p.branch_id = _branch AND p.role <> 'customer';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_emails() TO authenticated;