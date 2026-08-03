
-- store internal push trigger secret in vault
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'push_trigger_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('GbIU3pF1oS0zI5U4b2P0JM9OKGIoTyAUrCh69uMU', 'push_trigger_secret', 'internal secret for send-push trigger');
  ELSE
    PERFORM vault.update_secret(v_id, 'GbIU3pF1oS0zI5U4b2P0JM9OKGIoTyAUrCh69uMU');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_secret text;
  v_body jsonb;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_trigger_secret';
  IF v_secret IS NULL THEN RETURN NEW; END IF;

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
        'x-push-secret', v_secret
      ),
      body := v_body
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
