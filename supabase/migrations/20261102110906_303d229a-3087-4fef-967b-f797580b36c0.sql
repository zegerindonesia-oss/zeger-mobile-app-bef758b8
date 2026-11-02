CREATE OR REPLACE FUNCTION public.void_pos_transaction(_tx uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; me record;
BEGIN
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi'; END IF;
  SELECT id, branch_id, role::text AS role FROM profiles WHERE user_id = auth.uid() INTO me;
  IF me.id IS NULL THEN RAISE EXCEPTION 'Tidak terautentikasi'; END IF;
  SELECT * FROM pos_transactions WHERE id = _tx FOR UPDATE INTO t;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF t.status IN ('void','voided') THEN RAISE EXCEPTION 'Transaksi sudah dibatalkan'; END IF;
  IF NOT (t.kasir_id = me.id OR public.is_ho_user() OR (t.branch_id = me.branch_id AND me.role IN ('branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager'))) THEN
    RAISE EXCEPTION 'Tidak punya akses membatalkan transaksi ini';
  END IF;
  UPDATE pos_transactions SET status = 'void', void_at = now(), void_by = me.id, void_reason = trim(_reason) WHERE id = _tx;
END $$;
REVOKE ALL ON FUNCTION public.void_pos_transaction(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.void_pos_transaction(uuid, text) TO authenticated;