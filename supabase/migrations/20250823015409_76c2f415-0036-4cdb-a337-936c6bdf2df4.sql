-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', false);

-- Create RLS policies for attendance photos
CREATE POLICY "Riders can upload their own attendance photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'attendance-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Riders can view their own attendance photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'attendance-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can view attendance photos in their scope" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'attendance-photos' 
  AND (
    has_role('ho_admin'::user_role) 
    OR has_role('branch_manager'::user_role)
  )
);