ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'free';

DROP POLICY IF EXISTS "Anyone view completed tips" ON public.tips;
CREATE POLICY "Anyone view completed tips"
ON public.tips FOR SELECT
TO public
USING (status = 'completed');

ALTER PUBLICATION supabase_realtime ADD TABLE public.tips;