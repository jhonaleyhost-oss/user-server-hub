# Rapikan Sidebar / Navigasi User

Sidebar saat ini menampilkan **12 item flat** di satu grup "Navigasi" + submenu Admin. Terasa panjang, sulit dipindai, dan item dengan fungsi mirip berserakan. Akan dikelompokkan ke beberapa kategori kolapsibel — mirip gaya Admin Panel — supaya profesional & rapi.

## Struktur baru (grup kolapsibel)

```
👤 Akun & Profil
   • Dashboard              /
   • Profil Saya            /profile
   • Notifikasi             /notifikasi  (badge)

🖥️  Panel & Layanan
   • List Panel             /panels
   • Aktivitas              /activity
   • Garansi Role           /garansi

💬 Komunitas
   • Pengguna               /users
   • Chat                   /chat        (badge)
   • Support                /support     (badge)
   • Rating & Feedback      /feedback

🎁 Promo & Iklan
   • Promo & Kupon          /promo
   • Sewa & Beriklan        /sewa-iklan

👑 Admin Panel (khusus admin — sudah ada, tetap)
   • Overview, Manajemen, dll.
```

## Perilaku

- Tiap grup punya **header kolapsibel** (label + chevron) — bisa dibuka/tutup.
- **Default terbuka**: grup yang berisi route aktif. Grup lain tertutup agar sidebar ringkas.
- State buka/tutup disimpan di `sessionStorage` supaya tidak reset saat pindah halaman.
- CTA **UPGRADE** premium tetap di paling atas nav (tidak berubah).
- Kartu profil di header sidebar tetap sama.
- Badge unread (Chat/Support/Notifikasi) tetap ada + bubble angka di kanan.
- Grup Admin Panel (untuk admin) tetap seperti sekarang, hanya konsisten dipakai komponen kolapsibel yang sama supaya seragam.

## Detail teknis

- File yang diubah: **`src/components/AppSidebar.tsx`** saja.
- Definisikan array `NAV_GROUPS` berisi `{ label, icon, items: [...] }`.
- Render pakai `SidebarGroup` + tombol header custom untuk toggle (chevron animasi).
- Utility kecil `useCollapsibleGroups(defaultOpenKey)` — state per-grup via `sessionStorage` key `sidebar:groups`.
- Tidak menyentuh routing, halaman, atau logika bisnis apa pun — hanya presentasi sidebar.

## Yang tidak berubah

- Semua route & halaman.
- Sidebar Admin sub-items & logikanya.
- Kartu profil header, footer reseller countdown, tombol logout.
- Scroll persistence.

## Estimasi

Satu file diubah (~150 baris berubah, sisanya tetap). Setelah selesai, sidebar terlihat jauh lebih rapi, cepat dipindai, dan konsisten dengan gaya Admin Panel.

Setujui rencana ini untuk saya kerjakan?
