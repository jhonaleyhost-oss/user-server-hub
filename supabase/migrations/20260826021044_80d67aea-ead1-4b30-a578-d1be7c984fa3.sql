ALTER TABLE public.blocked_devices ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'archive';
ALTER TABLE public.blocked_devices ADD COLUMN IF NOT EXISTS reason TEXT;

-- Hanya nilai yang diizinkan untuk source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blocked_devices_source_check'
  ) THEN
    ALTER TABLE public.blocked_devices
      ADD CONSTRAINT blocked_devices_source_check CHECK (source IN ('archive', 'suspend'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blocked_devices_fingerprint ON public.blocked_devices (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_blocked_devices_ip ON public.blocked_devices (ip_address);