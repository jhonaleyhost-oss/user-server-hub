
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

-- Allow owner and admin to UPDATE (soft-delete) their message
DROP POLICY IF EXISTS "Users can soft-delete their own messages" ON public.messages;
CREATE POLICY "Users can soft-delete their own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can soft-delete any message" ON public.messages;
CREATE POLICY "Admins can soft-delete any message"
ON public.messages
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));
