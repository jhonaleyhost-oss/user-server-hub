ALTER TABLE public.profiles ADD COLUMN device_fingerprint text;

CREATE INDEX idx_profiles_device_fingerprint ON public.profiles (device_fingerprint) WHERE device_fingerprint IS NOT NULL;