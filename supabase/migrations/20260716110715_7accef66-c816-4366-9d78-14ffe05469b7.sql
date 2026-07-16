
CREATE OR REPLACE FUNCTION public.get_revenue_stats(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz := now() - (_days || ' days')::interval;
  v_total bigint := 0;
  v_reseller bigint := 0;
  v_adp bigint := 0;
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
    WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= v_start
    AND (plan IS NULL OR plan NOT LIKE 'adp_%');
  SELECT COALESCE(SUM(amount),0) INTO v_adp FROM public.reseller_orders
    WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= v_start
    AND plan LIKE 'adp_%';
  SELECT COALESCE(SUM(amount),0) INTO v_ads FROM public.ad_rentals
    WHERE paid_at IS NOT NULL AND paid_at >= v_start AND is_admin_slot = false;
  SELECT COALESCE(SUM(amount),0) INTO v_tips FROM public.tips
    WHERE status = 'completed' AND created_at >= v_start;
  v_total := v_reseller + v_adp + v_ads + v_tips;

  SELECT COUNT(*) INTO v_orders_count FROM (
    SELECT 1 FROM public.reseller_orders WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= v_start
    UNION ALL
    SELECT 1 FROM public.ad_rentals WHERE paid_at IS NOT NULL AND paid_at >= v_start AND is_admin_slot = false
    UNION ALL
    SELECT 1 FROM public.tips WHERE status = 'completed' AND created_at >= v_start
  ) x;

  WITH days AS (
    SELECT generate_series(date_trunc('day', v_start), date_trunc('day', now()), '1 day'::interval) AS day
  ),
  r AS (
    SELECT date_trunc('day', COALESCE(paid_at, created_at)) AS day, SUM(amount)::bigint AS amt
    FROM public.reseller_orders WHERE status='completed' AND COALESCE(paid_at,created_at)>=v_start
      AND (plan IS NULL OR plan NOT LIKE 'adp_%') GROUP BY 1
  ),
  adp AS (
    SELECT date_trunc('day', COALESCE(paid_at, created_at)) AS day, SUM(amount)::bigint AS amt
    FROM public.reseller_orders WHERE status='completed' AND COALESCE(paid_at,created_at)>=v_start
      AND plan LIKE 'adp_%' GROUP BY 1
  ),
  a AS (
    SELECT date_trunc('day', paid_at) AS day, SUM(amount)::bigint AS amt
    FROM public.ad_rentals WHERE paid_at IS NOT NULL AND paid_at>=v_start AND is_admin_slot=false GROUP BY 1
  ),
  t AS (
    SELECT date_trunc('day', created_at) AS day, SUM(amount)::bigint AS amt
    FROM public.tips WHERE status='completed' AND created_at>=v_start GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'day', to_char(d.day,'YYYY-MM-DD'),
    'reseller', COALESCE(r.amt,0),
    'adp', COALESCE(adp.amt,0),
    'ads', COALESCE(a.amt,0),
    'tips', COALESCE(t.amt,0),
    'total', COALESCE(r.amt,0)+COALESCE(adp.amt,0)+COALESCE(a.amt,0)+COALESCE(t.amt,0)
  ) ORDER BY d.day) INTO v_daily
  FROM days d
    LEFT JOIN r ON r.day=d.day
    LEFT JOIN adp ON adp.day=d.day
    LEFT JOIN a ON a.day=d.day
    LEFT JOIN t ON t.day=d.day;

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
    'adp', v_adp,
    'ads', v_ads,
    'tips', v_tips,
    'orders_count', v_orders_count,
    'days', _days,
    'daily', COALESCE(v_daily,'[]'::jsonb),
    'top_spenders', COALESCE(v_top,'[]'::jsonb)
  );
END; $function$;
