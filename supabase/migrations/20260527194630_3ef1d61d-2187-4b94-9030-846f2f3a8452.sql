CREATE OR REPLACE FUNCTION public.get_signup_activity(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, user_id uuid, full_name text, avatar_url text, role app_role, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.user_id,
    p.full_name,
    p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS role,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$function$;

REVOKE EXECUTE ON FUNCTION public.get_signup_activity(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_signup_activity(integer) TO authenticated;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;