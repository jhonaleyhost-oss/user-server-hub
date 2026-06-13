
-- 1. has_transacted helper
CREATE OR REPLACE FUNCTION public.has_transacted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _user_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('reseller','premium','admin'))
      OR EXISTS (SELECT 1 FROM public.reseller_orders WHERE user_id = _user_id AND status = 'completed')
      OR EXISTS (SELECT 1 FROM public.ad_rentals WHERE user_id = _user_id AND (status = 'active' OR paid_at IS NOT NULL))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_send_feedback()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_transacted(auth.uid());
$$;

-- 2. Tighten feedback insert policy
DROP POLICY IF EXISTS "Authenticated users insert own feedback" ON public.feedback;
CREATE POLICY "Transacted users insert own feedback"
ON public.feedback
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_transacted(auth.uid()));

-- 3. Replies table
CREATE TABLE IF NOT EXISTS public.feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'free',
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_replies_feedback_id_idx ON public.feedback_replies(feedback_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.feedback_replies TO authenticated;
GRANT SELECT ON public.feedback_replies TO anon;
GRANT ALL ON public.feedback_replies TO service_role;

ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view replies"
ON public.feedback_replies FOR SELECT USING (true);

CREATE POLICY "Transacted users insert own reply"
ON public.feedback_replies FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_transacted(auth.uid()));

CREATE POLICY "Author or admin delete reply"
ON public.feedback_replies FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_replies;
