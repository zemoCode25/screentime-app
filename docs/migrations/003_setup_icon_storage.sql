-- Storage bucket setup for app icons
-- Run these in your Supabase SQL Editor

-- 1. Create the app-icons storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-icons', 'app-icons', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create policy for authenticated users to upload icons
CREATE POLICY "Authenticated users can upload app icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-icons');

-- 3. Create policy for authenticated users to update icons (upsert)
CREATE POLICY "Authenticated users can update app icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-icons');

-- 4. Create policy for public read access to icons
CREATE POLICY "Public read access to app icons"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app-icons');
