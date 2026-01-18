# 🤖 Jhonaley Auto Order V2.5 - Dokumentasi Lengkap

## 📋 Deskripsi

Bot Telegram untuk Jual panel hosting (Pterodactyl), subdomain (Cloudflare), dan penjualan produk/script dengan sistem pembayaran terintegrasi. Database menggunakan Supabase/Lovable Cloud.

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    JHONALEY AUTO ORDER v2.5                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Telegram  │  │   Atlantic  │  │     Cloudflare      │  │
│  │     Bot     │  │   Payment   │  │   DNS Management    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │                    HANDLERS.JS                         │  │
│  │  (Command Processing, Wizard State, Callback Handler)  │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────┬───────────┼───────────┬───────────────────┐  │
│  │           │           │           │                   │   │
│  ▼           ▼           ▼           ▼                   ▼   │
│ ┌────┐   ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐   │
│ │Cron│   │Database│  │Ptero   │  │Products│  │Rate      │   │
│ │Jobs│   │+Cache  │  │dactyl  │  │Manager │  │Limiter   │   │
│ └────┘   └────────┘  └────────┘  └────────┘  └──────────┘   │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │   SUPABASE DATABASE   │                      │
│              │   (Lovable Cloud)     │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Struktur File

| File | Deskripsi |
|------|-----------|
| `index.js` | Entry point, inisialisasi bot, database, dan cron |
| `handlers.js` | Handler untuk semua command dan callback |
| `database.js` | Database handler dengan caching (Supabase) |
| `cache.js` | In-memory caching system |
| `rateLimit.js` | Rate limiter & message queue |
| `cron.js` | Auto-delete, reminder, CPU monitoring |
| `pterodactyl.js` | API komunikasi dengan Pterodactyl |
| `cloudflare.js` | DNS management via Cloudflare API |
| `products.js` | Manajemen produk/script |
| `settings.js` | Konfigurasi & kredensial |
| `config.js` | Konstanta (harga, fee, dll) |
| `utils.js` | Utility functions |
| `atlantic.js` | Payment gateway integration |

---

## 🎯 Fitur Utama

### 1. 👤 Manajemen User

**Fitur User:**
- ✅ Registrasi otomatis saat `/start`
- ✅ Balance tracking (saldo)
- ✅ Total spending tracking
- ✅ Riwayat transaksi

---

### 2. 🖥️ Manajemen Panel (Pterodactyl)

**Fitur Panel:**
- ✅ **Panel Node.js** - Untuk aplikasi Node.js
- ✅ **Panel Python** - Untuk aplikasi Python
- ✅ **Panel GRATIS** - Trial 30 menit (1x per user)
- ✅ Pilihan RAM: 1GB, 2GB, 4GB
- ✅ Auto-generate username & password
- ✅ Perpanjangan (extend) masa aktif
- ✅ Free extend 1x untuk panel expired
- ✅ Auto-delete panel expired

### 3. 🌐 Manajemen Subdomain (Cloudflare)

**Fitur Subdomain:**
- ✅ **Multi-domain support** - Pilih dari domain yang tersedia
- ✅ **2 subdomain per order** - Termasuk SL (Subdomain utama)
- ✅ **Proxy toggle** - Cloudflare proxy on/off
- ✅ **Switch IP** - Ganti IP tanpa hapus subdomain
- ✅ **Perpanjangan** - Extend masa aktif subdomain
- ✅ **Auto-delete** - Hapus subdomain expired

**Wizard Flow:**
```
1. Pilih domain (contoh: domain1.xyz, domain2.net)
2. Input subdomain utama (misal: app)
3. Input IP address 1
4. Toggle proxy (on/off)
5. Input subdomain SL (misal: sl-app)
6. Input IP address 2
7. Toggle proxy SL (on/off)
8. Konfirmasi & bayar
```

---

### 4. ⭐ Sistem Reseller

**Fitur Reseller:**
- ✅ **Upgrade ke Reseller** - Berbayar dengan periode tertentu
- ✅ **Buat Panel** - Untuk customer sendiri
- ✅ **Tracking** - Panel yang dibuat tercatat
- ✅ **Auto-expire** - Status reseller berakhir otomatis

**Benefit Reseller:**
```
- Bisa buat panel untuk customer
- Dashboard khusus reseller
- Notifikasi reminder sebelum expired
```

---

### 5. 💰 Sistem Pembayaran (Atlantic)

**Fitur Pembayaran:**
- ✅ **QRIS Payment** - Scan QR untuk bayar
- ✅ **Auto-check status** - Polling status pembayaran
- ✅ **Timeout handling** - Cancel otomatis jika timeout
- ✅ **Fee QRIS** - Fee transparan ke user
- ✅ **Instant credit** - Saldo langsung masuk setelah bayar

