
DROP POLICY IF EXISTS "Kasir can mark voucher used" ON public.pos_vouchers;

CREATE POLICY "Kasir can mark voucher used"
  ON public.pos_vouchers FOR UPDATE
  TO authenticated
  USING (is_used = false)
  WITH CHECK (
    is_used = true
    AND used_by_transaction_id IN (
      SELECT id FROM public.pos_transactions
      WHERE kasir_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );
