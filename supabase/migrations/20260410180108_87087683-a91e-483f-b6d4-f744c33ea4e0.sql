
-- Fix security definer view by using security invoker
CREATE OR REPLACE VIEW public.active_servers_public
WITH (security_invoker = true) AS
SELECT id, name, domain, server_type, is_active, location_id, egg_id
FROM public.pterodactyl_servers
WHERE is_active = true;
