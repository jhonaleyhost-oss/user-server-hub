
-- Create increment function
CREATE OR REPLACE FUNCTION public.increment_panel_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET panel_creations_count = panel_creations_count + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Create trigger for auto-increment on panel insert
CREATE TRIGGER on_panel_created
  AFTER INSERT ON public.user_panels
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_panel_count();

-- Ensure decrement trigger exists
DROP TRIGGER IF EXISTS on_panel_deleted ON public.user_panels;
CREATE TRIGGER on_panel_deleted
  AFTER DELETE ON public.user_panels
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_panel_count();

-- Fix existing counts to match actual data
UPDATE public.profiles p
SET panel_creations_count = (
  SELECT COUNT(*) FROM public.user_panels up WHERE up.user_id = p.user_id
);
