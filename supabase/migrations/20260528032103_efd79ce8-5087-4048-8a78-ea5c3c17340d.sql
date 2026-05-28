
REVOKE EXECUTE ON FUNCTION public.get_server_keys(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.store_server_keys(uuid, text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.get_server_keys(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_server_keys(uuid, text, text) TO service_role;
