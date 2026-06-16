ALTER TABLE public.ptero_ws_token_cache
  ADD COLUMN IF NOT EXISTS throttled_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;