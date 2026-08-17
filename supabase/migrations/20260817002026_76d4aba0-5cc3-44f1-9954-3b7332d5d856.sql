CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_reseller', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'reseller'),
    'total_adp', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'adp_server')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO authenticated;