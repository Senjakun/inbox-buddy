import logging
from telegram_bot import EmailForwarderBot

# Konfigurasi logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def main():
    """Fungsi utama untuk menjalankan bot"""
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
