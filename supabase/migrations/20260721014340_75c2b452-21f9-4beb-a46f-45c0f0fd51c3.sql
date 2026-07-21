GRANT SELECT ON public.promo_codes TO anon;
CREATE POLICY "Anon can view active promos" ON public.promo_codes
FOR SELECT TO anon
USING (active = true AND (starts_at IS NULL OR starts_at <= now()) AND (expires_at IS NULL OR expires_at > now()));