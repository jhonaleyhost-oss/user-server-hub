
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE(chat_unread int, support_unread int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((
      SELECT COUNT(*)::int FROM public.messages m
      WHERE m.deleted = false
        AND m.user_id <> auth.uid()
        AND NOT EXISTS (
          SELECT 1 FROM public.message_reads r
          WHERE r.message_id = m.id AND r.user_id = auth.uid()
        )
    ), 0) AS chat_unread,
    CASE
      WHEN public.is_admin(auth.uid()) THEN
        COALESCE((
          SELECT COUNT(*)::int FROM public.support_messages
          WHERE sender_role = 'user' AND read_by_admin = false
        ), 0)
      ELSE
        COALESCE((
          SELECT COUNT(*)::int FROM public.support_messages
          WHERE thread_user_id = auth.uid()
            AND sender_role = 'admin'
            AND read_by_user = false
        ), 0)
    END AS support_unread;
$$;
