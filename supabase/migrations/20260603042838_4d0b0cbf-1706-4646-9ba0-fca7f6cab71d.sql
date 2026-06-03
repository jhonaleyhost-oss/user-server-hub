ALTER TABLE public.user_panels
  ADD COLUMN IF NOT EXISTS panel_type text NOT NULL DEFAULT 'nodejs';

DROP FUNCTION IF EXISTS public.get_panel_activity(integer);

CREATE OR REPLACE FUNCTION public.get_panel_activity(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  role app_role,
  username text,
  ram integer,
  cpu integer,
  disk integer,
  server_name text,
  server_domain text,
  panel_type text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.id,
    up.user_id,
    p.full_name,
    p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS role,
    up.username,
    up.ram,
    up.cpu,
    up.disk,
    s.name AS server_name,
    s.domain AS server_domain,
    up.panel_type,
    up.created_at
  FROM public.user_panels up
  LEFT JOIN public.profiles p ON p.user_id = up.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = up.user_id
  LEFT JOIN public.pterodactyl_servers s ON s.id = up.server_id
  ORDER BY up.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;