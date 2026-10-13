ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);