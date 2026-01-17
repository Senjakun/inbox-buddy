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

## Persyaratan

- Python 3.7 atau lebih baru
- Akun email dengan akses IMAP
- Bot Telegram dan channel private

## Instalasi

1. Clone repositori ini:

```bash
git clone https://github.com/Senjakun/inbox-buddy.git
cd inbox-buddy
```

2. Instal dependensi:

```bash
pip install -r requirements.txt
```

3. Salin file konfigurasi contoh:

```bash
cp config.env.example config.env
```

4. Edit file `config.env` dan isi dengan informasi yang sesuai:

```
# Konfigurasi Bot Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHANNEL_ID=your_channel_id_here

# Konfigurasi Email
EMAIL_HOST=imap.example.com
EMAIL_PORT=993
EMAIL_USERNAME=your_email@example.com
EMAIL_APP_PASSWORD=your_app_password_here
EMAIL_FOLDER=INBOX

# Interval cek email dalam detik
CHECK_INTERVAL=300
```

## Cara Mendapatkan Sandi Aplikasi Email

Untuk keamanan yang lebih baik, bot ini menggunakan sandi aplikasi untuk mengakses email Anda. Berikut cara mendapatkannya:

### Gmail:
1. Buka [Pengaturan Keamanan Google](https://myaccount.google.com/security)
2. Aktifkan verifikasi 2 langkah jika belum
3. Pilih "Sandi Aplikasi"
4. Pilih "Aplikasi Lainnya" dan beri nama (misalnya "Telegram Email Bot")
5. Salin sandi aplikasi yang dihasilkan dan gunakan sebagai `EMAIL_APP_PASSWORD`

### Yahoo Mail:
1. Buka [Pengaturan Akun](https://login.yahoo.com/account/security)
2. Aktifkan verifikasi 2 langkah
3. Pilih "Kelola sandi aplikasi"
4. Pilih "Lainnya" dan beri nama
5. Salin sandi yang dihasilkan

### Outlook/Hotmail:
1. Buka [Pengaturan Keamanan](https://account.live.com/proofs/Manage/additional)
2. Aktifkan verifikasi 2 langkah
3. Pilih "Sandi Aplikasi"
4. Buat sandi aplikasi baru

## Cara Mendapatkan Token Bot dan Channel ID

### Mendapatkan Token Bot:
1. Buka Telegram dan cari [@BotFather](https://t.me/BotFather)
2. Kirim perintah `/newbot` dan ikuti instruksinya
3. Setelah selesai, Anda akan mendapatkan token bot

### Mendapatkan Channel ID:
1. Buat channel private di Telegram
2. Tambahkan bot Anda sebagai admin channel dengan izin "Post Messages"
3. Kirim pesan ke channel
4. Akses URL: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Cari nilai `chat.id` yang dimulai dengan `-100`

## Menjalankan Bot

### Di Windows

Anda dapat menggunakan salah satu dari dua cara berikut:

1. Menggunakan file batch:
   - Klik dua kali pada file `run_bot.bat`

2. Menggunakan PowerShell:
   - Klik kanan pada file `run_bot.ps1`
   - Pilih "Run with PowerShell"

### Di Linux/macOS

```bash
python main.py
```

Untuk menjalankan bot secara terus-menerus di server, Anda dapat menggunakan tools seperti `screen`, `tmux`, atau `systemd`.

### Menggunakan PM2 (Recommended)

```bash
pm2 start main.py --name email-bot --interpreter python3
pm2 save
pm2 startup
```

### Contoh Konfigurasi Systemd

Buat file `/etc/systemd/system/telegram-email-forwarder.service`:

```
[Unit]
Description=Telegram Email Forwarder Bot
After=network.target

[Service]
User=yourusername
WorkingDirectory=/path/to/inbox-buddy
ExecStart=/usr/bin/python3 /path/to/inbox-buddy/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Kemudian aktifkan dan jalankan service:

```bash
sudo systemctl enable telegram-email-forwarder
sudo systemctl start telegram-email-forwarder
```

## Pemecahan Masalah

### Bot tidak menerima email
- Pastikan pengaturan IMAP diaktifkan di akun email Anda
- Periksa apakah sandi aplikasi yang digunakan sudah benar
- Pastikan Anda menggunakan sandi aplikasi, bukan sandi akun utama
- Periksa apakah server email mengizinkan akses IMAP dari alamat IP Anda
- Untuk Gmail, pastikan "Akses aplikasi yang kurang aman" diizinkan jika Anda tidak menggunakan sandi aplikasi

### Bot tidak mengirim pesan ke channel
- Pastikan bot adalah admin di channel
- Periksa apakah TELEGRAM_CHANNEL_ID sudah benar
- Periksa log untuk error spesifik

## Lisensi

[MIT License](LICENSE)

## Kontribusi

Kontribusi selalu diterima! Silakan buat pull request atau buka issue untuk diskusi.
