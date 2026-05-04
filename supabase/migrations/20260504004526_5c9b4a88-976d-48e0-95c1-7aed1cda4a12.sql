
-- ============================================
-- Fix 1: get_current_user_role must respect is_active
-- ============================================
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM profiles
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================
-- Fix 2: Restrict permission management to level 1 only
-- (rider is level 2 — must NOT manage permissions)
-- ============================================
DROP POLICY IF EXISTS "Level 1-2 can manage permissions" ON public.user_module_permissions;

CREATE POLICY "Level 1 can manage permissions"
ON public.user_module_permissions
FOR ALL
TO authenticated
USING (get_user_level(get_current_user_role()) <= 1)
WITH CHECK (get_user_level(get_current_user_role()) <= 1);

-- ============================================
-- Fix 3: Make attendance & checkpoint photo buckets private
-- ============================================
UPDATE storage.buckets SET public = false WHERE id IN ('attendance-photos','checkpoint-photos');

DROP POLICY IF EXISTS "Public read attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read checkpoint photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view relevant checkpoint photos" ON storage.objects;

-- Owner-scoped read for checkpoint photos (path: {auth.uid}/...)
CREATE POLICY "Riders can view own checkpoint photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checkpoint-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Managers/admins can view all checkpoint photos
CREATE POLICY "Staff can view checkpoint photos in their scope"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checkpoint-photos'
  AND (has_role('ho_admin'::user_role) OR has_role('branch_manager'::user_role))
);
