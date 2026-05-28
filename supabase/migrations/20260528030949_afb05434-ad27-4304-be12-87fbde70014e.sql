-- Make support-media bucket private and restrict reads to owner/admin
UPDATE storage.buckets SET public = false WHERE id = 'support-media';

DROP POLICY IF EXISTS "Support media public read" ON storage.objects;

CREATE POLICY "Support media owner or admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
  )
);