CREATE TABLE IF NOT EXISTS public.ptero_ws_token_cache (
  panel_id uuid PRIMARY KEY REFERENCES public.user_panels(id) ON DELETE CASCADE,
  token text NOT NULL,
  socket text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ptero_ws_token_cache TO service_role;

ALTER TABLE public.ptero_ws_token_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_ptero_ws_token_cache_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ptero_ws_token_cache_updated_at ON public.ptero_ws_token_cache;
CREATE TRIGGER update_ptero_ws_token_cache_updated_at
  BEFORE UPDATE ON public.ptero_ws_token_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ptero_ws_token_cache_updated_at();