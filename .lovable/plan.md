## Ringkasan Fitur

Menambahkan role baru `**adp_server**` ("Admin Panel Server") yang dijual di halaman Upgrade dengan harga: 1 bln 10rb, 2 bln 20rb, permanen 35rb. Role ini terpisah dari admin utama (`admin`) — pemilik `adp_server` **tidak bisa** membuka halaman `/admin` app. Perbedaannya hanya: badge eksklusif + hak membuat "Admin Panel" di Pterodactyl.

Setiap pembeli hanya boleh punya **1 admin panel per server Pterodactyl** (misal ada 2 server private + 1 publik → maksimal 3 admin panel total, masing-masing 1 per server). Role `reseller` juga mendapatkan hak yang sama. (Role reseller gabisa buat admin panel ya).

---

## Perubahan Database

### 1. Enum baru `app_role`

Tambah nilai `'adp_server'` ke enum `public.app_role`.

### 2. Tabel baru `public.admin_panels`

Menyimpan admin panel Pterodactyl milik user (root_admin=1).

- `user_id`, `server_id` (FK ke `pterodactyl_servers`), `ptero_user_id`, `username`, `email`, `password`, `login_url`, `plta_key`, `pltc_key`, `created_at`
- UNIQUE(`user_id`, `server_id`) → menegakkan "1 admin panel per server per user"
- RLS: user hanya lihat miliknya; admin utama lihat semua; service_role full
- GRANT SELECT/INSERT/UPDATE/DELETE ke authenticated

### 3. Tabel baru `public.admin_panel_subusers`

Menyimpan user Pterodactyl yang dibuat oleh pembeli lewat admin panel-nya.

- `admin_panel_id` (FK ke `admin_panels`), `ptero_user_id`, `username`, `email`, `password`, `plta_key`, `pltc_key`, `created_at`

### 4. Tabel baru `public.admin_panel_servers`

Menyimpan panel/server yang dibuat pembeli untuk sub-user mereka.

- `admin_panel_id`, `subuser_id` (FK), `ptero_server_id`, `name`, `ram`, `cpu`, `disk`, `panel_type`, `created_at`

### 5. Field baru di `profiles`

- `adp_server_expires_at timestamptz`
- `adp_server_permanent boolean default false`

### 6. Fungsi baru

- `activate_adp_server(_order_id text)` — dipanggil webhook Pakasir setelah pembayaran; set role `adp_server` (jika bukan admin/reseller), extend expiry
- `has_adp_server(_user_id uuid)` — cek apakah role reseller/admin/adp_server aktif (dipakai UI)
- Update `expire_ad_rentals_and_roles()` untuk juga downgrade `adp_server` yang expired

---

## Edge Functions (baru & modif)

### Baru

- `create-admin-panel` — buat user Pterodactyl dengan `root_admin: 1` pakai PLTA admin utama, lalu generate PLTA & PLTC baru **atas nama user itu** (via `POST /api/application/users/{id}/keys` bila didukung, fallback: simpan PLTA/PLTC admin utama disertai catatan). Simpan ke `admin_panels`. Validasi: role user harus reseller/admin/adp_server, belum ada admin_panels untuk server_id itu.
- `create-admin-subuser` — pembeli pilih admin panel (server), form username/email/password → panggil Ptero pakai **PLTA milik admin panel pembeli** untuk buat user baru; generate PLTA/PLTC untuk sub-user tersebut; simpan ke `admin_panel_subusers`; return kredensial + kunci.
- `create-admin-subpanel` — pembeli pilih sub-user + resource → buat server Ptero pakai PLTA pembeli, simpan `admin_panel_servers`.
- `delete-admin-subuser` / `delete-admin-subpanel` — hapus via API pakai **PLTA admin utama** (karena user id 1 diproteksi di sisi Ptero milik user), agar bisa hapus.

### Modif

- `pakasir-webhook` — tambah handling produk `adp_server` (parse order_id prefix atau plan field) → panggil `activate_adp_server`.

---

## Frontend

### `src/pages/Upgrade.tsx`

