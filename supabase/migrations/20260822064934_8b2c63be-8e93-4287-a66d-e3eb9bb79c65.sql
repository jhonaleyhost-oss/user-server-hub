CREATE TABLE IF NOT EXISTS public.support_human_requests (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  human_until TIMESTAMPTZ NOT NULL DEFAULT now() + interval '3 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_human_requests TO authenticated;
GRANT ALL ON public.support_human_requests TO service_role;
ALTER TABLE public.support_human_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own human request" ON public.support_human_requests;
CREATE POLICY "Users manage own human request" ON public.support_human_requests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view human requests" ON public.support_human_requests;
CREATE POLICY "Admins view human requests" ON public.support_human_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));