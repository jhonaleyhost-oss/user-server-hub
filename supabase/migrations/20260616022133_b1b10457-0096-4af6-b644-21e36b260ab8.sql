ALTER TABLE public.user_panels ADD COLUMN IF NOT EXISTS ptero_identifier text;
CREATE INDEX IF NOT EXISTS idx_user_panels_ptero_identifier ON public.user_panels(ptero_identifier);