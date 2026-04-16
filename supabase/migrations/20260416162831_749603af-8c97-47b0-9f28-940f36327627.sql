CREATE TABLE public.popup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Promo',
  content text NOT NULL DEFAULT '',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  buttons jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.popup_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read active popups (needed for frontend display)
CREATE POLICY "Anyone can view active popups"
ON public.popup_settings FOR SELECT
USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can view all popups"
ON public.popup_settings FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert popups"
ON public.popup_settings FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update popups"
ON public.popup_settings FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete popups"
ON public.popup_settings FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_popup_settings_updated_at
BEFORE UPDATE ON public.popup_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default promo content
INSERT INTO public.popup_settings (title, content, is_active, buttons) VALUES (
  '⭐ BENEFIT & KEUNGGULAN PANEL',
  E'🚀 **PANEL BOT WA / TELEGRAM / DISCORD**\n**LEGAL DAN ANTI MOKAD!**\n\nBosan panel sering lag atau adminnya rusuh? Bosen VPS yang sering mokad? Saatnya pindah ke Private Server kami! Dijamin aman, anti mokad, menggunakan VPS legal dan keamanan script Anda adalah prioritas utama kami.\n\n💎 **MENGAPA MEMILIH KAMI?**\n├ ✅ Real Private Server — Tanpa admin lain, stabil\n├ ✅ Enterprise Hardware — Intel Xeon E5-2698 v4 (16 Core)\n├ ✅ Mega RAM — Kapasitas 32 GB\n├ ✅ Lokasi Jakarta (ID) — Latency super rendah\n├ ✅ High Speed I/O — SSD rata-rata 265.7 MB/s\n├ ✅ Network Gahar — Speedtest tembus 887 Mbps\n├ ✅ Bisa Diperpanjang — 50% lebih murah!\n└ ✅ Support Python & Node.js\n\n✨ **OPEN RESELLER — JADI BOS PANEL!**\nMau penghasilan tambahan? Join jadi reseller dan kelola servermu sendiri!\n\n🎁 **BENEFIT RESELLER**\n├ ✅ Full Profit — Jual kembali harga sesukamu\n├ ✅ High Authority — Kelola pelanggan mandiri\n├ ✅ ANTI PTPT — Tanpa patungan & biaya tambahan\n├ ✅ Akses Node.js & Python\n└ ✅ Extra Limit — Beli tambahan +5 s/d +30 slot\n\n📊 **KUOTA PANEL RESELLER**\n├ 🆓 Kuota Gratis: 5 panel/bulan\n│   ↳ Reset otomatis tiap awal bulan\n│   ↳ Kuota pulih saat panel dihapus\n├ 💎 Extra Limit: +5 s/d +30 slot\n│   ↳ Berlaku 1 bulan, akumulatif\n│   ↳ DIHITUNG TERPISAH dari kuota gratis\n└ ✅ Keduanya bisa dipakai bersamaan\n\n💡 **CARA KERJA KUOTA TERPISAH**\nKuota gratis dan kuota beli berjalan independen. Jika kuota gratis habis (5/5), kuota beli tetap utuh. Begitu pula sebaliknya.\n\n🛒 **CARA BELI EXTRA LIMIT**\n1️⃣ Masuk menu Reseller Panel\n2️⃣ Pilih 💎 BELI LIMIT PANEL\n3️⃣ Pilih paket (+5 / +10 / +15 / +20 / +30)\n4️⃣ Bayar via QRIS atau Saldo\n5️⃣ Limit langsung aktif otomatis!\n\n🌟 **KHUSUS RESELLER PERMANEN**\n├ ✅ Free Perpanjangan 3x/bulan\n└ ⚠️ Slot terbatas: 50/50 terisi\n\n🛠️ **DETAIL SPESIFIKASI VPS**\n├ CPU: Intel Xeon E5-2698 v4 @ 2.20GHz\n├ Core: 16 Cores @ 2199 MHz\n├ RAM: 32 GB\n├ OS: Ubuntu 22.04.5 LTS\n├ Virt: Dedicated\n└ Region: Jakarta, Indonesia 🇮🇩\n\n**STOK TERBATAS! AMANKAN SLOT SEKARANG!**\n\n🌟 Keamanan Terjamin, Performa Terbukti!',
  true,
  '[{"label":"🔖 Testimoni","url":"https://t.me/jhonaleytesti3"},{"label":"👤 Owner","url":"https://t.me/JhonaleyStoreSc"},{"label":"🤖 Limit Bot","url":"https://t.me/jhonaleylimitbot"}]'::jsonb
);