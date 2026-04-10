
-- Add vault reference columns
ALTER TABLE public.pterodactyl_servers 
  ADD COLUMN IF NOT EXISTS plta_vault_id uuid,
  ADD COLUMN IF NOT EXISTS pltc_vault_id uuid;

-- Function to store keys in vault
CREATE OR REPLACE FUNCTION public.store_server_keys(
  _server_id uuid,
  _plta_key text,
  _pltc_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plta_id uuid;
  v_pltc_id uuid;
  v_old_plta_id uuid;
  v_old_pltc_id uuid;
BEGIN
  SELECT plta_vault_id, pltc_vault_id 
  INTO v_old_plta_id, v_old_pltc_id
  FROM public.pterodactyl_servers 
  WHERE id = _server_id;

  IF v_old_plta_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_plta_id;
  END IF;
  IF v_old_pltc_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_pltc_id;
  END IF;

  INSERT INTO vault.secrets (name, secret)
  VALUES ('ptero_plta_' || _server_id::text, _plta_key)
  RETURNING id INTO v_plta_id;

  INSERT INTO vault.secrets (name, secret)
  VALUES ('ptero_pltc_' || _server_id::text, _pltc_key)
  RETURNING id INTO v_pltc_id;

  UPDATE public.pterodactyl_servers
  SET plta_vault_id = v_plta_id,
      pltc_vault_id = v_pltc_id
  WHERE id = _server_id;
END;
$$;

-- Function to retrieve keys from vault
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
BEGIN
  SELECT plta_vault_id, pltc_vault_id 
  INTO v_plta_id, v_pltc_id
  FROM public.pterodactyl_servers
  WHERE id = _server_id;

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

  RETURN QUERY SELECT v_plta, v_pltc;
END;
$$;