**Flow Pembayaran:**
```
1. User pilih nominal atau input custom
2. Generate QRIS + unique amount
3. User scan & bayar
4. Bot auto-check status (polling)
5. Saldo masuk otomatis
```

---

### 6. 🛒 Manajemen Produk (Script Store)

| Command | Deskripsi | Akses |
|---------|-----------|-------|
| `/addproduk` | Tambah produk baru | Owner |
| `/editproduk [id]` | Edit produk | Owner |
| `/delproduk [id]` | Hapus produk | Owner |
| `/listproduk` | Lihat daftar produk | Semua |
| `/riwayatproduk` | Riwayat pembelian | User |

**Fitur Produk:**
- ✅ **CRUD Produk** - Owner bisa kelola produk
- ✅ **Deskripsi & Harga** - Info lengkap produk
- ✅ **Pembelian via Saldo** - Potong saldo user
- ✅ **Delivery otomatis** - Kirim file/link setelah bayar
- ✅ **Riwayat pembelian** - User bisa lihat history

---

### 7. 📊 Owner Dashboard

| Command | Deskripsi |
|---------|-----------|
| `/broadcast [pesan]` | Broadcast ke semua user |
| `/addsaldo [uid] [nominal]` | Tambah saldo user |
| `/setharga` | Atur harga panel |
| `/diskon` | Atur diskon global |

**Fitur Owner:**
- ✅ **Statistik** - Total user, panel, revenue
- ✅ **Broadcast** - Kirim pesan ke semua user
- ✅ **User management** - Kelola balance & status
- ✅ **Pricing control** - Atur harga dinamis
- ✅ **Discount system** - Diskon global dengan periode

---

### 8. ⏰ Cron Jobs (Otomasi)

| Job | Interval | Deskripsi |
|-----|----------|-----------|
| Panel cleanup | 5 menit | Hapus panel expired |
| Reminder | 1 jam | Kirim reminder H-1 |
| Reseller check | 1 jam | Cek status reseller |
| CPU monitor | 10 menit | Monitor CPU usage |
| Subdomain cleanup | 5 menit | Hapus subdomain expired |

**Fitur Cron:**
- ✅ **Auto-delete panels** - Hapus + delete di Pterodactyl
- ✅ **Reminder notifications** - Notif sebelum expired
- ✅ **CPU monitoring** - Alert jika CPU tinggi
- ✅ **Subdomain cleanup** - Hapus DNS record expired
- ✅ **Reseller expiry** - Reset status reseller

---

### 9. 🧙 Wizard System dengan Timeout & Reminder

**Fitur Wizard:**
- ✅ **State management** - Track wizard progress
- ✅ **Auto timeout** - 10 menit inaktif = expired
- ✅ **Reminder** - Notif 2 menit sebelum timeout
- ✅ **Extend session** - User bisa perpanjang waktu
- ✅ **Refund on cancel** - Kembalikan saldo jika batal
- ✅ **Confirmation** - Konfirmasi sebelum batal (jika ada saldo)

**Timeout Flow:**
```
0:00 - Wizard dimulai
8:00 - Reminder dikirim (2 menit tersisa)
     - Pilihan: [Lanjut Proses] [Batalkan]
10:00 - Auto-expired (jika tidak respond)
      - Saldo dikembalikan (jika sudah dipotong)
      - Notifikasi ke user
```

---

### 10. ⚡ Performance Optimization

**Caching System:**
```javascript
// TTL (Time-to-Live) settings
{
    prices: 5 menit,        // Harga panel
    discount: 1 menit,      // Diskon aktif
    cpu_config: 10 menit,   // Konfigurasi CPU
    ptero_config: 30 menit, // Config Pterodactyl
    cf_config: 30 menit,    // Config Cloudflare
    user_data: 2 menit,     // Data user
    products: 5 menit,      // Daftar produk
    user_ids: 5 menit,      // List user IDs
}
```

**Rate Limiter:**
```javascript
{
    maxRequestsPerUser: 10,    // Max 10 request per window
    windowMs: 10 * 1000,       // Window 10 detik
    globalConcurrency: 5,      // Max 5 proses bersamaan
    queueTimeout: 30 * 1000,   // Timeout queue 30 detik
    cooldownMs: 1000,          // Cooldown antar proses
}
```

---

### 11. 🔐 Keamanan

- ✅ **Owner-only commands** - Validasi akses owner
- ✅ **Rate limiting** - Cegah spam/abuse
- ✅ **Input validation** - Validasi semua input user
- ✅ **Secure credentials** - API keys di settings terpisah
- ✅ **RLS policies** - Database dengan Row Level Security

---

## 🗄️ Database Schema

