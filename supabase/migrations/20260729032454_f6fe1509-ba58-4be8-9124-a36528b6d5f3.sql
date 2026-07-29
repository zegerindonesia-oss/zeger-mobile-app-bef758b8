
-- Allow authenticated users (staff) to manage files in product/banner/loyalty buckets
DO $$ BEGIN
  CREATE POLICY "Staff can view images in product/banner/loyalty buckets"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id IN ('product-images','banner-images','loyalty-images'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Staff can upload images to product/banner/loyalty buckets"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('product-images','banner-images','loyalty-images'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Staff can update images in product/banner/loyalty buckets"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id IN ('product-images','banner-images','loyalty-images'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Staff can delete images in product/banner/loyalty buckets"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id IN ('product-images','banner-images','loyalty-images'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
