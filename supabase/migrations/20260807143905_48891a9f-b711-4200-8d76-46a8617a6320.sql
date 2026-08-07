
CREATE TABLE IF NOT EXISTS public.chat_mutes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_until timestamptz,
  reason text,
  muted_by uuid,
  strikes integer NOT NULL DEFAULT 0,
  last_strike_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_mutes TO authenticated;
GRANT ALL ON public.chat_mutes TO service_role;

ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_mutes_select_own_or_admin" ON public.chat_mutes;
CREATE POLICY "chat_mutes_select_own_or_admin" ON public.chat_mutes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "chat_mutes_admin_all" ON public.chat_mutes;
CREATE POLICY "chat_mutes_admin_all" ON public.chat_mutes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_chat_muted(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_mutes
    WHERE user_id = _user_id
      AND (muted_until IS NULL AND reason = '__permanent__' OR muted_until > now())
  );
$$;

-- Normalize text (leetspeak + separators) for profanity matching
CREATE OR REPLACE FUNCTION public.normalize_for_profanity(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(lower(coalesce(_text, '')), '4310$57@!', 'aeiobsta i'),
    '[^a-z0-9 ]+', ' ', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.contains_profanity(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text;
  compact text;
  w text;
  words text[] := ARRAY[
    'anjing','anjg','anjay','anjir','asu','babi','bangsat','bangke','bajingan',
    'kontol','kntl','memek','mmk','pepek','ngentot','ngentod','entot','jancok','jancuk','cok',
    'kimak','kimax','pukimak','pantek','lonte','pelacur','sundal','jablay',
    'tolol','goblok','goblog','bego','idiot','bodoh amat','kampret','keparat',
    'bacot','bct','ngewe','coli','colmek','peju','pejuh','sange','sangean',
    'tetek','toket','itil','vagina','penis','kelamin','porno','bokep','bugil','telanjang',
    'setan','iblis','laknat','bangsad','tai','taik','sialan',
    'fuck','fucking','fucker','shit','bitch','bastard','asshole','dick','pussy','cunt','whore','slut','motherfucker','nigga','nigger','retard','faggot','porn','nude','sex','xxx'
  ];
BEGIN
  t := public.normalize_for_profanity(_text);
  IF t IS NULL OR btrim(t) = '' THEN RETURN false; END IF;
  compact := regexp_replace(t, '\s+', '', 'g');
  FOREACH w IN ARRAY words LOOP
    IF t ~ ('(^| )' || replace(w, ' ', '\s*') || '(s|es)?( |$)') THEN
      RETURN true;
    END IF;
    IF length(w) >= 5 AND position(replace(w, ' ', '') in compact) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_chat_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.chat_mutes%ROWTYPE;
  new_strikes integer;
  mute_minutes integer := 0;
  until timestamptz;
BEGIN
  -- Muted users cannot send
  SELECT * INTO m FROM public.chat_mutes WHERE user_id = NEW.user_id;
  IF FOUND AND (
      (m.muted_until IS NULL AND m.reason = '__permanent__')
      OR (m.muted_until IS NOT NULL AND m.muted_until > now())
  ) THEN
    IF m.muted_until IS NULL THEN
      RAISE EXCEPTION 'MUTED_PERMANENT: Kamu dibisukan permanen dari Chat Global.';
    ELSE
      RAISE EXCEPTION 'MUTED_UNTIL:%', to_char(m.muted_until AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI');
    END IF;
  END IF;

  -- Profanity filter (skip admins)
  IF NEW.content IS NOT NULL AND NOT public.is_admin(NEW.user_id)
     AND public.contains_profanity(NEW.content) THEN
    new_strikes := COALESCE(m.strikes, 0) + 1;
    IF new_strikes = 2 THEN mute_minutes := 10;
    ELSIF new_strikes = 3 THEN mute_minutes := 60;
    ELSIF new_strikes >= 4 THEN mute_minutes := 1440;
    END IF;
    until := CASE WHEN mute_minutes > 0 THEN now() + make_interval(mins => mute_minutes) ELSE NULL END;

    INSERT INTO public.chat_mutes (user_id, strikes, last_strike_at, muted_until, reason, updated_at)
    VALUES (NEW.user_id, new_strikes, now(), until, 'Kata kasar / konten tidak pantas', now())
    ON CONFLICT (user_id) DO UPDATE
      SET strikes = new_strikes,
          last_strike_at = now(),
          muted_until = COALESCE(until, public.chat_mutes.muted_until),
          reason = 'Kata kasar / konten tidak pantas',
          updated_at = now();

    IF mute_minutes > 0 THEN
      RAISE EXCEPTION 'PROFANITY_MUTED:%|%', new_strikes, mute_minutes;
    ELSE
      RAISE EXCEPTION 'PROFANITY_WARN:%', new_strikes;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_moderation_ins ON public.messages;
CREATE TRIGGER trg_chat_moderation_ins
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_chat_moderation();

CREATE OR REPLACE FUNCTION public.trg_chat_moderation_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     AND NEW.content IS NOT NULL
     AND NOT public.is_admin(NEW.user_id)
     AND public.contains_profanity(NEW.content) THEN
    RAISE EXCEPTION 'PROFANITY_EDIT: Pesan mengandung kata kasar.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_moderation_upd ON public.messages;
CREATE TRIGGER trg_chat_moderation_upd
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_chat_moderation_edit();

-- Admin helper to mute/unmute
CREATE OR REPLACE FUNCTION public.admin_set_chat_mute(_user_id uuid, _minutes integer, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  until timestamptz;
  r text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF _minutes IS NULL OR _minutes <= 0 THEN
    -- unmute
    UPDATE public.chat_mutes
      SET muted_until = NULL, reason = NULL, strikes = 0, muted_by = auth.uid(), updated_at = now()
      WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'muted', false);
  END IF;

  IF _minutes >= 525600 THEN
    until := NULL;
    r := '__permanent__';
  ELSE
    until := now() + make_interval(mins => _minutes);
    r := COALESCE(_reason, 'Dibisukan oleh admin');
  END IF;

  INSERT INTO public.chat_mutes (user_id, muted_until, reason, muted_by, updated_at)
  VALUES (_user_id, until, r, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET muted_until = EXCLUDED.muted_until,
        reason = EXCLUDED.reason,
        muted_by = EXCLUDED.muted_by,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'muted', true, 'until', until);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_chat_mute()
RETURNS TABLE(muted boolean, muted_until timestamptz, permanent boolean, reason text, strikes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((cm.muted_until IS NULL AND cm.reason = '__permanent__') OR cm.muted_until > now(), false),
    cm.muted_until,
    COALESCE(cm.muted_until IS NULL AND cm.reason = '__permanent__', false),
    cm.reason,
    COALESCE(cm.strikes, 0)
  FROM public.chat_mutes cm
  WHERE cm.user_id = auth.uid();
$$;
