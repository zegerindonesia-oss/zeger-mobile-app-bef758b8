-- Add notes column to shift_management table for cash deposit photos
ALTER TABLE public.shift_management 
ADD COLUMN IF NOT EXISTS notes TEXT;