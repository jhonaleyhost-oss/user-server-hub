-- Allow per-user targeted notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON public.notifications(target_user_id) WHERE target_user_id IS NOT NULL;

-- Update audience matcher to include personally-targeted notifications
CREATE OR REPLACE FUNCTION public._user_matches_audience(_user_id uuid, _aud notification_audience)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _aud = 'all' THEN true
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _aud::text)
  END;
$$;

-- Get my notifications now also returns notifications targeted to me
CREATE OR REPLACE FUNCTION public.get_my_notifications(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, title text, body text, banner_url text, link_url text, audience notification_audience, created_at timestamptz, is_read boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT n.id, n.title, n.body, n.banner_url, n.link_url, n.audience, n.created_at,
    EXISTS(SELECT 1 FROM public.notification_reads r WHERE r.notification_id = n.id AND r.user_id = auth.uid()) AS is_read
  FROM public.notifications n
  WHERE (n.target_user_id IS NULL AND public._user_matches_audience(auth.uid(), n.audience))
     OR (n.target_user_id = auth.uid())
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.notifications n
  WHERE ((n.target_user_id IS NULL AND public._user_matches_audience(auth.uid(), n.audience))
      OR (n.target_user_id = auth.uid()))
    AND NOT EXISTS (SELECT 1 FROM public.notification_reads r WHERE r.notification_id = n.id AND r.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, auth.uid() FROM public.notifications n
  WHERE (n.target_user_id IS NULL AND public._user_matches_audience(auth.uid(), n.audience))
     OR (n.target_user_id = auth.uid())
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- Adjust RLS so users can SELECT only their relevant notifications (admins see all)
DROP POLICY IF EXISTS "Authenticated can view notifications" ON public.notifications;
CREATE POLICY "Users see their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR target_user_id IS NULL
    OR target_user_id = auth.uid()
  );