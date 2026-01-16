# Telegram Email Bot - Self-Hosted

Bot Telegram yang forward email Outlook ke chat Telegram secara real-time menggunakan IMAP IDLE.

## 🚀 Quick Install (VPS)

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/inbox-buddy.git
cd inbox-buddy/vps-bot

# Install dependencies
npm install

# Start web server untuk konfigurasi
pm2 start server.js --name email-server

# Buka browser: http://YOUR_IP:3000/owner
# Login dengan secret default: GANTI_SECRET_INI
# (PENTING: Edit settings.json dan ganti owner_secret!)

# Setelah konfigurasi, start bot
pm2 start telegram-bot-standalone.js --name email-bot
pm2 save
pm2 startup
```

## 📝 Setup Steps

### 1. Edit Owner Secret (WAJIB!)
Setelah `npm install` dan start server pertama kali, file `settings.json` akan dibuat. Edit:
```bash
nano settings.json
# Ganti "owner_secret": "GANTI_SECRET_INI" dengan secret kamu sendiri
```

### 2. Buka Web Config
- Akses `http://YOUR_VPS_IP:3000/owner`
- Login dengan owner_secret yang sudah kamu set
- Isi semua field:
  - **Telegram Bot Token**: Dari @BotFather
  - **Owner Chat ID**: Dari @userinfobot
  - **Outlook Email**: Email outlook kamu
  - **App Password**: Password atau App Password (jika 2FA aktif)
  - **Email Filter**: Kata kunci di subject (misal: OTP)
- Aktifkan bot dan Save

### 3. Cara Dapat App Password (Jika 2FA Aktif)
1. Buka https://account.microsoft.com/security
2. Klik "Advanced security options"
3. Scroll ke "App passwords" → "Create a new app password"
4. Copy password yang muncul

### 4. Cara Dapat Telegram Chat ID
1. Buka Telegram, cari @userinfobot
2. Klik /start
3. Bot akan reply dengan Chat ID kamu

## 🤖 Telegram Commands

| Command | Deskripsi |
|---------|-----------|
| `/start` | Info bot |
| `/status` | Cek status monitoring |
| `/myid` | Lihat Chat ID kamu |
| `/reload` | Reload settings dari file |

## 🔧 PM2 Commands

```bash
pm2 status              # Lihat status semua proses
pm2 logs email-bot      # Lihat log bot
pm2 logs email-server   # Lihat log web server
pm2 restart email-bot   # Restart bot setelah edit settings
pm2 restart all         # Restart semua
pm2 stop all            # Stop semua
```

## 📁 File Structure

```
vps-bot/
├── server.js                    # Web server untuk /owner config (port 3000)
├── telegram-bot-standalone.js   # Bot utama (baca settings.json)
├── telegram-email-bot.js        # Bot versi Cloud (opsional)
├── settings.json                # Settings lokal (auto-created)
├── public/
│   └── owner.html               # Web UI untuk konfigurasi
└── package.json
```

## 🔒 Security Notes

- **WAJIB** ganti `owner_secret` di settings.json sebelum share ke teman!
- Settings.json berisi credentials sensitif - jangan commit ke public repo
- Tambahkan `settings.json` ke `.gitignore`:
  ```bash
  echo "settings.json" >> .gitignore
  ```

## 🐛 Troubleshooting

**Bot tidak start?**
- Cek `pm2 logs email-bot`
- Pastikan semua field terisi di /owner
- Pastikan is_active = true

**Tidak bisa login IMAP?**
- Gunakan App Password jika 2FA aktif
- Pastikan email benar (outlook.com/hotmail.com)

**Tidak menerima email?**
- Cek filter subject sudah benar
- Kirim test email ke diri sendiri
- Kosongkan filter untuk terima semua email

**Settings berubah tapi bot tidak update?**
- Kirim `/reload` ke bot di Telegram
- Atau restart: `pm2 restart email-bot`

## 🆚 Cloud vs Standalone

| Feature | Standalone | Cloud |
|---------|------------|-------|
| Database | Local JSON | Supabase |
| Web Config | Self-hosted (:3000) | Lovable App |
| Setup | Clone & Run | Perlu akun Lovable |
| Multi-user | Per-VPS | Shared database |

Untuk versi Cloud (pakai Supabase), jalankan: `npm run cloud`
