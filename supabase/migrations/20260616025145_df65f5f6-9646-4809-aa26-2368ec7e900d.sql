ALTER TABLE public.ptero_ws_token_cache
  ALTER COLUMN token DROP NOT NULL,
  ALTER COLUMN socket DROP NOT NULL,
  ALTER COLUMN expires_at DROP NOT NULL;