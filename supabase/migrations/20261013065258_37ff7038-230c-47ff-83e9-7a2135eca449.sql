ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT true;
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT true;