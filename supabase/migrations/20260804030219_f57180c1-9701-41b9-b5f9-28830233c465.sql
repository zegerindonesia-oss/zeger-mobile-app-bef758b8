UPDATE public.transaction_void_requests v
SET status = 'rejected',
    reviewed_at = now(),
    reviewer_notes = COALESCE(reviewer_notes, 'Otomatis ditutup: transaksi sudah dibatalkan (void) sebelumnya')
FROM public.transactions t
WHERE t.id = v.transaction_id
  AND v.status = 'pending'
  AND t.is_voided = true;

DELETE FROM public.transaction_void_requests v
USING public.transaction_void_requests keep
WHERE v.status = 'pending'
  AND keep.status = 'pending'
  AND keep.transaction_id = v.transaction_id
  AND keep.created_at < v.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_void_request_per_transaction
ON public.transaction_void_requests (transaction_id)
WHERE status = 'pending';