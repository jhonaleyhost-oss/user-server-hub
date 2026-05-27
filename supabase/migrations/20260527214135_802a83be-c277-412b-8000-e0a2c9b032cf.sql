
ALTER TABLE public.pterodactyl_servers
  ADD COLUMN IF NOT EXISTS nest_id integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS python_egg_id integer NOT NULL DEFAULT 16;
