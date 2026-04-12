
CREATE OR REPLACE FUNCTION public.decrement_panel_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET panel_creations_count = GREATEST(panel_creations_count - 1, 0)
  WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_panel_deleted
AFTER DELETE ON public.user_panels
FOR EACH ROW
EXECUTE FUNCTION public.decrement_panel_count();
