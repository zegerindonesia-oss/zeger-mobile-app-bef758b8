-- Create public bucket for stock return/verification photos
insert into storage.buckets (id, name, public)
values ('stock-photos', 'stock-photos', true)
on conflict (id) do nothing;

-- Policies for stock-photos bucket
-- Allow public read (images visible in app)
create policy if not exists "Public read for stock photos"
  on storage.objects
  for select
  using (bucket_id = 'stock-photos');

-- Allow authenticated users to upload to stock-photos
create policy if not exists "Authenticated users can upload stock photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'stock-photos' and auth.role() = 'authenticated'
  );

-- Optionally allow owners to update/delete their own files later (kept restrictive for now)
