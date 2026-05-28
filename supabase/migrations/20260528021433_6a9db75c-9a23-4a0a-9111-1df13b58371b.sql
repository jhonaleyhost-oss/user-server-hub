DROP FUNCTION IF EXISTS public.get_public_users();

CREATE OR REPLACE FUNCTION public.get_public_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  role app_role,
  panel_count bigint,
  reseller_plan text,
  reseller_permanent boolean,
  reseller_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS role,
    COALESCE((SELECT COUNT(*) FROM public.user_panels up WHERE up.user_id = p.user_id), 0) AS panel_count,
    (
      SELECT o.plan
      FROM public.reseller_orders o
      WHERE o.user_id = p.user_id
        AND o.status = 'completed'
      ORDER BY COALESCE(o.paid_at, o.created_at) DESC
      LIMIT 1
    ) AS reseller_plan,
    COALESCE(p.reseller_permanent, false) AS reseller_permanent,
    p.reseller_expires_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_users() TO authenticated;