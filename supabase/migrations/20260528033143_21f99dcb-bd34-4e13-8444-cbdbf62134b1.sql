
-- Make tip-proofs bucket private (no public URL access; only owner/admin via signed URLs)
UPDATE storage.buckets SET public = false WHERE id = 'tip-proofs';

-- Drop overly permissive SELECT policies that allow listing/enumerating files via the storage API.
-- Public URLs for public buckets (avatars, chat-images) keep working without these policies
-- because the public object endpoint bypasses RLS for buckets where public = true.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Tip proofs are publicly viewable" ON storage.objects;

-- Tip proofs: restricted read (owner folder or admin) via signed URLs
CREATE POLICY "Tip proofs owner or admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tip-proofs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
  )
);

-- Admin can also manage tip proofs
CREATE POLICY "Tip proofs admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'tip-proofs' AND public.is_admin(auth.uid()));
