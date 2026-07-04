
-- 1. Add adp_server to app_role enum (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'adp_server'
      AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'adp_server';
  END IF;
END$$;

-- 2. Add adp_server fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adp_server_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS adp_server_permanent boolean NOT NULL DEFAULT false;

-- 3. admin_panels table
CREATE TABLE IF NOT EXISTS public.admin_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.pterodactyl_servers(id) ON DELETE CASCADE,
  ptero_user_id integer NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  login_url text NOT NULL,
  plta_key text,
  pltc_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, server_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_panels TO authenticated;
GRANT ALL ON public.admin_panels TO service_role;

ALTER TABLE public.admin_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_panels_owner_select" ON public.admin_panels
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "adm_panels_admin_all" ON public.admin_panels
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "adm_panels_owner_delete" ON public.admin_panels
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. admin_panel_subusers
CREATE TABLE IF NOT EXISTS public.admin_panel_subusers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_panel_id uuid NOT NULL REFERENCES public.admin_panels(id) ON DELETE CASCADE,
  ptero_user_id integer NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  plta_key text,
  pltc_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_panel_subusers TO authenticated;
GRANT ALL ON public.admin_panel_subusers TO service_role;

ALTER TABLE public.admin_panel_subusers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_subusers_owner_select" ON public.admin_panel_subusers
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_panels ap WHERE ap.id = admin_panel_id AND ap.user_id = auth.uid())
  );

CREATE POLICY "adm_subusers_admin_all" ON public.admin_panel_subusers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "adm_subusers_owner_delete" ON public.admin_panel_subusers
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_panels ap WHERE ap.id = admin_panel_id AND ap.user_id = auth.uid())
  );

-- 5. admin_panel_servers
CREATE TABLE IF NOT EXISTS public.admin_panel_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_panel_id uuid NOT NULL REFERENCES public.admin_panels(id) ON DELETE CASCADE,
  subuser_id uuid REFERENCES public.admin_panel_subusers(id) ON DELETE SET NULL,
  ptero_server_id integer NOT NULL,
  name text NOT NULL,
  ram integer NOT NULL DEFAULT 0,
  cpu integer NOT NULL DEFAULT 0,
  disk integer NOT NULL DEFAULT 0,
  panel_type text NOT NULL DEFAULT 'nodejs',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_panel_servers TO authenticated;
GRANT ALL ON public.admin_panel_servers TO service_role;

ALTER TABLE public.admin_panel_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_apservers_owner_select" ON public.admin_panel_servers
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_panels ap WHERE ap.id = admin_panel_id AND ap.user_id = auth.uid())
  );

CREATE POLICY "adm_apservers_admin_all" ON public.admin_panel_servers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "adm_apservers_owner_delete" ON public.admin_panel_servers
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_panels ap WHERE ap.id = admin_panel_id AND ap.user_id = auth.uid())
  );

-- 6. Updated_at trigger
CREATE TRIGGER trg_admin_panels_updated
  BEFORE UPDATE ON public.admin_panels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_admin_panel_subusers_updated
  BEFORE UPDATE ON public.admin_panel_subusers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_admin_panel_servers_updated
  BEFORE UPDATE ON public.admin_panel_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. is_adp_server_active
CREATE OR REPLACE FUNCTION public.is_adp_server_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.adp_server_permanent OR (p.adp_server_expires_at IS NOT NULL AND p.adp_server_expires_at > now())
    FROM public.profiles p WHERE p.user_id = _user_id
  ), false)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- 8. can_create_admin_panel: adp_server active OR admin
