
CREATE OR REPLACE FUNCTION public.get_server_keys(_server_id uuid)
RETURNS TABLE(plta_key text, pltc_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plta_id uuid;
  v_pltc_id uuid;
  v_plta text;
  v_pltc text;
  v_plta_plain text;
  v_pltc_plain text;
BEGIN
  SELECT s.plta_vault_id, s.pltc_vault_id
  INTO v_plta_id, v_pltc_id
  FROM public.pterodactyl_servers s
  WHERE s.id = _server_id;

  -- Try vault first
  IF v_plta_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_plta 
    FROM vault.decrypted_secrets 
    WHERE id = v_plta_id;
  END IF;

  IF v_pltc_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_pltc 
    FROM vault.decrypted_secrets 
    WHERE id = v_pltc_id;
  END IF;

  -- Fallback to plaintext columns if vault is empty
  IF v_plta IS NULL THEN
    BEGIN
      EXECUTE format('SELECT plta_key FROM public.pterodactyl_servers WHERE id = %L', _server_id)
      INTO v_plta;
    EXCEPTION WHEN undefined_column THEN
      v_plta := NULL;
    END;
  END IF;

  IF v_pltc IS NULL THEN
    BEGIN
      EXECUTE format('SELECT pltc_key FROM public.pterodactyl_servers WHERE id = %L', _server_id)
      INTO v_pltc;
    EXCEPTION WHEN undefined_column THEN
      v_pltc := NULL;
    END;
  END IF;

  RETURN QUERY SELECT v_plta, v_pltc;
END;
$$;
