
-- Revoke the overly broad policies added in the previous migration
DROP POLICY IF EXISTS "Authenticated can view display fields of profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view all roles" ON public.user_roles;

-- Recreate the view in SECURITY DEFINER mode so it bypasses base-table RLS
-- and only exposes the four safe columns.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT
  p.user_id,
  p.full_name,
  p.avatar_url,
  COALESCE(ur.role, 'free'::app_role) AS role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id;

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.public_profiles TO authenticated;
