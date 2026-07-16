CREATE OR REPLACE FUNCTION public.approve_warranty_claim(_claim_id uuid, _admin_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v public.role_warranty_claims%ROWTYPE;
  v_current_exp timestamptz;
  v_current_perm boolean;
  v_base timestamptz;
  v_new_exp timestamptz;
  v_existing_role app_role;
  v_actor_name text;
  v_username text;
  v_role_label text;
  v_duration_label text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO v FROM public.role_warranty_claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'claim_not_found');
  END IF;
  IF v.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_reviewed');
  END IF;

  IF v.requested_role = 'reseller' THEN
    SELECT reseller_expires_at, reseller_permanent INTO v_current_exp, v_current_perm
      FROM public.profiles WHERE user_id = v.user_id;
    IF v.permanent THEN
      UPDATE public.profiles SET reseller_permanent = true, reseller_expires_at = NULL
        WHERE user_id = v.user_id;
      v_new_exp := NULL;
    ELSIF NOT COALESCE(v_current_perm, false) THEN
      v_base := GREATEST(COALESCE(v_current_exp, now()), now());
      v_new_exp := v_base + (v.duration_months || ' months')::interval;
      UPDATE public.profiles SET reseller_expires_at = v_new_exp WHERE user_id = v.user_id;
    END IF;
  ELSIF v.requested_role = 'adp_server' THEN
    SELECT adp_server_expires_at, adp_server_permanent INTO v_current_exp, v_current_perm
      FROM public.profiles WHERE user_id = v.user_id;
    IF v.permanent THEN
      UPDATE public.profiles SET adp_server_permanent = true, adp_server_expires_at = NULL
        WHERE user_id = v.user_id;
      v_new_exp := NULL;
    ELSIF NOT COALESCE(v_current_perm, false) THEN
      v_base := GREATEST(COALESCE(v_current_exp, now()), now());
      v_new_exp := v_base + (v.duration_months || ' months')::interval;
      UPDATE public.profiles SET adp_server_expires_at = v_new_exp WHERE user_id = v.user_id;
    END IF;
  ELSIF v.requested_role = 'premium' THEN
    SELECT role INTO v_existing_role FROM public.user_roles WHERE user_id = v.user_id;
    IF v_existing_role IS NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v.user_id, 'premium');
    ELSIF v_existing_role NOT IN ('admin','reseller','adp_server','premium') THEN
      UPDATE public.user_roles SET role = 'premium', updated_at = now() WHERE user_id = v.user_id;
    END IF;
  END IF;

  PERFORM public.sync_user_role(v.user_id);

  UPDATE public.role_warranty_claims
    SET status = 'approved', admin_note = _admin_note,
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _claim_id;

  SELECT COALESCE(p.full_name, split_part(p.email,'@',1), 'User') INTO v_actor_name
    FROM public.profiles p WHERE p.user_id = v.user_id;

  INSERT INTO public.activity_events (kind, actor_user_id, actor_name, actor_role, detail, created_at)
  VALUES ('warranty_approved', v.user_id, v_actor_name, v.requested_role::text,
          CASE WHEN v.permanent THEN 'permanent' ELSE (v.duration_months::text || ' bulan') END, now());

  -- Send personal notification to the user
  v_role_label := CASE v.requested_role
    WHEN 'reseller' THEN 'Reseller'
    WHEN 'adp_server' THEN 'Admin Panel (ADP)'
    WHEN 'premium' THEN 'Premium'
    ELSE v.requested_role::text
  END;
  v_duration_label := CASE WHEN v.permanent THEN 'Permanen' ELSE (v.duration_months::text || ' bulan') END;
  v_username := COALESCE(NULLIF(v.deleted_username, ''), v_actor_name);

  INSERT INTO public.notifications (title, body, audience, target_user_id, created_by, link_url)
  VALUES (
    'Role Dipulihkan ✅',
    'Role @' || v_username || ' sudah dipulihkan ke ' || v_role_label || ' (' || v_duration_label || ').',
    'all',
    v.user_id,
    auth.uid(),
    '/garansi'
  );

  RETURN jsonb_build_object('success', true, 'user_id', v.user_id, 'role', v.requested_role,
                            'expires_at', v_new_exp, 'permanent', v.permanent);
END; $function$;