
-- Table
CREATE TABLE public.ad_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','disabled','cancelled')),
  amount integer,
  starts_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  is_admin_slot boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT 'Iklan Anda',
  content text NOT NULL DEFAULT '',
  image_url text,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ad_rentals_user_id_idx ON public.ad_rentals(user_id);
CREATE INDEX ad_rentals_status_idx ON public.ad_rentals(status);
CREATE INDEX ad_rentals_expires_at_idx ON public.ad_rentals(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_rentals TO authenticated;
GRANT ALL ON public.ad_rentals TO service_role;

ALTER TABLE public.ad_rentals ENABLE ROW LEVEL SECURITY;

-- Users can view their own rentals (any status)
CREATE POLICY "Users view own rentals"
ON public.ad_rentals FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins view all
CREATE POLICY "Admins view all rentals"
ON public.ad_rentals FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- All authenticated users can view active non-expired rentals (for popup rendering)
CREATE POLICY "Authenticated view active rentals"
ON public.ad_rentals FOR SELECT TO authenticated
USING (
  status = 'active' AND (expires_at IS NULL OR expires_at > now())
);

-- Users can insert their own pending rental
CREATE POLICY "Users insert own rentals"
ON public.ad_rentals FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own rental content
CREATE POLICY "Users update own rentals"
ON public.ad_rentals FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can update/delete any
CREATE POLICY "Admins update any rental"
ON public.ad_rentals FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete any rental"
ON public.ad_rentals FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users delete own pending rentals"
ON public.ad_rentals FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status IN ('pending','cancelled'));

-- updated_at trigger
CREATE TRIGGER ad_rentals_set_updated_at
BEFORE UPDATE ON public.ad_rentals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Slot validation trigger (max 2 non-admin active per calendar month)
CREATE OR REPLACE FUNCTION public.validate_ad_rental_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  -- Only check when transitioning to active and not admin slot
  IF NEW.status <> 'active' OR NEW.is_admin_slot THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', COALESCE(NEW.starts_at, now()));
  v_month_end := v_month_start + interval '1 month';

  SELECT COUNT(*) INTO v_count
  FROM public.ad_rentals
  WHERE status = 'active'
    AND is_admin_slot = false
    AND starts_at >= v_month_start
    AND starts_at < v_month_end
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'ad_slot_full: maksimal 2 slot iklan per bulan sudah terisi';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ad_rentals_validate_slot
BEFORE INSERT OR UPDATE ON public.ad_rentals
FOR EACH ROW EXECUTE FUNCTION public.validate_ad_rental_slot();

-- Function: get slot info for current month
CREATE OR REPLACE FUNCTION public.get_ad_slot_info()
RETURNS TABLE(total int, used int, available int, month_start timestamptz, month_end timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT date_trunc('month', now()) AS ms,
           date_trunc('month', now()) + interval '1 month' AS me
  )
  SELECT
    2 AS total,
    COALESCE((
      SELECT COUNT(*)::int FROM public.ad_rentals r, bounds b
      WHERE r.status = 'active'
        AND r.is_admin_slot = false
        AND r.starts_at >= b.ms
        AND r.starts_at < b.me
    ), 0) AS used,
    GREATEST(0, 2 - COALESCE((
      SELECT COUNT(*)::int FROM public.ad_rentals r, bounds b
      WHERE r.status = 'active'
        AND r.is_admin_slot = false
        AND r.starts_at >= b.ms
        AND r.starts_at < b.me
    ), 0)) AS available,
    b.ms, b.me
  FROM bounds b;
$$;

-- Function: get active ads with owner name (used by popup)
CREATE OR REPLACE FUNCTION public.get_active_ads()
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  image_url text,
  buttons jsonb,
  owner_name text,
  owner_role app_role,
  is_admin_slot boolean,
  expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.title, r.content, r.image_url, r.buttons,
    COALESCE(p.full_name, split_part(p.email, '@', 1), 'User') AS owner_name,
    COALESCE(ur.role, 'free'::app_role) AS owner_role,
    r.is_admin_slot,
    r.expires_at
  FROM public.ad_rentals r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = r.user_id
  WHERE r.status = 'active'
    AND (r.expires_at IS NULL OR r.expires_at > now())
    AND length(coalesce(r.content, '')) > 0;
$$;

-- Function: activate ad rental after payment verified (called by webhook)
CREATE OR REPLACE FUNCTION public.activate_ad_rental(_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rental public.ad_rentals%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT * INTO v_rental FROM public.ad_rentals WHERE order_id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  IF v_rental.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  v_start := now();
  v_end := v_start + interval '30 days';

  UPDATE public.ad_rentals
  SET status = 'active',
      starts_at = v_start,
      expires_at = v_end,
      paid_at = v_start
  WHERE id = v_rental.id;

  -- Log to activity_events for dashboard notification
  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, amount, created_at)
  SELECT 'ad_rental', v_rental.user_id,
    COALESCE(p.full_name, split_part(p.email, '@', 1), 'User'),
    COALESCE(ur.role::text, 'free'),
    v_rental.title,
    v_rental.amount,
    now()
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = v_rental.user_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_rental.user_id, 'expires_at', v_end);
END;
$$;

-- Function: admin creates own ad slot (unlimited, no slot check needed because is_admin_slot=true)
CREATE OR REPLACE FUNCTION public.create_admin_ad(_title text, _content text, _image_url text, _buttons jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  INSERT INTO public.ad_rentals (user_id, status, is_admin_slot, starts_at, expires_at, title, content, image_url, buttons, paid_at)
  VALUES (auth.uid(), 'active', true, now(), NULL, COALESCE(_title, 'Iklan Admin'), COALESCE(_content, ''), _image_url, COALESCE(_buttons, '[]'::jsonb), now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
