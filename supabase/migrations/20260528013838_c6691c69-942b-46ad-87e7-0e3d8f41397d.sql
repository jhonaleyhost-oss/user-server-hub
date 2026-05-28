
CREATE OR REPLACE FUNCTION public.activate_reseller(_order_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.reseller_orders%ROWTYPE;
  v_current_exp timestamptz;
  v_current_perm boolean;
  v_new_exp timestamptz;
  v_base timestamptz;
  v_existing_role app_role;
BEGIN
  SELECT * INTO v_order FROM public.reseller_orders WHERE order_id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  SELECT reseller_expires_at, reseller_permanent INTO v_current_exp, v_current_perm
  FROM public.profiles WHERE user_id = v_order.user_id;

  IF v_order.plan = 'perm' THEN
    UPDATE public.profiles
      SET reseller_permanent = true,
          reseller_expires_at = NULL
      WHERE user_id = v_order.user_id;
    v_new_exp := NULL;
  ELSE
    IF v_current_perm THEN
      v_new_exp := NULL;
    ELSE
      v_base := GREATEST(COALESCE(v_current_exp, now()), now());
      v_new_exp := v_base + (v_order.duration_days || ' days')::interval;
      UPDATE public.profiles
        SET reseller_expires_at = v_new_exp
        WHERE user_id = v_order.user_id;
    END IF;
  END IF;

  -- Upsert role using the actual unique constraint (user_id)
  SELECT role INTO v_existing_role FROM public.user_roles WHERE user_id = v_order.user_id;
  IF v_existing_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_order.user_id, 'reseller');
  ELSIF v_existing_role <> 'admin' AND v_existing_role <> 'reseller' THEN
    UPDATE public.user_roles SET role = 'reseller', updated_at = now()
      WHERE user_id = v_order.user_id;
  END IF;

  UPDATE public.reseller_orders
    SET status = 'completed',
        paid_at = now(),
        expires_at = v_new_exp,
        permanent = (v_order.plan = 'perm')
    WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_order.user_id,
    'expires_at', v_new_exp,
    'permanent', (v_order.plan = 'perm')
  );
END;
$function$;
