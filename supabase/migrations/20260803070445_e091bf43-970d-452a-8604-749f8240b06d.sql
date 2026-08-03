CREATE OR REPLACE FUNCTION public.trg_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_key text;
  v_body jsonb;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
  IF v_key IS NULL THEN RETURN NEW; END IF;

  v_body := jsonb_build_object(
    'title', NEW.title,
    'body', left(COALESCE(NEW.body, ''), 400),
    'url', COALESCE(NEW.link_url, '/notifications'),
    'tag', 'notif-' || NEW.id::text
  );
  IF NEW.banner_url IS NOT NULL THEN
    v_body := v_body || jsonb_build_object('image', NEW.banner_url);
  END IF;
  IF NEW.target_user_id IS NOT NULL THEN
    v_body := v_body || jsonb_build_object('target_user_id', NEW.target_user_id);
  ELSIF NEW.audience::text <> 'all' THEN
    v_body := v_body || jsonb_build_object('role', NEW.audience::text);
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://qjkaoghqatkminsufqfn.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := v_body
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch failed: %', SQLERRM;
  END;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notifications_push ON public.notifications;
CREATE TRIGGER notifications_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_notification_push();