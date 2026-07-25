
CREATE OR REPLACE FUNCTION public.activate_ad_rental(_order_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rental public.ad_rentals%ROWTYPE;
  v_existing public.ad_rentals%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_days int;
  v_current_exp timestamptz;
  v_current_perm boolean;
  v_new_exp timestamptz;
  v_base timestamptz;
  v_existing_role app_role;
  v_extended boolean := false;
BEGIN
  SELECT * INTO v_rental FROM public.ad_rentals WHERE order_id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  IF v_rental.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  v_days := GREATEST(1, COALESCE(v_rental.duration_days, 30));

  -- If user already has an active non-admin rental, EXTEND it instead of activating a new slot.
  SELECT * INTO v_existing
  FROM public.ad_rentals
  WHERE user_id = v_rental.user_id
    AND id <> v_rental.id
    AND is_admin_slot = false
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY expires_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_extended := true;
    v_base := GREATEST(COALESCE(v_existing.expires_at, now()), now());
    v_end := v_base + (v_days || ' days')::interval;
    UPDATE public.ad_rentals
      SET expires_at = v_end,
          amount = COALESCE(amount, 0) + COALESCE(v_rental.amount, 0),
          duration_days = COALESCE(duration_days, 0) + v_days
      WHERE id = v_existing.id;
    -- Remove the pending placeholder so it doesn't consume a slot.
    DELETE FROM public.ad_rentals WHERE id = v_rental.id;
  ELSE
    v_start := now();
    v_end := v_start + (v_days || ' days')::interval;
    UPDATE public.ad_rentals
    SET status = 'active',
        starts_at = v_start,
        expires_at = v_end,
        paid_at = v_start
    WHERE id = v_rental.id;
  END IF;

  -- BONUS: Grant / extend reseller role for SAME duration as ad package
  SELECT reseller_expires_at, reseller_permanent INTO v_current_exp, v_current_perm
  FROM public.profiles WHERE user_id = v_rental.user_id;

  SELECT role INTO v_existing_role FROM public.user_roles WHERE user_id = v_rental.user_id;

  IF v_existing_role IS DISTINCT FROM 'admin' THEN
    IF NOT COALESCE(v_current_perm, false) THEN
      v_base := GREATEST(COALESCE(v_current_exp, now()), now());
      v_new_exp := v_base + (v_days || ' days')::interval;
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

  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, amount, created_at)
  SELECT CASE WHEN v_extended THEN 'ad_extended' ELSE 'ad_rental' END,
    v_rental.user_id,
    COALESCE(p.full_name, split_part(p.email, '@', 1), 'User'),
    COALESCE(ur.role::text, 'free'),
    v_rental.title,
    v_rental.amount,
    now()
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = v_rental.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_rental.user_id,
    'expires_at', v_end,
    'reseller_until', v_new_exp,
    'duration_days', v_days,
    'extended', v_extended
  );
END;
$function$;
