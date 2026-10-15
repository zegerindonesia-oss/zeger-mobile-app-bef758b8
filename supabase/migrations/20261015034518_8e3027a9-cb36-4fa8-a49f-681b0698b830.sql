DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
      AND p.proname NOT IN ('get_public_receipt','get_queue_display')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.sig::text NOT LIKE 'st_estimatedextent%' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;

ALTER VIEW public.v_active_stock_alerts SET (security_invoker = true);
ALTER VIEW public.v_pending_approvals SET (security_invoker = true);