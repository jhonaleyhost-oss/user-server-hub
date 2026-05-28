
REVOKE SELECT (plta_key), INSERT (plta_key), UPDATE (plta_key),
       SELECT (pltc_key), INSERT (pltc_key), UPDATE (pltc_key)
  ON public.pterodactyl_servers FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.pterodactyl_servers TO service_role;
