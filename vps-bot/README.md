# Telegram Email Bot (VPS - Real-time)

Bot untuk forward email Outlook ke Telegram secara **real-time** menggunakan IMAP IDLE.

## 🚀 Quick Install

```bash
# 1. Masuk ke VPS
ssh root@your-vps-ip

# 2. Clone/copy folder vps-bot ke VPS

# 3. Install dependencies
cd vps-bot
npm install

# 4. Setup environment
cp .env.example .env
nano .env  # Edit dengan kredensial kamu

# 5. Test run
node telegram-email-bot.js

# 6. Run dengan PM2 (production)
npm install -g pm2
pm2 start telegram-email-bot.js --name email-bot
pm2 save
pm2 startup  # Supaya auto-start saat reboot
```

## ⚙️ Konfigurasi (.env)

```env
TELEGRAM_BOT_TOKEN=123456:ABC...      # Token dari @BotFather
TELEGRAM_OWNER_ID=123456789           # ID kamu (dari /myid)
OUTLOOK_EMAIL=email@outlook.com       # Email Outlook
OUTLOOK_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App Password (16 karakter)
EMAIL_FILTER=OTP                      # Kosongkan untuk semua email
AUTO_DELETE_DAYS=7                    # Auto-delete setelah X hari
```

## 📱 Commands Telegram

- `/start` - Info bot
- `/status` - Cek status
- `/myid` - Lihat Chat ID kamu

## 🔧 PM2 Commands

```bash
pm2 status          # Lihat status
pm2 logs email-bot  # Lihat logs
pm2 restart email-bot
pm2 stop email-bot
pm2 delete email-bot
```

## ⚠️ Troubleshooting

**Login failed?**
- Pastikan pakai App Password, bukan password biasa
- Buat App Password di: https://account.live.com/proofs/manage/additional

**Tidak terima email?**
- Cek EMAIL_FILTER, kosongkan jika mau terima semua
- Cek logs: `pm2 logs email-bot`
