# Refactor Halaman Admin ke Multi-Route

Saat ini `/admin` adalah satu file monolitik (~2100 baris) dengan banyak Tabs (users, servers, panels, devices, popup, activity, offline, inactive, ads, broadcast, promos, dll). Akan dipecah menjadi banyak halaman terpisah supaya lebih rapi, profesional, dan cepat dimuat.

## Struktur route baru

```
/admin                     → Dashboard Overview (revenue + statistik)
/admin/users               → Manajemen user & role
/admin/servers             → Pterodactyl servers
/admin/panels              → Semua panel user
/admin/devices             → IP & fingerprint / device management
/admin/inactive            → Akun nonaktif >1 bulan
/admin/offline-panels      → Panel offline scan
/admin/activity            → Activity logs
/admin/broadcast           → Broadcast pesan
/admin/promos              → Promo codes
/admin/ads                 → Sewa iklan (ad_rentals)
/admin/popup               → Popup manager
/admin/settings            → App settings (jika ada)
```

## Halaman `/admin` (Overview baru)

Berisi:
- Header sambutan admin
- Ringkasan cepat: total user, total panel, total server, panel online/offline
- **Komponen `AdminRevenue`** (sudah ada) — analytics pendapatan dari ADP, Reseller, Iklan, Donasi + grafik + top spender
- Grid kartu navigasi ke semua sub-halaman (dengan icon, label, deskripsi singkat)

## Layout & navigasi admin

Buat `src/components/AdminLayout.tsx`:
- Sidebar kiri (desktop) / drawer (mobile) berisi link ke semua sub-halaman admin
- Highlight route aktif
- Header dengan tombol "Kembali ke Dashboard", tema, accent picker
- Semua sub-halaman admin dibungkus layout ini agar konsisten

## Detail teknis

1. **Buat folder `src/pages/admin/`** berisi:
   - `Overview.tsx` (revenue + stats + navigasi kartu)
   - `AdminUsers.tsx` — pindahkan tab "Users" dari Admin.tsx (list, edit role, delete, clear all, pagination, search)
   - `AdminServers.tsx` — tab "Servers" (CRUD pterodactyl_servers, status, form)
   - `AdminPanels.tsx` — tab "Panels" (list panel user, delete, clear all)
   - `AdminDevices.tsx` — tab "Devices" (reset IP/fingerprint)
   - `AdminInactive.tsx` — bungkus `<AdminInactiveUsers />`
   - `AdminOfflinePanelsPage.tsx` — bungkus `<AdminOfflinePanels />`
   - `AdminActivityPage.tsx` — bungkus `<AdminActivityLogs />`
   - `AdminBroadcastPage.tsx` — bungkus `<AdminBroadcast />`
   - `AdminPromosPage.tsx` — bungkus `<AdminPromos />`
   - `AdminAdsPage.tsx` — bungkus `<AdminAdRentals />`
   - `AdminPopupPage.tsx` — bungkus `<AdminPopupManager />`

2. **Ekstrak state fetch dari `Admin.tsx`** ke tiap halaman. Setiap halaman fetch datanya sendiri (users, servers, panels, devices) — tidak lagi semuanya di-load bersamaan → jauh lebih cepat.

3. **Update `AnimatedRoutes.tsx`**: ganti satu route `/admin` menjadi nested routes semua di atas, semuanya dibungkus `<AdminRoute>` + `<AdminLayout>`.

4. **Hapus `src/pages/Admin.tsx`** setelah semua tab dipindah, atau jadikan re-export dari Overview.

5. **Sidebar app** (`AppSidebar.tsx`): tambahkan sub-menu admin (opsional, atau tetap satu link "Admin" yang mengarah ke `/admin` overview).

6. Semua RLS, edge function calls, dan logic tetap sama — hanya pindah tempat.

## Yang tidak berubah

- Semua edge functions, database, RLS policies, komponen `AdminRevenue`, `AdminBroadcast`, `AdminPromos`, `AdminInactiveUsers`, `AdminOfflinePanels`, `AdminPopupManager`, `AdminActivityLogs`, `AdminAdRentals` — dipakai apa adanya.
- `AdminRoute` guard tetap dipakai untuk semua route `/admin/*`.

## Estimasi

Refactor besar — ~12 file baru, 2 file diubah, 1 file dihapus. Setelah selesai, halaman `/admin` load jauh lebih cepat karena tidak fetch semua data sekaligus, dan tiap sub-halaman jadi fokus & profesional.

Setujui rencana ini untuk saya mulai kerjakan?
