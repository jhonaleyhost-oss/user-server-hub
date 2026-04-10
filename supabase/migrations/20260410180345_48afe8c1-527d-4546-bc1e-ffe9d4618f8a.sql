
-- Fix critical privilege escalation: remove self-insert capability
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO public
WITH CHECK (is_admin(auth.uid()));
