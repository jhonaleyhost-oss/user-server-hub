-- Function: expire ad rentals & reseller roles, log to activity_events
CREATE OR REPLACE FUNCTION public.expire_ad_rentals_and_roles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad_count int := 0;
  v_role_count int := 0;
  r record;
BEGIN
  -- Expire active ads whose expires_at has passed
  FOR r IN
    SELECT a.id, a.user_id, a.title, a.amount, a.expires_at,
           COALESCE(p.full_name, split_part(p.email, '@', 1), 'User') AS actor_name,
           COALESCE(ur.role::text, 'free') AS actor_role
    FROM public.ad_rentals a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.user_roles ur ON ur.user_id = a.user_id
    WHERE a.status = 'active'
      AND a.is_admin_slot = false
      AND a.expires_at IS NOT NULL
      AND a.expires_at <= now()
  LOOP
    UPDATE public.ad_rentals SET status = 'expired' WHERE id = r.id;
    INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, amount, created_at)
    VALUES ('ad_expired', r.user_id, r.actor_name, r.actor_role, r.title, r.amount, now());
    v_ad_count := v_ad_count + 1;
  END LOOP;

  -- Downgrade reseller role whose expiry has passed (non-permanent, non-admin)
  FOR r IN
    SELECT p.user_id, p.reseller_expires_at,
           COALESCE(p.full_name, split_part(p.email, '@', 1), 'User') AS actor_name,
           ur.role AS cur_role
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE COALESCE(p.reseller_permanent, false) = false
      AND p.reseller_expires_at IS NOT NULL
      AND p.reseller_expires_at <= now()
      AND ur.role = 'reseller'
  LOOP
    UPDATE public.user_roles SET role = 'free', updated_at = now() WHERE user_id = r.user_id;
    UPDATE public.profiles SET reseller_expires_at = NULL WHERE user_id = r.user_id;
    INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
    VALUES ('role_expired', r.user_id, r.actor_name, 'free', 'reseller', now());
    v_role_count := v_role_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ads_expired', v_ad_count, 'roles_expired', v_role_count, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_ad_rentals_and_roles() TO service_role, authenticated;

-- Schedule via pg_cron every 5 minutes (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-ads-and-roles') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-ads-and-roles');
    PERFORM cron.schedule('expire-ads-and-roles', '*/5 * * * *', $cron$SELECT public.expire_ad_rentals_and_roles();$cron$);
  END IF;
END $$;

-- Run once now to clean up
SELECT public.expire_ad_rentals_and_roles();