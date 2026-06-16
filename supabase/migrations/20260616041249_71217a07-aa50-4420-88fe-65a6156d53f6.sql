
-- ============================================
-- 1. NOTIFICATIONS (BROADCAST)
-- ============================================
CREATE TYPE public.notification_audience AS ENUM ('all', 'free', 'reseller', 'premium', 'admin');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  banner_url text,
  link_url text,
  audience public.notification_audience NOT NULL DEFAULT 'all',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete notifications" ON public.notifications
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reads" ON public.notification_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own reads" ON public.notification_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own reads" ON public.notification_reads
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);

-- Helper: filter by audience using user's role
CREATE OR REPLACE FUNCTION public._user_matches_audience(_user_id uuid, _aud public.notification_audience)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _aud = 'all' THEN true
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _aud::text)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_notifications(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, title text, body text, banner_url text, link_url text,
  audience public.notification_audience, created_at timestamptz, is_read boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.title, n.body, n.banner_url, n.link_url, n.audience, n.created_at,
    EXISTS(SELECT 1 FROM public.notification_reads r WHERE r.notification_id = n.id AND r.user_id = auth.uid()) AS is_read
  FROM public.notifications n
  WHERE public._user_matches_audience(auth.uid(), n.audience)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.notifications n
  WHERE public._user_matches_audience(auth.uid(), n.audience)
    AND NOT EXISTS (SELECT 1 FROM public.notification_reads r WHERE r.notification_id = n.id AND r.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, auth.uid() FROM public.notifications n
  WHERE public._user_matches_audience(auth.uid(), n.audience)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================
-- 2. PROMO CODES
-- ============================================
CREATE TYPE public.promo_discount_type AS ENUM ('percent', 'amount');
CREATE TYPE public.promo_scope AS ENUM ('reseller', 'ads', 'both');

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  banner_url text,
  discount_type public.promo_discount_type NOT NULL DEFAULT 'percent',
  discount_value int NOT NULL CHECK (discount_value > 0),
  min_amount int NOT NULL DEFAULT 0,
  max_discount int,
  scope public.promo_scope NOT NULL DEFAULT 'both',
  quota int,
  used_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active promos" ON public.promo_codes
  FOR SELECT TO authenticated USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage promos insert" ON public.promo_codes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage promos update" ON public.promo_codes
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage promos delete" ON public.promo_codes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_ref text,
  scope public.promo_scope NOT NULL,
  discount_applied int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own redemptions" ON public.promo_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users insert own redemption" ON public.promo_redemptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_promo_redemptions_user ON public.promo_redemptions(user_id);
CREATE INDEX idx_promo_redemptions_promo ON public.promo_redemptions(promo_id);

-- Validate & compute discount
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _scope public.promo_scope, _amount int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.promo_codes%ROWTYPE;
  v_discount int := 0;
BEGIN
  SELECT * INTO v FROM public.promo_codes WHERE upper(code) = upper(_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode tidak ditemukan');
  END IF;
  IF NOT v.active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode tidak aktif');
  END IF;
  IF v.starts_at IS NOT NULL AND v.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode belum berlaku');
  END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode sudah kedaluwarsa');
  END IF;
  IF v.quota IS NOT NULL AND v.used_count >= v.quota THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kuota habis');
  END IF;
  IF v.scope <> 'both' AND v.scope <> _scope THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode tidak berlaku untuk pembelian ini');
  END IF;
  IF _amount < v.min_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum belanja Rp ' || v.min_amount::text);
  END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE promo_id = v.id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode hanya bisa dipakai sekali per akun');
  END IF;

  IF v.discount_type = 'percent' THEN
    v_discount := (_amount * v.discount_value) / 100;
  ELSE
    v_discount := v.discount_value;
  END IF;
  IF v.max_discount IS NOT NULL AND v_discount > v.max_discount THEN
    v_discount := v.max_discount;
  END IF;
  IF v_discount > _amount THEN v_discount := _amount; END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'promo_id', v.id,
    'code', v.code,
    'description', v.description,
    'discount', v_discount,
    'final_amount', _amount - v_discount
  );
END; $$;

-- ============================================
-- 3. REVENUE ANALYTICS (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_revenue_stats(_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz := now() - (_days || ' days')::interval;
  v_total bigint := 0;
  v_reseller bigint := 0;
  v_ads bigint := 0;
  v_tips bigint := 0;
  v_orders_count int := 0;
  v_daily jsonb;
  v_top jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_reseller FROM public.reseller_orders
    WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= v_start;
  SELECT COALESCE(SUM(amount),0) INTO v_ads FROM public.ad_rentals
    WHERE paid_at IS NOT NULL AND paid_at >= v_start AND is_admin_slot = false;
  SELECT COALESCE(SUM(amount),0) INTO v_tips FROM public.tips
    WHERE status = 'completed' AND created_at >= v_start;
  v_total := v_reseller + v_ads + v_tips;

  SELECT COUNT(*) INTO v_orders_count FROM (
    SELECT 1 FROM public.reseller_orders WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= v_start
    UNION ALL
    SELECT 1 FROM public.ad_rentals WHERE paid_at IS NOT NULL AND paid_at >= v_start AND is_admin_slot = false
    UNION ALL
    SELECT 1 FROM public.tips WHERE status = 'completed' AND created_at >= v_start
  ) x;

  -- Daily breakdown
  WITH days AS (
    SELECT generate_series(date_trunc('day', v_start), date_trunc('day', now()), '1 day'::interval) AS day
  ),
  r AS (
    SELECT date_trunc('day', COALESCE(paid_at, created_at)) AS day, SUM(amount)::bigint AS amt
    FROM public.reseller_orders WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= v_start GROUP BY 1
  ),
  a AS (
    SELECT date_trunc('day', paid_at) AS day, SUM(amount)::bigint AS amt
    FROM public.ad_rentals WHERE paid_at IS NOT NULL AND paid_at >= v_start AND is_admin_slot = false GROUP BY 1
  ),
  t AS (
    SELECT date_trunc('day', created_at) AS day, SUM(amount)::bigint AS amt
    FROM public.tips WHERE status = 'completed' AND created_at >= v_start GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'day', to_char(d.day,'YYYY-MM-DD'),
    'reseller', COALESCE(r.amt,0),
    'ads', COALESCE(a.amt,0),
    'tips', COALESCE(t.amt,0),
    'total', COALESCE(r.amt,0)+COALESCE(a.amt,0)+COALESCE(t.amt,0)
  ) ORDER BY d.day) INTO v_daily
  FROM days d LEFT JOIN r ON r.day=d.day LEFT JOIN a ON a.day=d.day LEFT JOIN t ON t.day=d.day;

  -- Top spenders
  WITH spend AS (
    SELECT user_id, amount FROM public.reseller_orders WHERE status='completed' AND COALESCE(paid_at,created_at)>=v_start
    UNION ALL
    SELECT user_id, amount FROM public.ad_rentals WHERE paid_at IS NOT NULL AND paid_at>=v_start AND is_admin_slot=false
    UNION ALL
    SELECT user_id, amount FROM public.tips WHERE status='completed' AND created_at>=v_start
  )
  SELECT jsonb_agg(row_to_json(s)) INTO v_top FROM (
    SELECT sp.user_id,
      COALESCE(p.full_name, split_part(p.email,'@',1), 'User') AS name,
      p.avatar_url,
      SUM(sp.amount)::bigint AS total
    FROM spend sp LEFT JOIN public.profiles p ON p.user_id = sp.user_id
    GROUP BY sp.user_id, p.full_name, p.email, p.avatar_url
    ORDER BY total DESC LIMIT 10
  ) s;

  RETURN jsonb_build_object(
    'total', v_total,
    'reseller', v_reseller,
    'ads', v_ads,
    'tips', v_tips,
    'orders_count', v_orders_count,
    'days', _days,
    'daily', COALESCE(v_daily, '[]'::jsonb),
    'top_spenders', COALESCE(v_top, '[]'::jsonb)
  );
END; $$;
