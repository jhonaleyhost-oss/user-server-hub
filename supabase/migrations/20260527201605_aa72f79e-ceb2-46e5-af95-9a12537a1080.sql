
-- 1. Profiles: kolom masa aktif reseller
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reseller_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reseller_permanent boolean NOT NULL DEFAULT false;

-- 2. reseller_orders
CREATE TABLE IF NOT EXISTS public.reseller_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('1bln','2bln','perm')),
  duration_days integer,
  amount integer NOT NULL,
  order_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  expires_at timestamptz,
  permanent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.reseller_orders TO authenticated;
GRANT ALL ON public.reseller_orders TO service_role;

ALTER TABLE public.reseller_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
  ON public.reseller_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone view completed orders"
  ON public.reseller_orders FOR SELECT TO public
  USING (status = 'completed');

CREATE POLICY "Admins view all orders"
  ON public.reseller_orders FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users insert own orders"
  ON public.reseller_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update orders"
  ON public.reseller_orders FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reseller_orders_user ON public.reseller_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_status ON public.reseller_orders (status);

-- 3. Activation function (called by edge function via service role)
CREATE OR REPLACE FUNCTION public.activate_reseller(_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT reseller_expires_at, reseller_permanent INTO v_current_exp, v_current_perm
  FROM public.profiles WHERE user_id = v_order.user_id;

  IF v_order.plan = 'perm' THEN
    UPDATE public.profiles
      SET reseller_permanent = true,
          reseller_expires_at = NULL
      WHERE user_id = v_order.user_id;
    v_new_exp := NULL;
  ELSE
    -- extend from current expiry if still in future, else from now
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

  -- Upgrade role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_order.user_id, 'reseller')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove free role if exists
  DELETE FROM public.user_roles
    WHERE user_id = v_order.user_id AND role = 'free';
  -- If there's a single-role-per-user assumption, set existing record
  UPDATE public.user_roles
    SET role = 'reseller', updated_at = now()
    WHERE user_id = v_order.user_id AND role <> 'reseller' AND role <> 'admin';

  -- Mark order completed
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
$$;

-- 4. Activity feed RPC for upgrade tab
CREATE OR REPLACE FUNCTION public.get_upgrade_activity(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  role app_role,
  plan text,
  amount integer,
  duration_days integer,
  paid_at timestamptz,
  expires_at timestamptz,
  permanent boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.user_id,
    p.full_name,
    p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS role,
    o.plan,
    o.amount,
    o.duration_days,
    o.paid_at,
    o.expires_at,
    o.permanent,
    o.created_at
  FROM public.reseller_orders o
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = o.user_id
  WHERE o.status = 'completed'
  ORDER BY COALESCE(o.paid_at, o.created_at) DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

-- 5. Reseller status helper
CREATE OR REPLACE FUNCTION public.get_my_reseller_status()
RETURNS TABLE(
  is_reseller boolean,
  permanent boolean,
  expires_at timestamptz,
  days_left integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('reseller','admin')) AS is_reseller,
    COALESCE((SELECT reseller_permanent FROM public.profiles WHERE user_id = auth.uid()), false) AS permanent,
    (SELECT reseller_expires_at FROM public.profiles WHERE user_id = auth.uid()) AS expires_at,
    CASE
      WHEN (SELECT reseller_permanent FROM public.profiles WHERE user_id = auth.uid()) THEN NULL
      WHEN (SELECT reseller_expires_at FROM public.profiles WHERE user_id = auth.uid()) IS NULL THEN NULL
      ELSE GREATEST(0, EXTRACT(EPOCH FROM ((SELECT reseller_expires_at FROM public.profiles WHERE user_id = auth.uid()) - now()))/86400)::integer
    END AS days_left;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.reseller_orders;
