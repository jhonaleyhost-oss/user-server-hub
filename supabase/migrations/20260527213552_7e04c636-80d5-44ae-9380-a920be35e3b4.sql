
-- 1. Buat tabel activity_events (versi sanitized yang aman disiarkan realtime)
CREATE TABLE public.activity_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL, -- 'panel' | 'signup' | 'upgrade' | 'tip'
  actor_user_id uuid,
  actor_name text,
  actor_role text,
  detail text,
  amount integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_events_created_at ON public.activity_events (created_at DESC);
CREATE INDEX idx_activity_events_kind ON public.activity_events (kind);

GRANT SELECT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view activity events"
  ON public.activity_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins delete activity events"
  ON public.activity_events FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. Helper untuk ambil nama + role
CREATE OR REPLACE FUNCTION public._actor_snapshot(_user_id uuid)
RETURNS TABLE(name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(p.full_name, split_part(p.email, '@', 1), 'User'),
    COALESCE(ur.role::text, 'free')
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

-- 3. Trigger: panel created
CREATE OR REPLACE FUNCTION public.trg_activity_panel_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_role text;
BEGIN
  SELECT name, role INTO v_name, v_role FROM public._actor_snapshot(NEW.user_id);
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
  VALUES ('panel', NEW.user_id, v_name, v_role, NEW.username, NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_panel_insert_activity
AFTER INSERT ON public.user_panels
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_panel_insert();

-- 4. Trigger: signup (profile insert)
CREATE OR REPLACE FUNCTION public.trg_activity_signup_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  v_name := COALESCE(NEW.full_name, split_part(NEW.email, '@', 1), 'User');
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, created_at)
  VALUES ('signup', NEW.user_id, v_name, 'free', NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_insert_activity
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_signup_insert();

-- 5. Trigger: reseller order completed
CREATE OR REPLACE FUNCTION public.trg_activity_order_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_role text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT name, role INTO v_name, v_role FROM public._actor_snapshot(NEW.user_id);
    INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, amount, created_at)
    VALUES ('upgrade', NEW.user_id, v_name, v_role, NEW.plan, NEW.amount, COALESCE(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_completed_activity
AFTER UPDATE ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_order_completed();

-- 6. Trigger: tip completed
CREATE OR REPLACE FUNCTION public.trg_activity_tip_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_role text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT name, role INTO v_name, v_role FROM public._actor_snapshot(NEW.user_id);
    INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, amount, created_at)
    VALUES ('tip', NEW.user_id, v_name, v_role, NEW.amount, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tip_completed_activity
AFTER UPDATE ON public.tips
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_tip_completed();

-- 7. Hapus tabel sensitif dari realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_panels;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tips;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reseller_orders;

-- 8. Tambahkan activity_events ke realtime publication
ALTER TABLE public.activity_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
