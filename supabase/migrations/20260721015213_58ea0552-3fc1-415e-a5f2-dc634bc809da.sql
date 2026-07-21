ALTER TYPE public.promo_scope ADD VALUE IF NOT EXISTS 'reseller_adp';

CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _scope public.promo_scope, _amount int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.promo_codes%ROWTYPE;
  v_discount int := 0;
BEGIN
  SELECT * INTO v FROM public.promo_codes WHERE upper(code) = upper(_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode tidak ditemukan');
  END IF;
  IF NOT v.active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode tidak aktif');
  END IF;
  IF v.starts_at IS NOT NULL AND v.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode belum berlaku');
  END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode sudah kedaluwarsa');
  END IF;
  IF v.quota IS NOT NULL AND v.used_count >= v.quota THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kuota habis');
  END IF;
  IF v.scope <> 'both'
     AND v.scope <> _scope
     AND NOT (v.scope = 'reseller_adp' AND _scope IN ('reseller','adp')) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode tidak berlaku untuk pembelian ini');
  END IF;
  IF _amount < v.min_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum belanja Rp ' || v.min_amount::text);
  END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE promo_id = v.id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode hanya bisa dipakai sekali per akun');
  END IF;

  IF v.discount_type = 'percent' THEN
    v_discount := (_amount * v.discount_value) / 100;
  ELSE
    v_discount := v.discount_value;
  END IF;
  IF v.max_discount IS NOT NULL AND v_discount > v.max_discount THEN
    v_discount := v.max_discount;
  END IF;
  IF v_discount > _amount THEN v_discount := _amount; END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'promo_id', v.id,
    'code', v.code,
    'description', v.description,
    'discount', v_discount,
    'final_amount', _amount - v_discount
  );
END; $$;