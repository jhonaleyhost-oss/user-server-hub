# Halaman Sewa & Beriklan

Bangun fitur penyewaan slot iklan website. User bayar Rp50.000/bulan untuk menampilkan popup promo mereka sendiri di semua halaman. Slot terbatas 2 per bulan. Admin punya akses unlimited tanpa hitung slot.

## Alur Pengguna

**Sebelum beli (semua role kecuali admin):**

- Halaman marketing: hero, benefit list, harga (Rp50.000/bulan), info slot tersedia (X/2 bulan ini), FAQ, tombol "Sewa Sekarang"
- Tombol bayar via QRIS (pakai edge function `create-qris` yang sudah ada, mirip flow upgrade reseller)
- Jika slot bulan ini penuh → tombol disabled + pesan "Slot bulan ini penuh, coba lagi bulan depan"

**Setelah bayar (penyewa aktif):**

- Halaman menampilkan: badge status aktif, sisa durasi (countdown hari), tombol "Edit Iklan"
- Form editor mirip Admin Popup Manager: title, content (markdown sederhana), image upload, buttons (label + url, multiple), preview live
- Pengiklan reseller/admin: popup mereka tetap punya checkbox "Jangan tampilkan lagi" untuk audience reseller/admin (sesuai logic `PromoPopup` saat ini)
- Tombol "Nonaktifkan sementara" (tidak refund, hanya hide)

**Admin:**

- Langsung lihat form editor tanpa wajib bayar
- Durasi unlimited, tidak makan slot bulanan
- Bisa kelola/hapus iklan user lain dari Admin panel (tab baru "Iklan Sewa")

## Rendering Popup

Update `PromoPopup.tsx`:

- Query: ambil semua iklan aktif (`ad_rentals` status='active' & belum expired) DAN popup admin default
- Rotasi: pilih random 1 yang belum di-dismiss user (localStorage per id)
- Source bisa dari `popup_settings` (existing admin) ATAU `ad_rentals` (user-generated) — gabung dengan union/serial query
- Tetap respect `canHide` checkbox untuk reseller/admin

## Skema Database

Tabel baru `ad_rentals`:

- `user_id` (uuid → auth.users)
- `order_id` (text, dari pakasir/QRIS) — nullable untuk admin
- `status` (text: pending|active|expired|disabled)
- `amount` (int) — nullable untuk admin
- `starts_at`, `expires_at` (timestamptz) — admin: `expires_at` NULL = unlimited
- `is_admin_slot` (bool default false) — true = tidak hitung slot
- Konten popup: `title`, `content`, `image_url`, `buttons` (jsonb)
- `paid_at` (timestamptz)
- RLS: user lihat & edit milik sendiri; admin lihat/edit semua; anon SELECT untuk popup aktif (filter status & expires)
- Function `get_ad_slot_availability()` → return `{used, total: 2, available}` untuk bulan berjalan (count `is_admin_slot=false AND status='active'`)
- Trigger: saat insert active non-admin, validasi slot < 2

Edge function update `pakasir-webhook`: tambah handler `kind='ad_rental'` untuk activate iklan (mirip activate_reseller).

Edge function baru `create-ad-rental-order`: bikin order QRIS dengan metadata kind='ad_rental'.

## File yang Dibuat/Diubah

**Baru:**

- `src/pages/AdsRental.tsx` — halaman utama (route `/sewa-iklan`)
- `src/components/AdEditor.tsx` — form editor popup (shared dgn admin)
- `src/components/AdminAdRentals.tsx` — tab admin
- `supabase/functions/create-ad-rental-order/index.ts`
- Migration: tabel `ad_rentals` + RLS + GRANT + function slot availability

**Diubah:**

- `src/components/AppSidebar.tsx` — menu "Sewa & Beriklan"
- `src/components/AnimatedRoutes.tsx` — route baru
- `src/components/PromoPopup.tsx` — gabungkan source ad_rentals
- `src/pages/Admin.tsx` — tab baru
- `supabase/functions/pakasir-webhook/index.ts` — handler ad_rental

## Konfirmasi Sebelum Lanjut

1. **Pembayaran**: pakai QRIS Pakasir yang sudah ada (sama seperti upgrade reseller)? **Ya**
2. **Slot 2/bulan**: dihitung per bulan kalender (Jan, Feb, dst) atau rolling 30 hari? **kalender bulan**.
3. **Konten iklan**: **langsung live** (admin bisa nonaktifkan kalau melanggar).
4. **Frekuensi popup**: Sekali per session jadi kalo refresh bakal muncul, untuk hide (reseller yang sudah centang) pop up akan muncul lagi setiap hari jam 7 seperti warning (jelaskan ini juga di halaman agar pengguna tahu sebelum beli) 

**Tampilan Iklan**

1. Kasih tulisan kecil di pojok Kanan atas atau di manapun yang menandakan bahwa itu iklan  (kasih note join resellerr untuk menghapus iklan )
2. Sediakan Nama user yang sedang beriklan / yang menerbitkan 
3. Pembelian iklan/penyewaan akan di tampilkan pada pop up notifikasi di dashboard 

NOTE : SEDIAKAN NOTE / TOS IKLAN CONTOHNYA TIDAK DIGUNAKAN UNTUK IKLAN ILEGAL, MERUGIKAN DAN MENYESATKAN, SERTA PENIPUAN ATAU CARI AJA CONTOH TOS YANG SEPROFESIONAL MUNGKIN 