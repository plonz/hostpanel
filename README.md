# HostPanel - Web Hosting & App Control Panel untuk VPS

HostPanel adalah web control panel modern, ringan, dan cepat yang dirancang khusus untuk mengelola VPS Linux tanpa membebani resource server (hanya memakan ~40-60 MB RAM). Cocok untuk menjalankan aplikasi **Node.js**, **Python (FastAPI, Flask, Django, Bot Telegram/Discord)**, serta mengelola file dan terminal langsung dari browser.

---

## Fitur Utama

1. **Websites & Subdomain Hosting (Nginx Virtual Hosts)**
   - Tambah **Domain Utama** (contoh: `domainanda.com`) dan **Subdomain** (contoh: `api.domainanda.com`, `bot.domainanda.com`).
   - Dukungan tipe website:
     - **Static Website / Frontend**: HTML, CSS, JS, atau build React/Vue dengan document root otomatis di `/var/www/<domain>`.
     - **Reverse Proxy**: Teruskan trafik domain langsung ke port aplikasi Node.js atau Python.
   - **1-Click SSL Let's Encrypt**: Pasang HTTPS otomatis via Certbot gratis dengan tombol sekali klik.
   - **Integrasi File Manager**: Buka folder website langsung di File Manager dengan 1 klik.
   - Saklar Aktifkan / Nonaktifkan website kapan saja.

2. **Dashboard System Monitoring**
   - Monitoring real-time penggunaan CPU, RAM, Disk, dan Uptime.
   - Deteksi spesifikasi server (OS, Arsitektur, Jumlah Core, IP Server).
   - Indikator kesehatan server secara visual.

3. **File Manager Lengkap**
   - Navigasi folder dan drive VPS dengan breadcrumbs cepat.
   - Upload file (drag & drop atau tombol upload) & Download file.
   - Buat file baru, folder baru, rename, dan hapus.
   - **Built-in Code Editor**: Edit file script (`.js`, `.py`, `.json`, `.env`, `.txt`, `.html`, dll.) langsung di browser dan simpan seketika.
   - **Kompresi Arsip**: Fitur Compress ke ZIP dan Ekstrak ZIP langsung di server.

4. **Web Terminal Interaktif (Xterm.js + PTY)**
   - Terminal interaktif real-time berbasis WebSocket dengan pseudo-terminal (PTY).
   - Mendukung semua perintah Linux, termasuk editor interaktif (`nano`, `vim`), `htop`, `git`, `python`, `node`, `curl`, dsb.
   - Shortcut praktis untuk cek Node version, Python version, Git status, Free RAM, dan Docker.
   - Fitur Clear, Reconnect, dan auto-fit ukuran layar terminal.

5. **Process Manager (Aplikasi Node.js & Python)**
   - Pengganti PM2 bawaan panel untuk menjalankan aplikasi di background sebagai daemon.
   - Mendukung script **Node.js** (`node app.js`, `npm start`, dsb.) dan **Python** (`python3 main.py`, `uvicorn`, virtualenv).
   - **Auto-Restart**: Otomatis menjalankan ulang aplikasi jika crash/error dengan proteksi crash loop.
   - **Live Streaming Logs**: Lihat log `stdout` & `stderr` aplikasi secara real-time via WebSocket.
   - **Konfigurasi Environment**: Atur PORT, file kerja (CWD), dan variable `.env` per aplikasi langsung dari modal.
   - **Nginx Reverse Proxy Generator**: Salin konfigurasi Nginx satu klik untuk menghubungkan domain Anda ke port aplikasi.

6. **Keamanan & Pengaturan**
   - Autentikasi aman berbasis JWT Token & Cookie HTTP-only.
   - Password di-hash menggunakan `bcrypt`.
   - Ganti password admin kapan saja di menu Settings.
   - Referensi integrasi systemd otomatis.

---

## Cara Upload & Install di VPS

### Persyaratan VPS:
- OS: **Ubuntu 20.04/22.04/24.04**, **Debian 11/12**, atau **CentOS/AlmaLinux/Rocky 8/9**.
- RAM: Minimal 512 MB (Panel sangat ringan, ~50 MB RAM).
- Hak akses: `root` atau user dengan `sudo`.

---

### Opsi 1: Install Cepat 1-Perintah (Rekomendasi)

#### 1. Upload Folder Panel ke VPS
Anda bisa upload folder ini ke VPS (misalnya ke `/opt/panel-hosting` atau `/root/panel-hosting`) menggunakan salah satu cara berikut:

**Menggunakan Git:**
```bash
cd /opt
git clone <URL_REPO_ANDA> panel-hosting
cd panel-hosting
```

**Atau upload file ZIP lewat SFTP (FileZilla / WinSCP / SCP):**
```bash
# Dari komputer lokal (PowerShell / Command Prompt):
scp -r "E:\panel hosting" root@IP_VPS_ANDA:/opt/panel-hosting
```

