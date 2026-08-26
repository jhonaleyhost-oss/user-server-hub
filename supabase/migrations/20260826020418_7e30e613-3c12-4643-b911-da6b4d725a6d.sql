ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_suspended FROM public.profiles WHERE user_id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.prevent_suspension_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
      OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
      OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
      OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by)
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah status suspend.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_suspension_tamper ON public.profiles;
CREATE TRIGGER trg_prevent_suspension_tamper
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_suspension_tamper();

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY IF EXISTS "Transacted users insert own feedback" ON public.feedback;
CREATE POLICY "Transacted users insert own feedback" ON public.feedback
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_transacted(auth.uid()) AND NOT public.is_suspended(auth.uid()));

DROP POLICY IF EXISTS "Users insert own tips" ON public.tips;
CREATE POLICY "Users insert own tips" ON public.tips
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));