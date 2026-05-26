
CREATE OR REPLACE FUNCTION public.get_public_users()
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url, COALESCE(ur.role, 'free'::app_role) AS role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_users() TO authenticated;
