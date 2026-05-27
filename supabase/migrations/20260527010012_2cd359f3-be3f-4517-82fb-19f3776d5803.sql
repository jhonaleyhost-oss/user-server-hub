
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove existing job if any (idempotent)
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup-old-messages';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-old-messages',
  '0 * * * *',
  $$ DELETE FROM public.messages WHERE created_at < now() - interval '12 hours' $$
);
