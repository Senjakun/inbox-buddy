# Bot Telegram Email Forwarder

Bot Telegram yang dapat memforward email dari akun email ke channel Telegram private secara otomatis.

## Fitur

- Meneruskan email baru ke channel Telegram private
- Memfilter email berdasarkan pengirim dan subjek
- Mengekstrak kode OTP dari email menggunakan CSS selector
- Mendukung pengiriman lampiran email
- Memeriksa email secara berkala sesuai interval yang dikonfigurasi
- Mendukung koneksi email melalui IMAP
- Menampilkan informasi lengkap dari email (pengirim, subjek, tanggal, dan isi)
- **Konfigurasi via Telegram** - Setup email langsung dari bot Telegram

## Persyaratan

- Python 3.7 atau lebih baru
- Akun email dengan akses IMAP
- Bot Telegram dan channel private

---

## 🚀 Instalasi di VPS (Digital Ocean Ubuntu)

### Step 1: Connect ke VPS
```bash
ssh root@IP_VPS_ANDA
```

### Step 2: Update Sistem & Install Dependencies
```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Python dan dependencies (PENTING: install python3.12-venv)
sudo apt install python3 python3-pip python3-venv python3.12-venv git -y

# Install PM2 untuk menjalankan bot 24/7
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
sudo npm install -g pm2
```

### Step 3: Clone Repository
```bash
cd ~
git clone https://github.com/Senjakun/inbox-buddy.git
cd inbox-buddy
```

### Step 4: Setup Virtual Environment
```bash
# Buat virtual environment
python3 -m venv venv

# Aktifkan virtual environment
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### Step 5: Jalankan Bot (Setup Interaktif)
```bash
# Jalankan bot pertama kali - akan diminta input Token & Owner ID
python main.py
```

Bot akan meminta:
1. **TELEGRAM_BOT_TOKEN** - Dapat dari @BotFather
2. **TELEGRAM_OWNER_ID** - ID Telegram Anda (dapat dari @userinfobot)

### Step 6: Jalankan dengan PM2 (24/7)
```bash
# Setelah setup selesai, jalankan dengan PM2
pm2 start main.py --name yuki-bot --interpreter ~/inbox-buddy/venv/bin/python

# Simpan konfigurasi PM2
pm2 save

# Auto-start saat reboot
pm2 startup
# Jalankan command yang muncul
```

### Commands PM2 Berguna:
```bash
pm2 status          # Lihat status bot
pm2 logs yuki-bot   # Lihat log bot
pm2 restart yuki-bot # Restart bot
pm2 stop yuki-bot   # Stop bot
```

---

## 📱 Konfigurasi via Telegram

Setelah bot berjalan, konfigurasi email langsung dari Telegram:

### Commands Bot:
| Command | Deskripsi |
|---------|-----------|
| `/start` | Mulai bot |
| `/help` | Tampilkan bantuan |
| `/settings` | Lihat semua pengaturan |
| `/set email_host <host>` | Set host email (misal: imap-mail.outlook.com) |
| `/set email_user <email>` | Set email address |
| `/set email_pass <password>` | Set app password |
| `/set filter_sender <email>` | Filter email dari pengirim tertentu |
| `/set filter_subject <keyword>` | Filter email dengan subjek tertentu |
| `/set check_interval <menit>` | Set interval cek email |
| `/testemail` | Test koneksi email |

### Contoh Setup Email:
```
/set email_host imap-mail.outlook.com
/set email_user your-email@outlook.com
/set email_pass your-app-password
/set check_interval 1
/testemail
```

---

## 🔑 Cara Mendapatkan Kredensial

### Mendapatkan Token Bot:
1. Buka Telegram dan cari [@BotFather](https://t.me/BotFather)
2. Kirim perintah `/newbot` dan ikuti instruksinya
3. Setelah selesai, Anda akan mendapatkan token bot

### Mendapatkan Owner ID:
1. Buka Telegram dan cari [@userinfobot](https://t.me/userinfobot)
2. Kirim `/start` untuk mendapatkan ID Anda

### Cara Mendapatkan App Password Email:

#### Gmail:
1. Buka [Pengaturan Keamanan Google](https://myaccount.google.com/security)
2. Aktifkan verifikasi 2 langkah
3. Pilih "Sandi Aplikasi"
4. Buat sandi aplikasi baru

#### Outlook/Hotmail:
1. Buka [Pengaturan Keamanan](https://account.live.com/proofs/Manage/additional)
2. Aktifkan verifikasi 2 langkah
3. Pilih "Sandi Aplikasi"
4. Buat sandi aplikasi baru

#### Yahoo Mail:
1. Buka [Pengaturan Akun](https://login.yahoo.com/account/security)
2. Aktifkan verifikasi 2 langkah
3. Pilih "Kelola sandi aplikasi"

---

## 📋 Host IMAP Email

| Provider | Host |
|----------|------|
| Gmail | `imap.gmail.com` |
| Outlook/Hotmail | `imap-mail.outlook.com` |
| Yahoo | `imap.mail.yahoo.com` |

---

## 🔧 Pemecahan Masalah

### Bot tidak menerima email
- Pastikan pengaturan IMAP diaktifkan di akun email Anda
- Periksa apakah sandi aplikasi yang digunakan sudah benar
- Gunakan `/testemail` untuk test koneksi

### Bot tidak mengirim pesan
- Pastikan bot adalah admin di channel (jika forward ke channel)
- Periksa log dengan `pm2 logs yuki-bot`

### Error "python3.12-venv not found"
```bash
sudo apt install python3.12-venv -y
```

---

## Lisensi

[MIT License](LICENSE)

## Kontribusi

Kontribusi selalu diterima! Silakan buat pull request atau buka issue untuk diskusi.
