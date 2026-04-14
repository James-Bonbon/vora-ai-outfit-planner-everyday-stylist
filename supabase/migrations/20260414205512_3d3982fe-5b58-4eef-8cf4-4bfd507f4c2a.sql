-- ============================================================
-- Storage Privacy Refactor: Make selfies bucket private
-- and convert existing public URLs to raw storage paths
-- ============================================================

-- 1. Make the selfies bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'selfies';

-- 2. Drop existing selfies storage policies idempotently
DROP POLICY IF EXISTS "Selfies are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own selfie" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own selfie" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own selfie" ON storage.objects;
DROP POLICY IF EXISTS "Public selfie read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated selfie upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated selfie update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated selfie delete" ON storage.objects;
-- Also drop any policies that may match common naming patterns
DROP POLICY IF EXISTS "selfies_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "selfies_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "selfies_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "selfies_delete_policy" ON storage.objects;

-- 3. Create new private-access policies for selfies bucket
-- SELECT: Only the owning user can view their selfies
CREATE POLICY "selfies_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- INSERT: Only the owning user can upload selfies to their folder
CREATE POLICY "selfies_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'selfies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: Only the owning user can update their selfies
CREATE POLICY "selfies_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'selfies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: Only the owning user can delete their selfies
CREATE POLICY "selfies_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'selfies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Data migration: Convert public URLs to raw storage paths
-- Strips the Supabase public URL prefix, leaving only the storage path
-- e.g. "https://xxx.supabase.co/storage/v1/object/public/selfies/user-id/selfie.jpg"
--   -> "user-id/selfie.jpg"
UPDATE public.profiles
SET selfie_url = regexp_replace(
  selfie_url,
  '^https?://[^/]+/storage/v1/object/public/selfies/',
  ''
)
WHERE selfie_url IS NOT NULL
  AND selfie_url LIKE '%/storage/v1/object/public/selfies/%';