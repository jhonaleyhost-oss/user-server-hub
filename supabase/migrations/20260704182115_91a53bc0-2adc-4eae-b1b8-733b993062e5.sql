-- Panel deleted trigger
CREATE OR REPLACE FUNCTION public.trg_activity_panel_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_name text; v_role text; v_server text;
BEGIN
  SELECT name, role INTO v_name, v_role FROM public._actor_snapshot(OLD.user_id);
  SELECT COALESCE(name, domain, '') INTO v_server FROM public.pterodactyl_servers WHERE id = OLD.server_id;
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
  VALUES ('panel_deleted', OLD.user_id, v_name, COALESCE(v_role,'free'),
          COALESCE(OLD.username,'') || '|' || COALESCE(OLD.panel_type,'nodejs') || '|' || COALESCE(v_server,''),
          now());
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS user_panels_activity_delete ON public.user_panels;
CREATE TRIGGER user_panels_activity_delete
  AFTER DELETE ON public.user_panels
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_panel_deleted();

-- Admin panel created trigger (fires when admin_panels row inserted)
CREATE OR REPLACE FUNCTION public.trg_activity_admin_panel_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_name text; v_role text; v_server text;
BEGIN
  SELECT name, role INTO v_name, v_role FROM public._actor_snapshot(NEW.user_id);
  SELECT COALESCE(name, domain, '') INTO v_server FROM public.pterodactyl_servers WHERE id = NEW.server_id;
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
  VALUES ('admin_panel', NEW.user_id, v_name, COALESCE(v_role,'adp_server'),
          COALESCE(NEW.username,'') || '|' || COALESCE(v_server,''),
          now());
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS admin_panels_activity_insert ON public.admin_panels;
CREATE TRIGGER admin_panels_activity_insert
  AFTER INSERT ON public.admin_panels
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_admin_panel_created();

-- User deleted trigger (fires when profile row deleted, ie account fully removed)
CREATE OR REPLACE FUNCTION public.trg_activity_user_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_name text; v_role text;
BEGIN
  v_name := COALESCE(OLD.full_name, split_part(OLD.email,'@',1), 'User');
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = OLD.user_id;
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
  VALUES ('user_deleted', OLD.user_id, v_name, COALESCE(v_role,'free'), OLD.email, now());
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS profiles_activity_delete ON public.profiles;
CREATE TRIGGER profiles_activity_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_user_deleted();