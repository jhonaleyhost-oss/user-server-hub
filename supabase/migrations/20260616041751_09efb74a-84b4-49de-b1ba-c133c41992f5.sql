
CREATE OR REPLACE FUNCTION public.trg_promo_increment_used()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = NEW.promo_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_promo_redemption_inc ON public.promo_redemptions;
CREATE TRIGGER trg_promo_redemption_inc
AFTER INSERT ON public.promo_redemptions
FOR EACH ROW EXECUTE FUNCTION public.trg_promo_increment_used();
