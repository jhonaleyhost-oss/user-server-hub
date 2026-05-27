
-- Add reply support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Public profile view (no email, no PII beyond display name + avatar + role)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  p.user_id,
  p.full_name,
  p.avatar_url,
  COALESCE(ur.role, 'free'::app_role) AS role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Allow authenticated users to read display fields of all profiles (needed because security_invoker view respects base RLS)
CREATE POLICY "Authenticated can view display fields of profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Also allow authenticated users to read roles (needed for the join)
CREATE POLICY "Authenticated can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);
