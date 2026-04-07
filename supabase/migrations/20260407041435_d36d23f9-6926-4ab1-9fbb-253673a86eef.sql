ALTER TABLE public.cash_deposit_verifications 
ADD COLUMN IF NOT EXISTS verified_outlet boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_outlet_by text,
ADD COLUMN IF NOT EXISTS verified_finance boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_finance_by text;