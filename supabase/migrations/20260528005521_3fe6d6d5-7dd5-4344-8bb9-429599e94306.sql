-- Support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_user_id UUID NOT NULL,
  sender_user_id UUID,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user','admin')),
  content TEXT,
  image_url TEXT,
  telegram_message_id BIGINT,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_thread ON public.support_messages(thread_user_id, created_at DESC);
CREATE INDEX idx_support_messages_tg ON public.support_messages(telegram_message_id) WHERE telegram_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own thread"
ON public.support_messages FOR SELECT TO authenticated
USING (auth.uid() = thread_user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users insert own messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = thread_user_id
  AND auth.uid() = sender_user_id
  AND sender_role = 'user'
);

CREATE POLICY "Admins insert admin messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND sender_role = 'admin');

CREATE POLICY "Users mark own read"
ON public.support_messages FOR UPDATE TO authenticated
USING (auth.uid() = thread_user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = thread_user_id OR public.is_admin(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

-- Storage bucket for support media
INSERT INTO storage.buckets (id, name, public) VALUES ('support-media', 'support-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Support media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-media');

CREATE POLICY "Users upload own support media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'support-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins upload any support media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-media' AND public.is_admin(auth.uid()));

-- Function: list threads for admin
CREATE OR REPLACE FUNCTION public.get_support_threads()
RETURNS TABLE(
  thread_user_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role app_role,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_sender_role TEXT,
  unread_admin INTEGER
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_msg AS (
    SELECT DISTINCT ON (thread_user_id)
      thread_user_id, content, image_url, created_at, sender_role
    FROM public.support_messages
    ORDER BY thread_user_id, created_at DESC
  ),
  unread AS (
    SELECT thread_user_id, COUNT(*)::int AS cnt
    FROM public.support_messages
    WHERE sender_role = 'user' AND read_by_admin = false
    GROUP BY thread_user_id
  )
  SELECT
    lm.thread_user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    COALESCE(ur.role, 'free'::app_role),
    COALESCE(lm.content, CASE WHEN lm.image_url IS NOT NULL THEN '📷 Foto' ELSE '' END),
    lm.created_at,
    lm.sender_role,
    COALESCE(u.cnt, 0)
  FROM last_msg lm
  LEFT JOIN public.profiles p ON p.user_id = lm.thread_user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = lm.thread_user_id
  LEFT JOIN unread u ON u.thread_user_id = lm.thread_user_id
  WHERE public.is_admin(auth.uid())
  ORDER BY lm.created_at DESC;
$$;