
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.tips DROP COLUMN IF EXISTS proof_url;
DROP POLICY IF EXISTS "Tip proofs owner update" ON storage.objects;
DROP POLICY IF EXISTS "Tip proofs owner delete" ON storage.objects;
