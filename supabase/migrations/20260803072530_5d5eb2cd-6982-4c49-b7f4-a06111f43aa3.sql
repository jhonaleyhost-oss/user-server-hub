
-- Reseller / ADP order completed
CREATE OR REPLACE FUNCTION public.trg_notify_order_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label text; v_when text;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
    v_label := CASE WHEN NEW.plan LIKE 'adp%' THEN 'Admin Panel (ADP)' ELSE 'Reseller' END;
    v_when := CASE WHEN NEW.permanent THEN 'Permanen'
                   WHEN NEW.expires_at IS NOT NULL THEN 'Aktif sampai ' || to_char(NEW.expires_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
                   ELSE 'Aktif' END;
    INSERT INTO public.notifications (title, body, audience, target_user_id, link_url)
    VALUES ('Pembayaran Berhasil 🎉',
            'Akses ' || v_label || ' kamu sudah aktif. ' || v_when || '.',
            'all', NEW.user_id, '/profile');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_order_completed ON public.reseller_orders;
CREATE TRIGGER notify_order_completed AFTER UPDATE ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_completed();

-- Ad rental activated
CREATE OR REPLACE FUNCTION public.trg_notify_ad_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND COALESCE(OLD.status,'') <> 'active' AND NEW.is_admin_slot = false THEN
    INSERT INTO public.notifications (title, body, audience, target_user_id, link_url)
    VALUES ('Iklan Kamu Aktif 📢',
            'Iklan "' || NEW.title || '" sudah tayang' ||
            COALESCE(' sampai ' || to_char(NEW.expires_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY'), '') || '.',
            'all', NEW.user_id, '/ads');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_ad_active ON public.ad_rentals;
CREATE TRIGGER notify_ad_active AFTER UPDATE ON public.ad_rentals
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_ad_active();

-- Warranty claim reviewed
CREATE OR REPLACE FUNCTION public.trg_notify_warranty_reviewed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status IN ('approved','rejected') THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (title, body, audience, target_user_id, link_url)
      VALUES ('Garansi Disetujui ✅',
              'Role ' || NEW.requested_role::text || ' kamu sudah dipulihkan.' ||
              COALESCE(' Catatan admin: ' || NEW.admin_note, ''),
              'all', NEW.user_id, '/warranty');
    ELSE
      INSERT INTO public.notifications (title, body, audience, target_user_id, link_url)
      VALUES ('Garansi Ditolak ❌',
              'Klaim garansi kamu ditolak.' || COALESCE(' Alasan: ' || NEW.admin_note, ''),
              'all', NEW.user_id, '/warranty');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_warranty_reviewed ON public.role_warranty_claims;
CREATE TRIGGER notify_warranty_reviewed AFTER UPDATE ON public.role_warranty_claims
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_warranty_reviewed();

-- Admin panel deleted (skip when the owner deletes it themselves)
CREATE OR REPLACE FUNCTION public.trg_notify_admin_panel_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    INSERT INTO public.notifications (title, body, audience, target_user_id, link_url)
    VALUES ('Admin Panel Dihapus',
            'Admin panel "' || OLD.username || '" telah dihapus oleh admin.',
            'all', OLD.user_id, '/dashboard');
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS notify_admin_panel_deleted ON public.admin_panels;
CREATE TRIGGER notify_admin_panel_deleted AFTER DELETE ON public.admin_panels
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_panel_deleted();