#### 2. Jalankan Installer Otomatis
Masuk ke VPS via SSH:
```bash
ssh root@IP_VPS_ANDA
cd /opt/panel-hosting

# Berikan izin eksekusi script
chmod +x install.sh

# Jalankan installer
sudo ./install.sh
```

Script akan secara otomatis:
1. Memeriksa & menginstall Node.js 20 LTS, Python 3, pip, build-essential jika belum ada.
2. Menginstall semua dependensi backend & memverifikasi build frontend `dist/`.
3. Membuat file konfigurasi `.env` dengan JWT secret acak yang kuat.
4. Membuat dan mengaktifkan service systemd `panel.service` (agar otomatis jalan saat VPS reboot).
5. Membuka port `3000` di firewall (UFW).
6. Menampilkan URL akses, username, dan password login.

---

### Opsi 2: Install Manual (Langkah demi Langkah)

Jika ingin melakukan setup manual tanpa script `install.sh`:

1. **Install Node.js & Prasyarat di VPS:**
   ```bash
   sudo apt update
   sudo apt install -y curl git python3 python3-pip build-essential
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **Masuk ke folder panel & Install dependensi:**
   ```bash
   cd /opt/panel-hosting
   npm install --production
   ```
   *(Frontend sudah ter-compile di folder `dist/`, sehingga tidak perlu build ulang di VPS).*

3. **Buat file konfigurasi `.env`:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` jika diperlukan (misal ubah PORT atau JWT_SECRET):
   ```bash
   nano .env
   ```

4. **Pasang sebagai Systemd Service:**
   Salin file service yang sudah disediakan:
   ```bash
   sudo cp panel.service /etc/systemd/system/panel.service
   sudo systemctl daemon-reload
   sudo systemctl enable panel.service
   sudo systemctl start panel.service
   ```

5. **Buka Port di Firewall (jika UFW aktif):**
   ```bash
   sudo ufw allow 3000/tcp
   ```

---

## Informasi Login Default

- **URL Panel**: `http://IP_VPS_ANDA:3000`
- **Username**: `admin`
- **Password**: `admin123`

> ⚠️ **PENTING**: Segera ganti password setelah pertama kali login di tab **Settings**!

---

## Perintah Pengelolaan Service Panel

Gunakan perintah `systemctl` standar Linux untuk mengontrol panel:

| Perintah | Fungsi |
|---|---|
| `systemctl status panel` | Cek status panel apakah aktif/running |
| `systemctl restart panel` | Memulai ulang panel |
| `systemctl stop panel` | Menghentikan panel |
| `systemctl start panel` | Menjalankan panel |
| `journalctl -u panel -f` | Melihat live log output dari panel |

---

## Panduan Mengarahkan Domain & SSL (Nginx Reverse Proxy)

Jika Anda ingin mengakses panel atau aplikasi menggunakan domain/subdomain dengan HTTPS (SSL gratis Let's Encrypt):

1. **Install Nginx & Certbot di VPS:**
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Buat Konfigurasi Virtual Host Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/panel.conf
   ```
   Isi dengan:
   ```nginx
   server {
       server_name panel.domainanda.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```

3. **Aktifkan & Pasang SSL Let's Encrypt:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/panel.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d panel.domainanda.com
   ```
   Selesai! Sekarang panel dapat diakses aman lewat `https://panel.domainanda.com`.

---

## Struktur Folder Project

```
panel-hosting/
├── client/                 # Source code frontend (React + Tailwind CSS + Lucide + Xterm.js)
├── dist/                   # Hasil build production frontend yang disajikan oleh server
├── src/
│   ├── config.js           # Konfigurasi aplikasi, env, dan database JSON
│   ├── middleware/
│   │   └── auth.js         # Autentikasi JWT & WebSocket validator
│   ├── routes/
│   │   ├── apps.js         # Endpoint manajemen background process & logs
│   │   ├── auth.js         # Endpoint login, logout, dan ganti password
│   │   ├── files.js        # Endpoint CRUD file, upload, download, zip/unzip
│   │   └── system.js       # Endpoint statistik CPU, RAM, Disk, dan OS
│   └── services/
│       ├── fileService.js  # Operasi filesystem dan archiver
│       ├── processManager.js# Supervisor daemon Node/Python dengan auto-restart
│       └── terminal.js     # WebSocket PTY interactive terminal engine
├── .env.example            # Template variable environment
├── install.sh              # 1-click automated installer untuk VPS Linux
├── package.json            # Daftar dependensi backend & npm scripts
├── panel.service           # Unit file systemd untuk daemon VPS
├── README.md               # Dokumentasi lengkap
└── server.js               # Entry point utama Express & WebSocket server
```

---

## Lisensi
MIT License. Bebas digunakan dan dikembangkan untuk kebutuhan hosting pribadi maupun komersial.
