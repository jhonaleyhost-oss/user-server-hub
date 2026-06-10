
CREATE OR REPLACE FUNCTION public.get_ad_slot_info()
 RETURNS TABLE(total integer, used integer, available integer, month_start timestamptz, month_end timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    2 AS total,
    COALESCE((
      SELECT COUNT(*)::int FROM public.ad_rentals r
      WHERE r.status = 'active'
        AND r.is_admin_slot = false
        AND (r.expires_at IS NULL OR r.expires_at > now())
    ), 0) AS used,
    GREATEST(0, 2 - COALESCE((
      SELECT COUNT(*)::int FROM public.ad_rentals r
      WHERE r.status = 'active'
        AND r.is_admin_slot = false
        AND (r.expires_at IS NULL OR r.expires_at > now())
    ), 0)) AS available,
    NULL::timestamptz AS month_start,
    NULL::timestamptz AS month_end;
$$;

CREATE OR REPLACE FUNCTION public.validate_ad_rental_slot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.status <> 'active' OR NEW.is_admin_slot THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.ad_rentals
  WHERE status = 'active'
    AND is_admin_slot = false
    AND (expires_at IS NULL OR expires_at > now())
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'ad_slot_full: maksimal 2 slot iklan aktif sudah terisi, tunggu sampai ada yang expired';
  END IF;
  RETURN NEW;
END;
$$;
