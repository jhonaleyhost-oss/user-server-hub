
-- Remove the policy that exposes sensitive API keys to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view active servers" ON public.pterodactyl_servers;

-- Create a secure view that only exposes non-sensitive columns
CREATE OR REPLACE VIEW public.active_servers_public AS
SELECT id, name, domain, server_type, is_active, location_id, egg_id
FROM public.pterodactyl_servers
WHERE is_active = true;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.active_servers_public TO authenticated;

-- Create a new policy: authenticated users can view active servers but ONLY through admin check or edge functions
-- (Admins already have their own SELECT policy, so no change needed for them)
