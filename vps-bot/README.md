# Telegram Email Bot (VPS - Real-time)

Bot untuk forward email Outlook ke Telegram secara **real-time** menggunakan IMAP IDLE.

**✨ Settings diambil otomatis dari database!** Atur via `/owner` page di web app.

## 🚀 Quick Install

```bash
# 1. Masuk ke VPS
ssh root@your-vps-ip

# 2. Clone repo (atau git pull jika sudah ada)
git clone https://github.com/Senjakun/inbox-buddy.git
cd inbox-buddy/vps-bot

# 3. Install dependencies
npm install

# 4. Test run (settings dari database)
node telegram-email-bot.js

# 5. Run dengan PM2 (production)
npm install -g pm2
pm2 start telegram-email-bot.js --name email-bot
pm2 save
pm2 startup  # Supaya auto-start saat reboot
```

## ⚙️ Setup Settings

**Tidak perlu edit .env!** Settings diambil dari database:

1. Buka app Lovable kamu di browser
2. Pergi ke `/owner`
3. Login dengan OWNER_SECRET
4. Isi kredensial:
   - Telegram Bot Token (dari @BotFather)
   - Telegram Owner ID (dari /myid command)
   - Outlook Email
   - Outlook App Password (16 karakter)
5. Aktifkan toggle "Bot Aktif"
6. Klik Save

Bot VPS akan otomatis mengambil settings tersebut!

### Cara Dapat App Password:
1. Buka https://account.microsoft.com/security
2. Aktifkan 2FA
3. Klik "App passwords" → "Create new app password"
4. Copy password 16 karakter

### Cara Dapat Chat ID:
1. Chat @userinfobot di Telegram
2. Copy angka ID kamu

## 📱 Commands Telegram

- `/start` - Info bot
- `/status` - Cek status
- `/myid` - Lihat Chat ID kamu
- `/reload` - Reload settings dari database (owner only)

## 🔧 PM2 Commands

```bash
pm2 status          # Lihat status
pm2 logs email-bot  # Lihat logs
pm2 restart email-bot
pm2 stop email-bot
pm2 delete email-bot
```

## ⚠️ Troubleshooting

**Cannot start bot?**
- Pastikan sudah setup settings di `/owner` page
- Pastikan bot diaktifkan (is_active = true)

**Login failed?**
- Pastikan pakai App Password, bukan password biasa
- Buat App Password di: https://account.microsoft.com/security

**Settings berubah tapi bot tidak update?**
- Kirim `/reload` ke bot di Telegram
- Atau restart: `pm2 restart email-bot`

**Tidak terima email?**
- Cek logs: `pm2 logs email-bot`
- Pastikan Email Filter kosong untuk terima semua email
