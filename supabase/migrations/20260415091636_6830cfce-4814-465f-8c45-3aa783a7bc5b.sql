CREATE OR REPLACE FUNCTION public.decrement_panel_count(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET panel_creations_count = GREATEST(panel_creations_count - 1, 0)
  WHERE user_id = _user_id;
END;
$$;