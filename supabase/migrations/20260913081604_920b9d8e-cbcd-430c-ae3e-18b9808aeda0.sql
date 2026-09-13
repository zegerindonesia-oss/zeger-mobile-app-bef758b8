ALTER TABLE public.shift_management
  ADD COLUMN IF NOT EXISTS selisih_stok_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selisih_stok_detail jsonb NOT NULL DEFAULT '[]'::jsonb;