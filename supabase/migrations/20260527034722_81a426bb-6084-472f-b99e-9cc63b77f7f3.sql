
-- Feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'free',
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feedback TO anon;
GRANT SELECT, INSERT, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view feedback" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "Authenticated users insert own feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own feedback" ON public.feedback FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins delete any feedback" ON public.feedback FOR DELETE TO authenticated USING (is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
ALTER TABLE public.feedback REPLICA IDENTITY FULL;

-- Tips table
CREATE TABLE public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  amount int NOT NULL CHECK (amount BETWEEN 1000 AND 100000),
  order_id text NOT NULL,
  proof_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tips TO authenticated;
GRANT ALL ON public.tips TO service_role;

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tips" ON public.tips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all tips" ON public.tips FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Users insert own tips" ON public.tips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tips" ON public.tips FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for tip proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('tip-proofs', 'tip-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tip proofs are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'tip-proofs');

CREATE POLICY "Users upload their own tip proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tip-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