Tambah section baru "Admin Panel Server" dengan 3 paket (10rb / 20rb / 35rb). Alur pembayaran ikut pola reseller yang ada (Pakasir QRIS).

### `src/pages/Dashboard.tsx`

Setelah role `adp_server`/`reseller`/`admin` aktif, tombol "Buat Panel" jadi dropdown/dialog:

- **Panel Biasa** (flow existing `create-panel`)
- **Admin Panel** (flow baru → pilih server yang belum punya admin panel milik user ini)

### Halaman baru `src/pages/AdminPanels.tsx` (route `/admin-panels`)

Untuk pemilik `adp_server`/`reseller`/`admin`:

- List admin panel per server: card menampilkan URL panel, username, password (toggle mata), PLTA, PLTC (copy button)
- Tombol "Buat User Baru" → dialog form
- Tab per admin panel: **Users** (sub-user + kredensial + PLTA/PLTC + tombol hapus) & **Panels** (server yang mereka buat + tombol hapus)
- Tombol "Buat Panel" di dalam tab Users memilih sub-user + resource

### `src/components/VerifiedBadge.tsx` / `src/pages/Chat.tsx` dsb

Tambah badge eksklusif untuk `adp_server`: warna & ikon berbeda (misal gradient emas + ikon Shield) supaya mencolok.

### `src/pages/Admin.tsx`

Tambah tab/section **"Admin Panels"**:

- List semua admin panel per user
- Tombol **Reset Admin Panel** per baris → hapus row `admin_panels` (dan optionally hapus user Ptero via edge function) sehingga user itu bisa buat ulang di server tsb
- Field manual "Set Expiry adp_server" per user (mirip reseller expiry)

### `useUserRole.tsx`

Tambah `isAdpServer`, dan `canCreateAdminPanel = isReseller || isAdpServer || isAdmin`.

### `AdminRoute.tsx`

Tetap: hanya `admin` (bukan `adp_server`) yang boleh akses `/admin`. Sudah aman karena pengecekan pakai `is_admin` RPC.

---

## Detail Teknis Penting

- **PLTA/PLTC per sub-user**: Pterodactyl Panel default hanya membuat *client API key* (PLTC) via akun user itu sendiri. Untuk **PLTA** (application key), umumnya hanya admin yang bisa punya. Solusi: pembeli sudah `root_admin=1`, jadi PLTA/PLTC dibuat via login otomatis / endpoint `/api/client/account/api-keys` (PLTC) — untuk PLTA kita generate lewat endpoint application memakai kredensial pembeli. Jika Ptero user pembeli tidak bisa buat PLTA via API (karena Ptero panel tidak expose endpoint create-application-key), maka fallback: tampilkan URL panel + username + password dan instruksi buat PLTA manual di UI Ptero mereka. Akan diimplementasi otomatis dulu; jika gagal, UI menampilkan panduan.
- **Proteksi hapus user id 1**: hapus sub-user/sub-panel selalu memakai PLTA admin utama (dari tabel `pterodactyl_servers`), bukan PLTA pembeli, sesuai permintaan.
- **1 admin panel per server**: ditegakkan oleh UNIQUE constraint di DB + validasi di edge function.
- **Reset di admin app**: menghapus row `admin_panels` untuk user+server tertentu → user bisa buat lagi. Opsional juga hapus user Ptero-nya.

---

## Urutan Implementasi

1. Migration DB (enum, tabel, fungsi, field profiles)
2. Edge functions baru + update `pakasir-webhook`
3. Update `useUserRole`, badge, Upgrade page (paket adp_server)
4. Dashboard: pilihan jenis panel
5. Halaman `/admin-panels`
6. Admin page: reset & manajemen adp_server

Setelah plan disetujui, saya kerjakan bertahap dengan verifikasi tiap milestone.

kayanya bikin page baru deh bedain tempat up reseller dengan up admin panel, terus kalo ada reseller yang mau up ke admin panel itu buat double aja kah rolenya? konsepnya tinggian admin panel, tapi kalo ada yang udh beli permanen reseller terus beli 1 bulan admin panel tuh gimana ya? coba buaykan solusi se profesional mungkin.