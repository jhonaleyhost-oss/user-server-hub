DROP POLICY IF EXISTS "Anon can view active promos" ON public.promo_codes;
CREATE POLICY "Anon can view active promos" ON public.promo_codes
  FOR SELECT TO anon
  USING (active = true);