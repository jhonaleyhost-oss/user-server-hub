
DO $$ BEGIN
  CREATE TYPE public.warranty_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.role_warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_image_url text NOT NULL,
  invoice_storage_path text,
  purchase_at timestamptz NOT NULL,
  requested_role app_role NOT NULL,
  duration_months int,
  permanent boolean NOT NULL DEFAULT false,
  user_note text,
  status warranty_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warranty_role_valid CHECK (requested_role IN ('reseller','adp_server','premium')),
  CONSTRAINT warranty_duration_valid CHECK (
    permanent = true OR (duration_months IS NOT NULL AND duration_months BETWEEN 1 AND 60)
  )
);

CREATE INDEX role_warranty_claims_user_idx ON public.role_warranty_claims(user_id, created_at DESC);
CREATE INDEX role_warranty_claims_status_idx ON public.role_warranty_claims(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.role_warranty_claims TO authenticated;
GRANT ALL ON public.role_warranty_claims TO service_role;

ALTER TABLE public.role_warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warranty claims"
  ON public.role_warranty_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can create own warranty claims"
  ON public.role_warranty_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can update warranty claims"
  ON public.role_warranty_claims FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_role_warranty_claims_updated
  BEFORE UPDATE ON public.role_warranty_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies
CREATE POLICY "Users can upload own warranty invoice"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'warranty-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own warranty invoice"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'warranty-invoices'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

CREATE POLICY "Users can delete own warranty invoice"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'warranty-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Approve
CREATE OR REPLACE FUNCTION public.approve_warranty_claim(_claim_id uuid, _admin_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v public.role_warranty_claims%ROWTYPE;
  v_current_exp timestamptz;
  v_current_perm boolean;
  v_base timestamptz;
  v_new_exp timestamptz;
  v_existing_role app_role;
  v_actor_name text;
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

  RETURN jsonb_build_object('success', true, 'user_id', v.user_id, 'role', v.requested_role,
                            'expires_at', v_new_exp, 'permanent', v.permanent);
END; $$;

-- Reject
CREATE OR REPLACE FUNCTION public.reject_warranty_claim(_claim_id uuid, _admin_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v public.role_warranty_claims%ROWTYPE;
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
  UPDATE public.role_warranty_claims
    SET status = 'rejected', admin_note = _admin_note,
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _claim_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- Admin list
CREATE OR REPLACE FUNCTION public.get_warranty_claims(_status warranty_status DEFAULT NULL, _limit int DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  active_role app_role,
  invoice_image_url text,
  invoice_storage_path text,
  purchase_at timestamptz,
  requested_role app_role,
  duration_months int,
  permanent boolean,
  user_note text,
  status warranty_status,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, c.user_id,
    p.full_name, p.email, p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS active_role,
    c.invoice_image_url, c.invoice_storage_path,
    c.purchase_at, c.requested_role, c.duration_months, c.permanent,
    c.user_note, c.status, c.admin_note, c.reviewed_by, c.reviewed_at, c.created_at
  FROM public.role_warranty_claims c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = c.user_id
  WHERE public.is_admin(auth.uid())
    AND (_status IS NULL OR c.status = _status)
  ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END, c.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;
