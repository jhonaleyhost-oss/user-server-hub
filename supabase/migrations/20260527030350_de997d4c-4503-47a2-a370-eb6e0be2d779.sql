
CREATE TABLE IF NOT EXISTS public.blocked_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  device_fingerprint text,
  original_user_id uuid,
  archived_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_devices TO authenticated;
GRANT ALL ON public.blocked_devices TO service_role;

ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blocked devices"
ON public.blocked_devices
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_blocked_devices_ip ON public.blocked_devices(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_devices_fp ON public.blocked_devices(device_fingerprint) WHERE device_fingerprint IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_profile_device()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.ip_address IS NOT NULL OR OLD.device_fingerprint IS NOT NULL THEN
    INSERT INTO public.blocked_devices (ip_address, device_fingerprint, original_user_id)
    VALUES (OLD.ip_address, OLD.device_fingerprint, OLD.user_id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_profile_device ON public.profiles;
CREATE TRIGGER trg_archive_profile_device
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.archive_profile_device();
