# Austin Pay Relay (VPS IP statis)

Austin Pay memblokir request dari IP yang tidak di-whitelist. Edge function memakai IP AWS
yang berubah-ubah, jadi semua request Austin diteruskan lewat VPS milikmu.

## 1. Pasang di VPS
```bash
mkdir -p /opt/austin-proxy && cd /opt/austin-proxy
# upload server.js ke folder ini
PROXY_TOKEN="ISI_TOKEN_RAHASIA" PORT=8787 node server.js
```

Jalankan permanen (systemd):
```ini
# /etc/systemd/system/austin-proxy.service
[Unit]
Description=Austin Pay Relay
After=network.target

[Service]
Environment=PROXY_TOKEN=ISI_TOKEN_RAHASIA
Environment=PORT=8787
WorkingDirectory=/opt/austin-proxy
ExecStart=/usr/bin/node /opt/austin-proxy/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload && systemctl enable --now austin-proxy
```

## 2. Buka akses HTTPS
Disarankan pakai domain + Nginx/Caddy TLS, mis. `https://pay-relay.jhonaleystore.id`
(proxy_pass ke http://127.0.0.1:8787). HTTP polos juga jalan tapi kurang aman.

## 3. Whitelist IP VPS di panel Austin
Cukup sekali — IP VPS statis.

## 4. Isi secret di backend
- `AUSTIN_PROXY_URL` = URL relay (mis. https://pay-relay.jhonaleystore.id)
- `AUSTIN_PROXY_TOKEN` = token yang sama dengan PROXY_TOKEN

Kalau `AUSTIN_PROXY_URL` kosong, sistem otomatis kembali memanggil Austin langsung.

## Pemasangan cepat (pay.jhonaleystore.id)

1. DNS: A record `pay` -> IP VPS.
2. Upload file:
   ```bash
   mkdir -p /opt/austin-proxy
   # upload server.js ke /opt/austin-proxy/server.js
   cp austin-proxy.service /etc/systemd/system/
   nano /etc/systemd/system/austin-proxy.service   # isi PROXY_TOKEN
   systemctl daemon-reload && systemctl enable --now austin-proxy
   ```
3. Nginx + SSL:
   ```bash
   cp nginx-pay.jhonaleystore.id.conf /etc/nginx/sites-available/pay.conf
   ln -s /etc/nginx/sites-available/pay.conf /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d pay.jhonaleystore.id
   ```
4. Tes: `curl -X POST https://pay.jhonaleystore.id/relay -H "x-proxy-token: TOKEN" -d '{"method":"GET","path":"/api/deposit/check/1"}'`
5. Jangan buka port 8787 ke publik (`ufw deny 8787`).
6. Whitelist IP VPS di panel Austin.

URL relay untuk backend: `https://pay.jhonaleystore.id/relay`
