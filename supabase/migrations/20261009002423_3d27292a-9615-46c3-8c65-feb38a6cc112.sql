ALTER TABLE public.products ADD COLUMN IF NOT EXISTS show_in_customer_app boolean NOT NULL DEFAULT true;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'starter';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_best boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS benefits jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS customer_channel text NOT NULL DEFAULT 'branch';