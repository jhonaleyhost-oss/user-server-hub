
-- 1) Dedupe existing duplicates (case-insensitive), keep oldest, append number to newer ones
DO $$
DECLARE
  r record;
  v_new text;
  v_suffix int;
BEGIN
  FOR r IN
    WITH ranked AS (
      SELECT user_id, full_name, created_at,
             ROW_NUMBER() OVER (PARTITION BY lower(btrim(full_name)) ORDER BY created_at ASC, user_id ASC) AS rn
      FROM public.profiles
      WHERE full_name IS NOT NULL AND btrim(full_name) <> ''
    )
    SELECT user_id, full_name, rn FROM ranked WHERE rn > 1
  LOOP
    v_suffix := r.rn;
    LOOP
      v_new := btrim(r.full_name) || v_suffix::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE lower(btrim(full_name)) = lower(v_new)
      );
      v_suffix := v_suffix + 1;
    END LOOP;
    UPDATE public.profiles SET full_name = v_new WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 2) Unique case-insensitive index on full_name
CREATE UNIQUE INDEX IF NOT EXISTS profiles_full_name_lower_unique
  ON public.profiles (lower(btrim(full_name)))
  WHERE full_name IS NOT NULL AND btrim(full_name) <> '';

-- 3) Helper RPC to check if a name is already taken (excluding self)
CREATE OR REPLACE FUNCTION public.is_name_taken(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(btrim(full_name)) = lower(btrim(_name))
      AND user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_name_taken(text) TO authenticated;
