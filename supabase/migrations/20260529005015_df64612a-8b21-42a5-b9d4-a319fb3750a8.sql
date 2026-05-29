ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

DROP POLICY IF EXISTS "Users mark own read" ON public.support_messages;

CREATE POLICY "Users mark own read or edit own content"
ON public.support_messages
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = thread_user_id) OR is_admin(auth.uid())
  OR (auth.uid() = sender_user_id)
)
WITH CHECK (
  (auth.uid() = thread_user_id) OR is_admin(auth.uid())
  OR (auth.uid() = sender_user_id)
);