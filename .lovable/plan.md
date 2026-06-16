
# Custom Server Panel — `/server/:id`

Membangun halaman panel server full-featured ala Pterodactyl di domain utama, dengan tema Jhonaley Store. User klik tombol **View Server** di halaman Panels → otomatis di-login → akses console, files, dll tanpa pernah melihat URL panel asli.

## Arsitektur

```text
User klik "View Server" di /panels
        │
        ▼
[edge: panel-session]  ── ambil/buat Client API key user di Pterodactyl,
                          simpan encrypted di Vault, return server identifier
        │
        ▼
Redirect ke /server/:identifier
        │
        ▼
[Halaman /server/:id]  ── semua aksi via edge functions yang proxy
                          ke Pterodactyl Client API + Wings WebSocket
```

URL panel asli tidak pernah muncul di frontend. Semua request keluar dari edge function kita.

## Database (1 migration)

Tabel baru `user_panel_credentials`:
- `user_id`, `panel_id` (FK ke `user_panels`)
- `ptero_client_key_vault_id` (uuid → Vault) — menyimpan `ptlc_...` per-user
- `server_identifier` (string pendek Pterodactyl, dipakai di URL `/server/:id`)
- RLS: hanya owner & admin yang bisa SELECT; semua write via edge function (service role).

Fungsi RPC `get_my_panel_credential(_panel_id)` — return server_identifier saja (key tetap di server).

## Edge Functions (baru)

Semua pakai pattern existing: native fetch, verify JWT user, ambil PLTA admin key dari Vault untuk operasi setup, lalu pakai per-user PLTC key untuk operasi runtime.

1. **`panel-session`** — POST `{ panelId }`. Cek ownership → jika belum punya client key, login ke Pterodactyl pakai PLTA + buat API key untuk user itu via endpoint `/api/application/users/:id/api-keys` (atau bila tidak tersedia, fallback: generate dari sisi server menggunakan endpoint client `/api/client/account/api-keys` dengan basic auth password user) → simpan di Vault → return `{ identifier }`.

2. **`ptero-proxy`** — POST `{ panelId, path, method, body }`. Validasi path whitelist (`/api/client/servers/:id/*`), pakai client key user, forward ke panel asli, return raw response. Ini handler tunggal untuk: power, stats, files list/read/write/delete/upload signed url, startup, schedules, backups.

3. **`ptero-ws-token`** — POST `{ panelId }`. Panggil `/api/client/servers/:id/websocket` untuk dapat `{ token, socket }` Wings. Return ke client supaya bisa konek langsung ke wings (IP wings akan terlihat — sesuai pilihan user, ini OK).

## Frontend

### Halaman `/panels` — tombol View Server
Tambah button hijau **"View Server"** di setiap kartu panel (sebelah Kirim/Hapus). Saat klik:
- Panggil `panel-session` → dapat `identifier`
- `navigate('/server/' + identifier + '?p=' + panelId)`

### Halaman baru `/server/:identifier`
Layout: sidebar kiri (tab) + main content. Tema amoled glassmorphism khas project.

**Tabs (sidebar):**
- **Console** — terminal xterm.js, konek WS pakai token dari `ptero-ws-token`. Input command, tombol Start/Stop/Restart/Kill.
- **Stats** — kartu CPU / RAM / Disk / Uptime realtime dari WS stats event.
- **Files** — file tree (list folder), klik file → editor Monaco (text) atau download (binary), tombol Upload, New File, New Folder, Rename, Delete. Breadcrumb path.
- **Startup** — list variable startup (env vars Pterodactyl), edit value, tombol Save.
- **Schedules** — list cron schedules, create/edit/delete schedule + tasks.
- **Backups** — list backup, tombol Create Backup, Download, Restore, Delete.

### Komponen baru
- `src/pages/ServerPanel.tsx` — shell + tabs
- `src/components/server/Console.tsx` (xterm.js)
- `src/components/server/Files.tsx` (Monaco editor)
- `src/components/server/Startup.tsx`
- `src/components/server/Schedules.tsx`
- `src/components/server/Backups.tsx`
- `src/components/server/StatsCards.tsx`
- `src/hooks/usePteroProxy.ts` — wrapper `supabase.functions.invoke('ptero-proxy', ...)`

### Route
Tambah route `<Route path="/server/:identifier" element={<ServerPanel />} />` di `AnimatedRoutes.tsx`. Route protected — cek `panel-session` mengembalikan identifier valid; kalau bukan owner → redirect ke `/panels`.

## Dependensi baru
- `xterm` + `xterm-addon-fit` — terminal console
- `@monaco-editor/react` — file editor

## Catatan keamanan
- PLTC client key disimpan terenkripsi di Supabase Vault, tidak pernah dikirim ke browser.
- Semua request Pterodactyl di-proxy via edge function, jadi user tidak pernah lihat domain panel asli.
- Pteorodactyl Wings WebSocket: koneksi WS langsung ke node (sesuai pilihan user — IP node bisa terlihat di DevTools, tapi panel URL tetap tersembunyi).
- Path whitelist di `ptero-proxy` untuk mencegah penyalahgunaan.

## Yang TIDAK dilakukan di fase ini
- Tidak menyentuh logic create-panel / delete-panel / RLS lama.
- Tidak mengubah halaman lain (Dashboard, Admin, Chat, dll).
- Tidak membuat subdomain baru.

## Estimasi
Banyak file & 1 migration. Akan saya kirim secara bertahap dalam beberapa pesan — mulai dari migration + edge functions + halaman shell + Console & Stats dulu, lalu fitur Files, Startup, Schedules, Backups berikutnya. Saya konfirmasi setelah tiap milestone sebelum lanjut.
