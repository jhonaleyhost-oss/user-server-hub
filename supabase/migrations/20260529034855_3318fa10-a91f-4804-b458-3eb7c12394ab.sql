
CREATE TABLE public.message_reads (
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view all reads"
ON public.message_reads
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users insert own reads"
ON public.message_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_message_reads_message ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
