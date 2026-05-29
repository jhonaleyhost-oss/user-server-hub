CREATE TABLE public.user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  detail text,
  old_value text,
  new_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_activity_logs TO authenticated;
GRANT ALL ON public.user_activity_logs TO service_role;

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own logs"
ON public.user_activity_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own logs"
ON public.user_activity_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all logs"
ON public.user_activity_logs
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete logs"
ON public.user_activity_logs
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_user_activity_logs_user ON public.user_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_user_activity_logs_created ON public.user_activity_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.get_user_activity_logs(_limit integer DEFAULT 200)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role app_role,
  action text,
  detail text,
  old_value text,
  new_value text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS role,
    l.action,
    l.detail,
    l.old_value,
    l.new_value,
    l.created_at
  FROM public.user_activity_logs l
  LEFT JOIN public.profiles p ON p.user_id = l.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = l.user_id
  WHERE public.is_admin(auth.uid())
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 1000));
$$;