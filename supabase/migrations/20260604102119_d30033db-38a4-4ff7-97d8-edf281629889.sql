CREATE OR REPLACE FUNCTION public.trg_activity_panel_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_role text;
BEGIN
  SELECT name, role INTO v_name, v_role FROM public._actor_snapshot(NEW.user_id);
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
  VALUES ('panel', NEW.user_id, v_name, v_role, NEW.username || '|' || COALESCE(NEW.panel_type, 'nodejs'), NEW.created_at);
  RETURN NEW;
END;
$$;