CREATE OR REPLACE FUNCTION public.activate_ad_rental(_order_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rental public.ad_rentals%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_current_exp timestamptz;
  v_current_perm boolean;
  v_new_exp timestamptz;
  v_base timestamptz;
  v_existing_role app_role;
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

  -- BONUS: Grant reseller role for 30 days (extend if already reseller, skip if permanent/admin)
  SELECT reseller_expires_at, reseller_permanent INTO v_current_exp, v_current_perm
  FROM public.profiles WHERE user_id = v_rental.user_id;

  SELECT role INTO v_existing_role FROM public.user_roles WHERE user_id = v_rental.user_id;

  IF v_existing_role IS DISTINCT FROM 'admin' THEN
    IF NOT COALESCE(v_current_perm, false) THEN
      v_base := GREATEST(COALESCE(v_current_exp, now()), now());
      v_new_exp := v_base + interval '30 days';
      UPDATE public.profiles
        SET reseller_expires_at = v_new_exp
        WHERE user_id = v_rental.user_id;
    END IF;

    IF v_existing_role IS NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_rental.user_id, 'reseller');
    ELSIF v_existing_role <> 'reseller' THEN
      UPDATE public.user_roles SET role = 'reseller', updated_at = now()
        WHERE user_id = v_rental.user_id;
    END IF;
  END IF;

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

  RETURN jsonb_build_object('success', true, 'user_id', v_rental.user_id, 'expires_at', v_end, 'reseller_until', v_new_exp);
END;
$function$;