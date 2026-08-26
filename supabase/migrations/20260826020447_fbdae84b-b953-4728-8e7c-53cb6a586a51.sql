DROP POLICY IF EXISTS "Users insert own orders" ON public.reseller_orders;
CREATE POLICY "Users insert own orders" ON public.reseller_orders
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY IF EXISTS "Users insert own rentals" ON public.ad_rentals;
CREATE POLICY "Users insert own rentals" ON public.ad_rentals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND NOT public.is_suspended(auth.uid()));