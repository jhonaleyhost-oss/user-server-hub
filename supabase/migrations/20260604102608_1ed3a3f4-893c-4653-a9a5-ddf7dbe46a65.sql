-- Add kind and audience to popup_settings to support multiple popup types (promo + warning)
ALTER TABLE public.popup_settings
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'promo',
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all';

-- Validation: kind in ('promo','warning'), audience in ('all','reseller')
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'popup_settings_kind_check'
  ) THEN
    ALTER TABLE public.popup_settings
      ADD CONSTRAINT popup_settings_kind_check CHECK (kind IN ('promo','warning'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'popup_settings_audience_check'
  ) THEN
    ALTER TABLE public.popup_settings
      ADD CONSTRAINT popup_settings_audience_check CHECK (audience IN ('all','reseller'));
  END IF;
END $$;

-- Ensure only one row per kind (so admin manages one promo + one warning)
CREATE UNIQUE INDEX IF NOT EXISTS popup_settings_kind_unique ON public.popup_settings(kind);