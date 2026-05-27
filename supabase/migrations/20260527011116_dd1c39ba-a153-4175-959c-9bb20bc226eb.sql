
-- Bucket for chat photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Public can view chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- Authenticated users upload into their own folder (auth.uid()/...)
CREATE POLICY "Users upload own chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own chat images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Messages: allow image-only messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_check;

ALTER TABLE public.messages
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_or_image_check
  CHECK (
    (content IS NOT NULL AND char_length(content) BETWEEN 1 AND 2000)
    OR image_url IS NOT NULL
  );
