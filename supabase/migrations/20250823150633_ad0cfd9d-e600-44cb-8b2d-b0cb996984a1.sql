-- Buckets and Storage Policies for photo uploads
-- 1) Create bucket for stock photos if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'stock-photos') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('stock-photos', 'stock-photos', true);
  END IF;
END $$;

-- 2) Ensure related buckets are public to work with getPublicUrl used in code
UPDATE storage.buckets SET public = true WHERE id IN ('checkpoint-photos','payment-proofs','attendance-photos');

-- 3) Storage policies to allow public read and authenticated uploads
-- Checkpoint Photos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read checkpoint photos'
  ) THEN
    CREATE POLICY "Public read checkpoint photos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'checkpoint-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload checkpoint photos'
  ) THEN
    CREATE POLICY "Authenticated upload checkpoint photos"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'checkpoint-photos');
  END IF;
END $$;

-- Payment Proofs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read payment proofs'
  ) THEN
    CREATE POLICY "Public read payment proofs"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'payment-proofs');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload payment proofs'
  ) THEN
    CREATE POLICY "Authenticated upload payment proofs"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs');
  END IF;
END $$;

-- Stock Photos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read stock photos'
  ) THEN
    CREATE POLICY "Public read stock photos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'stock-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload stock photos'
  ) THEN
    CREATE POLICY "Authenticated upload stock photos"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'stock-photos');
  END IF;
END $$;

-- Attendance Photos (to make check-in/out smoother)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read attendance photos'
  ) THEN
    CREATE POLICY "Public read attendance photos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'attendance-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload attendance photos'
  ) THEN
    CREATE POLICY "Authenticated upload attendance photos"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'attendance-photos');
  END IF;
END $$;

-- 4) Allow riders to insert stock return movements
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stock_movements' AND policyname = 'Riders can insert return movements'
  ) THEN
    CREATE POLICY "Riders can insert return movements"
    ON public.stock_movements
    FOR INSERT TO authenticated
    WITH CHECK (
      has_role('rider')
      AND rider_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
      AND movement_type = 'return'
    );
  END IF;
END $$;