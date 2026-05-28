
CREATE OR REPLACE FUNCTION public.enforce_role_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow backend (service_role) and admin users
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Only admins can modify user roles';
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_admin_only_ins ON public.user_roles;
DROP TRIGGER IF EXISTS enforce_role_admin_only_upd ON public.user_roles;
DROP TRIGGER IF EXISTS enforce_role_admin_only_del ON public.user_roles;

CREATE TRIGGER enforce_role_admin_only_ins
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_admin_only();

CREATE TRIGGER enforce_role_admin_only_upd
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_admin_only();

CREATE TRIGGER enforce_role_admin_only_del
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_admin_only();
