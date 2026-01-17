import logging
import os
import json

# Konfigurasi logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

CONFIG_FILE = 'config.env'

def load_config():
    """Load konfigurasi dari file config.env"""
    config = {}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    config[key.strip()] = value.strip()
    return config

def save_config(config):
    """Simpan konfigurasi ke file config.env"""
    with open(CONFIG_FILE, 'w') as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")
    logger.info(f"Konfigurasi disimpan ke {CONFIG_FILE}")

def setup_config():
    """Setup konfigurasi awal - minta input dari user"""
    print("\n" + "="*50)
    print("🤖 SETUP BOT EMAIL FORWARDER")
    print("="*50)
    
    config = load_config()
    
    # Cek apakah sudah ada konfigurasi
    existing_token = config.get('TELEGRAM_BOT_TOKEN', '')
    existing_owner = config.get('TELEGRAM_OWNER_ID', '')
    
    if existing_token and existing_owner:
        print(f"\n📋 Konfigurasi sudah ada:")
        print(f"   Token: {existing_token[:10]}...{existing_token[-5:]}")
        print(f"   Owner ID: {existing_owner}")
        
        choice = input("\n🔄 Gunakan konfigurasi ini? (y/n): ").strip().lower()
        if choice == 'y' or choice == '':
            return config
        print("\n📝 Masukkan konfigurasi baru:")
    else:
        print("\n📝 Setup pertama kali - Masukkan konfigurasi bot:")
    
    # Minta Telegram Bot Token
    while True:
        token = input("\n🔑 Masukkan TELEGRAM_BOT_TOKEN: ").strip()
        if token:
            # Validasi format token sederhana
            if ':' in token and len(token) > 30:
                config['TELEGRAM_BOT_TOKEN'] = token
                break
            else:
                print("❌ Format token tidak valid. Token harus mengandung ':' dan panjang > 30 karakter")
        else:
            print("❌ Token tidak boleh kosong!")
    
    # Minta Owner ID
    while True:
        owner_id = input("\n👤 Masukkan TELEGRAM_OWNER_ID: ").strip()
        if owner_id:
            # Validasi hanya angka
            if owner_id.isdigit():
                config['TELEGRAM_OWNER_ID'] = owner_id
                break
            else:
                print("❌ Owner ID harus berupa angka!")
        else:
            print("❌ Owner ID tidak boleh kosong!")
    
    # Simpan konfigurasi
    save_config(config)
    
    print("\n" + "="*50)
    print("✅ KONFIGURASI BERHASIL DISIMPAN!")
    print("="*50)
    print(f"\n📁 File: {CONFIG_FILE}")
    print(f"🔑 Token: {config['TELEGRAM_BOT_TOKEN'][:10]}...{config['TELEGRAM_BOT_TOKEN'][-5:]}")
    print(f"👤 Owner ID: {config['TELEGRAM_OWNER_ID']}")
    print("\n💡 Gunakan command /set di Telegram untuk konfigurasi email")
    print("="*50 + "\n")
    
    return config

def main():
    """Fungsi utama untuk menjalankan bot"""
    # Setup konfigurasi dulu
    config = setup_config()
    
    if not config.get('TELEGRAM_BOT_TOKEN') or not config.get('TELEGRAM_OWNER_ID'):
        logger.error("Konfigurasi tidak lengkap! Jalankan ulang script.")
        return
    
    # Import dan jalankan bot
    from telegram_bot import EmailForwarderBot
    
    logger.info("Memulai Bot Email Forwarder")
    try:
        bot = EmailForwarderBot()
        bot.start_polling()
    except KeyboardInterrupt:
        logger.info("Bot dihentikan oleh pengguna")
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()
