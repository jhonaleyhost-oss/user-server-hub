ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_or_image_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_or_image_check
CHECK (deleted = true OR content IS NOT NULL OR image_url IS NOT NULL);