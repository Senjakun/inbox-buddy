import os
import time
import logging
import schedule
import tempfile
from dotenv import load_dotenv
from telegram import Bot
from telegram.constants import ParseMode
from telegram.error import TelegramError
from email_reader import EmailReader

# Konfigurasi logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class EmailForwarderBot:
    def __init__(self):
        # Memuat variabel lingkungan
        load_dotenv('config.env')
        
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.channel_id = os.getenv('TELEGRAM_CHANNEL_ID')
        self.check_interval = int(os.getenv('CHECK_INTERVAL', 300))  # Default 5 menit
        
        # Inisialisasi bot Telegram dan pembaca email
        self.bot = Bot(token=self.bot_token)
        self.email_reader = EmailReader()
        
        # Pastikan file config.env ada
        if not os.path.exists('config.env'):
            logger.warning("File config.env tidak ditemukan. Menggunakan config.env.example sebagai fallback.")
            if os.path.exists('config.env.example'):
                load_dotenv('config.env.example')
            else:
                logger.error("File konfigurasi tidak ditemukan!")
        
    async def send_message(self, text, parse_mode=ParseMode.HTML):
        """Mengirim pesan ke channel Telegram"""
        try:
            await self.bot.send_message(
                chat_id=self.channel_id,
                text=text,
                parse_mode=parse_mode
            )
            return True
        except TelegramError as e:
            logger.error(f"Gagal mengirim pesan ke Telegram: {str(e)}")
            return False
    
    async def send_document(self, document_data, filename, caption=None):
        """Mengirim dokumen ke channel Telegram"""
        try:
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                temp_file.write(document_data)
                temp_file_path = temp_file.name
            
            # Escape HTML dalam caption jika ada
            if caption:
                caption = self.escape_html(caption)
            
            with open(temp_file_path, 'rb') as document:
                await self.bot.send_document(
                    chat_id=self.channel_id,
                    document=document,
                    filename=filename,
                    caption=caption
                )
            
            # Hapus file sementara
            os.unlink(temp_file_path)
            return True
        except Exception as e:
            logger.error(f"Gagal mengirim dokumen ke Telegram: {str(e)}")
            return False
    
    def escape_html(self, text):
        """Escape karakter HTML khusus dalam teks"""
        if not text:
            return ""
        return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    async def format_email_message(self, email):
        """Format email menjadi pesan Telegram"""
        message = f"<b>📧 Email Baru</b>\n\n"
        
        # Escape karakter HTML dalam data email
        from_email = self.escape_html(email['from'])
        subject = self.escape_html(email['subject'])
        
        message += f"<b>Dari:</b> {from_email}\n"
        message += f"<b>Subjek:</b> {subject}\n"
        message += f"<b>Tanggal:</b> {email['date'].strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        
        # Tambahkan kode OTP jika ditemukan
        if 'otp_code' in email and email['otp_code']:
            message += f"<b>🔑 OTP CODE:</b> <code>{email['otp_code']}</code>\n\n"
        
        # Tambahkan isi email lengkap
        if 'full_content' in email and email['full_content']:
            # Batasi panjang pesan
            full_content = email['full_content']
            if len(full_content) > 3800:
                full_content = full_content[:3800] + "...\n[Pesan terpotong karena terlalu panjang]"
            
            # Escape HTML dalam isi email
            full_content = self.escape_html(full_content)
            message += f"<b>Isi Email Lengkap:</b>\n\n{full_content}\n\n"
        # Fallback ke body_text jika full_content tidak tersedia
        elif email['body_text']:
            # Batasi panjang pesan
            body_text = email['body_text']
            if len(body_text) > 3800:
                body_text = body_text[:3800] + "...\n[Pesan terpotong karena terlalu panjang]"
            
            # Escape HTML dalam isi email
            body_text = self.escape_html(body_text)
            message += f"<b>Isi Email:</b>\n\n{body_text}\n\n"
        
        # Informasi tentang lampiran
        if email['attachments']:
            message += f"<b>Lampiran:</b> {len(email['attachments'])} file\n"
        
        return message
    
    async def process_new_emails(self):
        """Memproses email baru dan mengirimkannya ke Telegram"""
        logger.info("Memeriksa email baru...")
        emails = self.email_reader.get_new_emails()
        
        if not emails:
            logger.info("Tidak ada email baru")
            return
        
        logger.info(f"Ditemukan {len(emails)} email baru")
        
        for email in emails:
            try:
                # Format dan kirim pesan
                message = await self.format_email_message(email)
                success = await self.send_message(message)
                
                # Jika gagal dengan format HTML, coba kirim tanpa format
                if not success:
                    logger.info("Mencoba mengirim pesan tanpa format HTML...")
                    plain_message = f"📧 Email Baru\n\n"
                    plain_message += f"Dari: {email['from']}\n"
                    plain_message += f"Subjek: {email['subject']}\n"
                    plain_message += f"Tanggal: {email['date'].strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                    
                    # Tambahkan kode OTP jika ditemukan
                    if 'otp_code' in email and email['otp_code']:
                        plain_message += f"🔑 OTP CODE: {email['otp_code']}\n\n"
                    
                    # Tambahkan isi email lengkap
                    if 'full_content' in email and email['full_content']:
                        full_content = email['full_content']
                        if len(full_content) > 3800:
                            full_content = full_content[:3800] + "...\n[Pesan terpotong karena terlalu panjang]"
                        plain_message += f"Isi Email Lengkap:\n\n{full_content}\n\n"
                    # Fallback ke body_text jika full_content tidak tersedia
                    elif email['body_text']:
                        body_text = email['body_text']
                        if len(body_text) > 3800:
                            body_text = body_text[:3800] + "...\n[Pesan terpotong karena terlalu panjang]"
                        plain_message += f"Isi Email:\n\n{body_text}\n\n"
                    
                    if email['attachments']:
                        plain_message += f"Lampiran: {len(email['attachments'])} file\n"
                    
                    await self.bot.send_message(
                        chat_id=self.channel_id,
                        text=plain_message,
                        parse_mode=None
                    )
                
                # Kirim lampiran jika ada
                for attachment in email['attachments']:
                    await self.send_document(
                        attachment['data'],
                        attachment['filename'],
                        f"Lampiran dari email: {email['subject']}"
                    )
                
                logger.info(f"Email dengan subjek '{email['subject']}' berhasil diteruskan")
            except Exception as e:
                logger.error(f"Gagal memproses email: {str(e)}")
    
    def start_polling(self):
        """Memulai polling untuk memeriksa email baru secara berkala"""
        logger.info(f"Bot dimulai, memeriksa email setiap {self.check_interval} detik")
        
        # Jalankan pertama kali
        import asyncio
        asyncio.run(self.process_new_emails())
        
        # Jadwalkan pemeriksaan berkala
        schedule.every(self.check_interval).seconds.do(
            lambda: asyncio.run(self.process_new_emails())
        )
        
        # Loop utama
        while True:
            schedule.run_pending()
            time.sleep(1)

# Untuk menjalankan bot
if __name__ == "__main__":
    bot = EmailForwarderBot()
    bot.start_polling()