CREATE OR REPLACE FUNCTION public.can_create_admin_panel(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_adp_server_active(_user_id)
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- 9. compute_effective_role: highest tier currently active
CREATE OR REPLACE FUNCTION public.compute_effective_role(_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current app_role;
  v_reseller_active boolean;
  v_adp_active boolean;
BEGIN
  SELECT role INTO v_current FROM public.user_roles WHERE user_id = _user_id;
  IF v_current = 'admin' THEN RETURN 'admin'; END IF;

  SELECT COALESCE(p.reseller_permanent OR (p.reseller_expires_at IS NOT NULL AND p.reseller_expires_at > now()), false)
    INTO v_reseller_active
    FROM public.profiles p WHERE p.user_id = _user_id;

  SELECT COALESCE(p.adp_server_permanent OR (p.adp_server_expires_at IS NOT NULL AND p.adp_server_expires_at > now()), false)
    INTO v_adp_active
    FROM public.profiles p WHERE p.user_id = _user_id;

  IF v_adp_active THEN RETURN 'adp_server'; END IF;
  IF v_reseller_active THEN RETURN 'reseller'; END IF;
  IF v_current = 'premium' THEN RETURN 'premium'; END IF;
  RETURN 'free';
END; $$;

-- 10. sync_user_role
CREATE OR REPLACE FUNCTION public.sync_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_new app_role; v_current app_role;
BEGIN
  SELECT role INTO v_current FROM public.user_roles WHERE user_id = _user_id;
  IF v_current = 'admin' THEN RETURN 'admin'; END IF;
  v_new := public.compute_effective_role(_user_id);
  IF v_current IS NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, v_new);
  ELSIF v_current <> v_new THEN
    UPDATE public.user_roles SET role = v_new, updated_at = now() WHERE user_id = _user_id;
  END IF;
  RETURN v_new;
END; $$;

-- 11. activate_adp_server
CREATE OR REPLACE FUNCTION public.activate_adp_server(_order_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.reseller_orders%ROWTYPE;
  v_current_exp timestamptz;
  v_current_perm boolean;
  v_new_exp timestamptz;
  v_base timestamptz;
BEGIN
  SELECT * INTO v_order FROM public.reseller_orders WHERE order_id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  SELECT adp_server_expires_at, adp_server_permanent INTO v_current_exp, v_current_perm
  FROM public.profiles WHERE user_id = v_order.user_id;

  IF v_order.plan = 'adp_perm' THEN
    UPDATE public.profiles
      SET adp_server_permanent = true, adp_server_expires_at = NULL
      WHERE user_id = v_order.user_id;
    v_new_exp := NULL;
  ELSE
    IF v_current_perm THEN
      v_new_exp := NULL;
    ELSE
      v_base := GREATEST(COALESCE(v_current_exp, now()), now());
      v_new_exp := v_base + (v_order.duration_days || ' days')::interval;
      UPDATE public.profiles SET adp_server_expires_at = v_new_exp WHERE user_id = v_order.user_id;
    END IF;
  END IF;

  PERFORM public.sync_user_role(v_order.user_id);

  UPDATE public.reseller_orders
    SET status = 'completed', paid_at = now(),
        expires_at = v_new_exp,
        permanent = (v_order.plan = 'adp_perm')
    WHERE id = v_order.id;

  RETURN jsonb_build_object('success', true, 'user_id', v_order.user_id, 'expires_at', v_new_exp, 'permanent', (v_order.plan = 'adp_perm'));
END; $$;

-- 12. Update expire_ad_rentals_and_roles to handle both reseller & adp_server expiry
CREATE OR REPLACE FUNCTION public.expire_ad_rentals_and_roles()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ad_count int := 0;
  v_role_count int := 0;
  r record;
BEGIN
  -- Expire ads
  FOR r IN
    SELECT a.id, a.user_id, a.title, a.amount,
           COALESCE(p.full_name, split_part(p.email, '@', 1), 'User') AS actor_name,
           COALESCE(ur.role::text, 'free') AS actor_role
    FROM public.ad_rentals a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.user_roles ur ON ur.user_id = a.user_id
    WHERE a.status = 'active' AND a.is_admin_slot = false
      AND a.expires_at IS NOT NULL AND a.expires_at <= now()
  LOOP
    UPDATE public.ad_rentals SET status = 'expired' WHERE id = r.id;
    INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, amount, created_at)
    VALUES ('ad_expired', r.user_id, r.actor_name, r.actor_role, r.title, r.amount, now());
    v_ad_count := v_ad_count + 1;
  END LOOP;

  -- Clear expired reseller expiry (non-permanent)
  UPDATE public.profiles
    SET reseller_expires_at = NULL
    WHERE COALESCE(reseller_permanent, false) = false
      AND reseller_expires_at IS NOT NULL
      AND reseller_expires_at <= now();

  -- Clear expired adp_server expiry (non-permanent)
  UPDATE public.profiles
    SET adp_server_expires_at = NULL
    WHERE COALESCE(adp_server_permanent, false) = false
      AND adp_server_expires_at IS NOT NULL
      AND adp_server_expires_at <= now();

  -- Recompute role for users whose current role no longer matches effective role
  FOR r IN
    SELECT ur.user_id, ur.role::text AS cur_role
    FROM public.user_roles ur
    WHERE ur.role <> 'admin'
      AND ur.role <> public.compute_effective_role(ur.user_id)
  LOOP
    PERFORM public.sync_user_role(r.user_id);
    INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
    SELECT 'role_expired', r.user_id,
           COALESCE(p.full_name, split_part(p.email, '@', 1), 'User'),
           public.compute_effective_role(r.user_id)::text,
           r.cur_role, now()
    FROM public.profiles p WHERE p.user_id = r.user_id;
    v_role_count := v_role_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ads_expired', v_ad_count, 'roles_expired', v_role_count, 'ran_at', now());
END; $$;