### Tables

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Data user (id, balance, reseller status) |
| `panels` | Panel yang dibuat |
| `transactions` | Histori transaksi |
| `pending_orders` | Order yang masih pending |
| `vouchers` | Kode voucher |
| `reseller_panels` | Panel dibuat reseller |
| `settings` | Konfigurasi global |
| `subdomains` | Data subdomain |

### Users Table
```sql
id              VARCHAR PRIMARY KEY  -- Telegram User ID
username        VARCHAR              -- Telegram Username
first_name      VARCHAR              -- Nama depan
balance         INTEGER DEFAULT 0    -- Saldo
is_reseller     BOOLEAN DEFAULT FALSE
reseller_expired_at  BIGINT          -- Timestamp expired reseller
total_spending  INTEGER DEFAULT 0    -- Total pembelian
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### Panels Table
```sql
id              VARCHAR PRIMARY KEY
user_id         VARCHAR REFERENCES users(id)
panel_id        VARCHAR              -- ID di Pterodactyl
username        VARCHAR
password        VARCHAR
panel_type      VARCHAR              -- 'nodejs' atau 'python'
ram             VARCHAR              -- '1gb', '2gb', '4gb'
expired_at      BIGINT               -- Timestamp expired
status          VARCHAR              -- 'active', 'expired', 'deleted'
reminder_sent   BOOLEAN DEFAULT FALSE
free_extended   BOOLEAN DEFAULT FALSE
ptero_id        INTEGER              -- Server ID di Pterodactyl
ptero_user_id   INTEGER              -- User ID di Pterodactyl
created_at      TIMESTAMP
```

### Subdomains Table
```sql
id              VARCHAR PRIMARY KEY
user_id         VARCHAR
domain          VARCHAR              -- Domain induk
subdomain1      VARCHAR              -- Subdomain utama
subdomain2      VARCHAR              -- Subdomain SL
ip1             VARCHAR
ip2             VARCHAR
proxied1        BOOLEAN DEFAULT FALSE
proxied2        BOOLEAN DEFAULT FALSE
dns_record_id1  VARCHAR              -- Cloudflare record ID
dns_record_id2  VARCHAR
cloudflare_zone_id  VARCHAR
expired_at      BIGINT
status          VARCHAR
reminder_sent   BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP
```

---

## ⚙️ Konfigurasi

### settings.js
```javascript
module.exports = {
    // Telegram
    botToken: "YOUR_BOT_TOKEN",
    ownerId: "YOUR_TELEGRAM_ID",
    notificationChannelId: "CHANNEL_ID",
    
    // Supabase
    supabase: {
        url: "https://xxx.supabase.co",
        serviceKey: "YOUR_SERVICE_ROLE_KEY"
    },
    
    // Pterodactyl
    pterodactyl: {
        panelUrl: "https://panel.example.com",
        apiKey: "YOUR_API_KEY",
        clientApiKey: "YOUR_CLIENT_API_KEY",
        nest_id: 1,
        egg_nodejs: 1,
        egg_python: 2,
        location_id: 1
    },
    
    // Cloudflare
    cloudflare: {
        apiToken: "YOUR_CF_TOKEN",
        zones: {
            "domain1.xyz": "ZONE_ID_1",
            "domain2.net": "ZONE_ID_2"
        }
    },
    
    // Atlantic (Payment)
    atlantic: {
        apiKey: "YOUR_ATLANTIC_KEY",
        merchantId: "YOUR_MERCHANT_ID"
    }
};
```

---

## 🚀 Menjalankan Bot

```bash
# Install dependencies
npm install

# Run bot
node index.js
```

### Dependencies
```json
{
  "node-telegram-bot-api": "^0.x.x",
  "@supabase/supabase-js": "^2.x.x",
  "axios": "^1.x.x",
  "qrcode": "^1.x.x"
}
```

---

## 📝 Changelog

### v3.4 (Latest)
- ✅ Wizard timeout dengan auto-cleanup (10 menit)
- ✅ Reminder sebelum timeout (2 menit)
- ✅ Konfirmasi sebelum batal wizard (jika ada payment)
- ✅ Refund otomatis jika wizard timeout/dibatalkan
- ✅ Navigasi dengan editMessageText (lebih smooth)

### v3.3
- ✅ Subdomain wizard dengan proxy toggle
- ✅ Switch IP handler
- ✅ Multi-domain support

### v3.2
- ✅ Panel Python support
- ✅ Free panel trial

### v3.1
- ✅ Product management
- ✅ Voucher system

### v3.0
- ✅ Migrasi ke Supabase/Lovable Cloud
- ✅ Caching system
- ✅ Rate limiter

---

## 📞 Support

Untuk bantuan atau laporan bug, hubungi owner bot via Telegram.

---

**Jhonaley Auto Order v2.5**
