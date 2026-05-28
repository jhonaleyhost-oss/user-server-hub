CREATE OR REPLACE FUNCTION public.enforce_role_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role, system contexts (no JWT), and admins
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Only admins can modify user roles';
END;
$function$;