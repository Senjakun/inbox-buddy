import os
import time
import logging
import schedule
import tempfile
import json
import random
import string
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, ContextTypes
from telegram.constants import ParseMode
from telegram.error import TelegramError
from email_reader import EmailReader

# Konfigurasi logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# File untuk menyimpan approved users
APPROVED_USERS_FILE = 'approved_users.json'
# File untuk tracking notifikasi yang sudah dikirim
NOTIFIED_USERS_FILE = 'notified_expiry.json'
# File untuk menyimpan kode redeem
REDEEM_CODES_FILE = 'redeem_codes.json'

class EmailForwarderBot:
    def __init__(self):
        # Memuat variabel lingkungan
        load_dotenv('config.env')
        
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.owner_id = os.getenv('TELEGRAM_OWNER_ID')  # ID pemilik bot
        self.check_interval = int(os.getenv('CHECK_INTERVAL', 300))  # Default 5 menit
        
        # Inisialisasi bot Telegram dan pembaca email
        self.bot = Bot(token=self.bot_token)
        self.email_reader = EmailReader()
        
        # Load approved users
        self.approved_users = self.load_approved_users()
        
        # Load notified users tracking
        self.notified_expiry = self.load_notified_expiry()
        
        # Load redeem codes
        self.redeem_codes = self.load_redeem_codes()
        
        # Pastikan file config.env ada
        if not os.path.exists('config.env'):
            logger.warning("File config.env tidak ditemukan. Menggunakan config.env.example sebagai fallback.")
            if os.path.exists('config.env.example'):
                load_dotenv('config.env.example')
            else:
                logger.error("File konfigurasi tidak ditemukan!")
    
    def load_approved_users(self):
        """Memuat daftar approved users dari file JSON
        Format: {"user_id": {"expires_at": "ISO datetime" atau null untuk permanen}}
        """
        try:
            if os.path.exists(APPROVED_USERS_FILE):
                with open(APPROVED_USERS_FILE, 'r') as f:
                    data = json.load(f)
                    # Konversi format lama (list) ke format baru (dict)
                    if isinstance(data, list):
                        new_data = {str(uid): {"expires_at": None} for uid in data}
                        self.save_approved_users(new_data)
                        logger.info(f"Migrated {len(new_data)} approved users to new format")
                        return new_data
                    logger.info(f"Loaded {len(data)} approved users")
                    return data
            else:
                # Jika file tidak ada, buat dengan owner sebagai approved user pertama
                if self.owner_id:
                    initial_data = {str(self.owner_id): {"expires_at": None}}
                    self.save_approved_users(initial_data)
                    return initial_data
                return {}
        except Exception as e:
            logger.error(f"Error loading approved users: {str(e)}")
            return {}
    
    def save_approved_users(self, users=None):
        """Menyimpan daftar approved users ke file JSON"""
        try:
            if users is None:
                users = self.approved_users
            with open(APPROVED_USERS_FILE, 'w') as f:
                json.dump(users, f, indent=2)
            logger.info(f"Saved {len(users)} approved users")
        except Exception as e:
            logger.error(f"Error saving approved users: {str(e)}")
    
    def is_owner(self, user_id):
        """Memeriksa apakah user adalah owner"""
        return str(user_id) == str(self.owner_id)
    
    def is_approved(self, user_id):
        """Memeriksa apakah user sudah di-approve dan belum expired"""
        user_id_str = str(user_id)
        if user_id_str not in self.approved_users:
            return False
        
        user_data = self.approved_users[user_id_str]
        expires_at = user_data.get("expires_at")
        
        # Jika tidak ada expiry, akses permanen
        if expires_at is None:
            return True
        
        # Cek apakah sudah expired
        try:
            expiry_date = datetime.fromisoformat(expires_at)
            if datetime.now() > expiry_date:
                # Expired, hapus dari daftar
                logger.info(f"User {user_id_str} access expired, removing...")
                self.remove_approved_user(user_id_str)
                return False
            return True
        except Exception as e:
            logger.error(f"Error parsing expiry date: {str(e)}")
            return True
    
    def load_notified_expiry(self):
        """Memuat tracking notifikasi expiry yang sudah dikirim"""
        try:
            if os.path.exists(NOTIFIED_USERS_FILE):
                with open(NOTIFIED_USERS_FILE, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Error loading notified expiry: {str(e)}")
            return {}
    
    def save_notified_expiry(self):
        """Menyimpan tracking notifikasi expiry"""
        try:
            with open(NOTIFIED_USERS_FILE, 'w') as f:
                json.dump(self.notified_expiry, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving notified expiry: {str(e)}")
    
    def load_redeem_codes(self):
        """Memuat daftar kode redeem dari file JSON"""
        try:
            if os.path.exists(REDEEM_CODES_FILE):
                with open(REDEEM_CODES_FILE, 'r') as f:
                    data = json.load(f)
                    logger.info(f"Loaded {len(data)} redeem codes")
                    return data
            return {}
        except Exception as e:
            logger.error(f"Error loading redeem codes: {str(e)}")
            return {}
    
    def save_redeem_codes(self):
        """Menyimpan daftar kode redeem ke file JSON"""
        try:
            with open(REDEEM_CODES_FILE, 'w') as f:
                json.dump(self.redeem_codes, f, indent=2)
            logger.info(f"Saved {len(self.redeem_codes)} redeem codes")
        except Exception as e:
            logger.error(f"Error saving redeem codes: {str(e)}")
    
    def generate_unique_code(self, length=6):
        """Generate kode unik acak (huruf dan angka)"""
        characters = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(random.choices(characters, k=length))
            # Pastikan kode belum digunakan
            if code not in self.redeem_codes:
                return code
    
    def create_redeem_code(self, days):
        """Membuat kode redeem baru dengan durasi tertentu"""
        code = self.generate_unique_code()
        self.redeem_codes[code] = {
            "days": days,
            "created_at": datetime.now().isoformat(),
            "created_by": self.owner_id,
            "used": False,
            "used_by": None,
            "used_at": None
        }
        self.save_redeem_codes()
        return code
    
    def use_redeem_code(self, code, user_id):
        """Menggunakan kode redeem, return days jika valid, None jika tidak"""
        code = code.upper()
        if code not in self.redeem_codes:
            return None, "Kode tidak ditemukan."
        
        code_data = self.redeem_codes[code]
        if code_data["used"]:
            return None, "Kode sudah pernah digunakan."
        
        # Tandai kode sudah digunakan
        days = code_data["days"]
        self.redeem_codes[code]["used"] = True
        self.redeem_codes[code]["used_by"] = str(user_id)
        self.redeem_codes[code]["used_at"] = datetime.now().isoformat()
        self.save_redeem_codes()
        
        return days, None
    
    def get_active_approved_users(self):
        """Mendapatkan daftar user yang masih aktif (belum expired)"""
        active_users = []
        expired_users = []
        
        for user_id, user_data in list(self.approved_users.items()):
            expires_at = user_data.get("expires_at")
            if expires_at is None:
                active_users.append(user_id)
            else:
                try:
                    expiry_date = datetime.fromisoformat(expires_at)
                    if datetime.now() > expiry_date:
                        expired_users.append(user_id)
                    else:
                        active_users.append(user_id)
                except:
                    active_users.append(user_id)
        
        # Hapus user yang expired
        for user_id in expired_users:
            del self.approved_users[user_id]
            # Hapus juga dari notified tracking
            if user_id in self.notified_expiry:
                del self.notified_expiry[user_id]
            logger.info(f"Removed expired user: {user_id}")
        
        if expired_users:
            self.save_approved_users()
            self.save_notified_expiry()
        
        return active_users, expired_users
    
    async def check_and_notify_expiring_users(self):
        """Memeriksa dan mengirim notifikasi ke user yang sudah expired (hanya 1x)"""
        now = datetime.now()
        users_expired = []
        
        for user_id, user_data in list(self.approved_users.items()):
            expires_at = user_data.get("expires_at")
            if expires_at is None:
                continue  # Skip permanent users
            
            try:
                expiry_date = datetime.fromisoformat(expires_at)
                
                # Jika sudah expired
                if now > expiry_date:
                    users_expired.append(user_id)
                        
            except Exception as e:
                logger.error(f"Error checking expiry for user {user_id}: {str(e)}")
        
        # Kirim notifikasi ke user yang sudah expired dan hapus dari daftar
        for user_id in users_expired:
            # Cek apakah sudah pernah dinotifikasi (hindari spam)
            if user_id in self.notified_expiry:
                # Sudah dinotifikasi, langsung hapus saja
                if user_id in self.approved_users:
                    del self.approved_users[user_id]
                del self.notified_expiry[user_id]
                continue
            
            message = (
                f"❌ <b>Akses Anda Telah Berakhir!</b>\n\n"
                f"Akses Anda untuk menerima notifikasi email telah berakhir.\n\n"
                f"Hubungi admin untuk memperpanjang akses."
            )
            
            try:
                await self.send_message(user_id, message)
                logger.info(f"Sent expiry notification to user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send expiry notification to {user_id}: {str(e)}")
            
            # Hapus dari approved users
            if user_id in self.approved_users:
                del self.approved_users[user_id]
            
            # Notifikasi ke owner
            if self.owner_id:
                owner_msg = f"📢 User <code>{user_id}</code> akses telah berakhir dan dihapus dari daftar."
                try:
                    await self.send_message(self.owner_id, owner_msg)
                except:
                    pass
        
        if users_expired:
            self.save_approved_users()
            self.save_notified_expiry()
    
    def add_approved_user(self, user_id, days=None):
        """Menambahkan user ke daftar approved dengan opsi durasi hari"""
        user_id_str = str(user_id)
        
        if days is not None and days > 0:
            expires_at = (datetime.now() + timedelta(days=days)).isoformat()
        else:
            expires_at = None  # Akses permanen
        
        self.approved_users[user_id_str] = {"expires_at": expires_at}
        self.save_approved_users()
        logger.info(f"User {user_id} added to approved list (expires: {expires_at})")
        return expires_at
    
    def remove_approved_user(self, user_id):
        """Menghapus user dari daftar approved"""
        user_id_str = str(user_id)
        if user_id_str in self.approved_users:
            del self.approved_users[user_id_str]
            self.save_approved_users()
            logger.info(f"User {user_id} removed from approved list")
            return True
        return False
    
    def get_user_expiry_info(self, user_id):
        """Mendapatkan info expiry user"""
        user_id_str = str(user_id)
        if user_id_str not in self.approved_users:
            return None
        
        expires_at = self.approved_users[user_id_str].get("expires_at")
        if expires_at is None:
            return "Permanen"
        
        try:
            expiry_date = datetime.fromisoformat(expires_at)
            remaining = expiry_date - datetime.now()
            if remaining.total_seconds() <= 0:
                return "Expired"
            
            days = remaining.days
            hours = remaining.seconds // 3600
            if days > 0:
                return f"{days} hari {hours} jam lagi"
            else:
                return f"{hours} jam lagi"
        except:
            return "Unknown"
        
    async def send_message(self, chat_id, text, parse_mode=ParseMode.HTML):
        """Mengirim pesan ke chat Telegram tertentu"""
        try:
            await self.bot.send_message(
                chat_id=chat_id,
                text=text,
                parse_mode=parse_mode
            )
            return True
        except TelegramError as e:
            logger.error(f"Gagal mengirim pesan ke {chat_id}: {str(e)}")
            return False
    
    async def send_to_all_approved(self, text, parse_mode=ParseMode.HTML):
        """Mengirim pesan ke semua approved users yang aktif"""
        success_count = 0
        active_users, _ = self.get_active_approved_users()
        
        for user_id in active_users:
            try:
                await self.bot.send_message(
                    chat_id=user_id,
                    text=text,
                    parse_mode=parse_mode
                )
                success_count += 1
            except TelegramError as e:
                logger.error(f"Gagal mengirim pesan ke {user_id}: {str(e)}")
        return success_count
    
    async def send_document(self, chat_id, document_data, filename, caption=None):
        """Mengirim dokumen ke chat Telegram tertentu"""
        try:
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                temp_file.write(document_data)
                temp_file_path = temp_file.name
            
            # Escape HTML dalam caption jika ada
            if caption:
                caption = self.escape_html(caption)
            
            with open(temp_file_path, 'rb') as document:
                await self.bot.send_document(
                    chat_id=chat_id,
                    document=document,
                    filename=filename,
                    caption=caption
                )
            
            # Hapus file sementara
            os.unlink(temp_file_path)
            return True
        except Exception as e:
            logger.error(f"Gagal mengirim dokumen ke {chat_id}: {str(e)}")
            return False
    
    async def send_document_to_all_approved(self, document_data, filename, caption=None):
        """Mengirim dokumen ke semua approved users yang aktif"""
        success_count = 0
        active_users, _ = self.get_active_approved_users()
        
        for user_id in active_users:
            try:
                await self.send_document(user_id, document_data, filename, caption)
                success_count += 1
            except Exception as e:
                logger.error(f"Gagal mengirim dokumen ke {user_id}: {str(e)}")
        return success_count
    
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
        """Memproses email baru dan mengirimkannya ke semua approved users"""
        logger.info("Memeriksa email baru...")
        emails = self.email_reader.get_new_emails()
        
        if not emails:
            logger.info("Tidak ada email baru")
            return
        
        logger.info(f"Ditemukan {len(emails)} email baru")
        
        active_users, _ = self.get_active_approved_users()
        if not active_users:
            logger.warning("Tidak ada approved users aktif untuk menerima notifikasi")
            return
        
        for email in emails:
            try:
                # Format dan kirim pesan ke semua approved users
                message = await self.format_email_message(email)
                success = await self.send_to_all_approved(message)
                
                # Jika gagal dengan format HTML, coba kirim tanpa format
                if success == 0:
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
                    
                    await self.send_to_all_approved(plain_message, parse_mode=None)
                
                # Kirim lampiran jika ada ke semua approved users
                for attachment in email['attachments']:
                    await self.send_document_to_all_approved(
                        attachment['data'],
                        attachment['filename'],
                        f"Lampiran dari email: {email['subject']}"
                    )
                
                logger.info(f"Email dengan subjek '{email['subject']}' berhasil diteruskan ke {len(self.approved_users)} users")
            except Exception as e:
                logger.error(f"Gagal memproses email: {str(e)}")
    
    # ==================== COMMAND HANDLERS ====================
    
    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /start"""
        user_id = update.effective_user.id
        username = update.effective_user.username or "Unknown"
        
        if self.is_approved(user_id):
            await update.message.reply_text(
                f"✅ Halo @{username}!\n\n"
                f"Anda sudah terdaftar untuk menerima notifikasi email.\n"
                f"ID Anda: <code>{user_id}</code>",
                parse_mode=ParseMode.HTML
            )
        else:
            await update.message.reply_text(
                f"👋 Halo @{username}!\n\n"
                f"Anda belum terdaftar untuk menerima notifikasi.\n"
                f"ID Anda: <code>{user_id}</code>\n\n"
                f"Minta owner untuk menambahkan ID Anda.",
                parse_mode=ParseMode.HTML
            )
    
    async def cmd_myid(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /myid - menampilkan ID user"""
        user_id = update.effective_user.id
        username = update.effective_user.username or "Unknown"
        status = "✅ Approved" if self.is_approved(user_id) else "❌ Not Approved"
        
        await update.message.reply_text(
            f"👤 <b>Info User</b>\n\n"
            f"Username: @{username}\n"
            f"ID: <code>{user_id}</code>\n"
            f"Status: {status}",
            parse_mode=ParseMode.HTML
        )
    
    async def cmd_adduser(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /adduser <user_id> - hanya owner (akses permanen)"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat menambahkan user.")
            return
        
        if not context.args:
            await update.message.reply_text(
                "📝 <b>Cara penggunaan:</b>\n"
                "<code>/adduser &lt;telegram_id&gt;</code>\n\n"
                "Contoh: <code>/adduser 123456789</code>\n\n"
                "💡 Untuk akses dengan batas waktu, gunakan:\n"
                "<code>/addakses &lt;telegram_id&gt; &lt;hari&gt;</code>",
                parse_mode=ParseMode.HTML
            )
            return
        
        target_id = context.args[0]
        
        if self.is_approved(target_id):
            expiry = self.get_user_expiry_info(target_id)
            await update.message.reply_text(f"⚠️ User {target_id} sudah terdaftar (Akses: {expiry}).")
            return
        
        self.add_approved_user(target_id)  # Tanpa durasi = permanen
        await update.message.reply_text(
            f"✅ User <code>{target_id}</code> berhasil ditambahkan dengan akses <b>PERMANEN</b>.",
            parse_mode=ParseMode.HTML
        )
    
    async def cmd_addakses(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /addakses <user_id> <hari> - hanya owner (akses dengan durasi)"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat menambahkan akses.")
            return
        
        if len(context.args) < 2:
            await update.message.reply_text(
                "📝 <b>Cara penggunaan:</b>\n"
                "<code>/addakses &lt;telegram_id&gt; &lt;hari&gt;</code>\n\n"
                "Contoh:\n"
                "• <code>/addakses 123456789 7</code> → 7 hari\n"
                "• <code>/addakses 123456789 30</code> → 30 hari\n\n"
                "💡 Untuk akses permanen, gunakan:\n"
                "<code>/adduser &lt;telegram_id&gt;</code>",
                parse_mode=ParseMode.HTML
            )
            return
        
        target_id = context.args[0]
        
        try:
            days = int(context.args[1])
            if days <= 0:
                await update.message.reply_text("⚠️ Jumlah hari harus lebih dari 0.")
                return
        except ValueError:
            await update.message.reply_text("⚠️ Jumlah hari harus berupa angka.")
            return
        
        # Jika user sudah ada, update durasinya
        expires_at = self.add_approved_user(target_id, days=days)
        expiry_date = datetime.fromisoformat(expires_at)
        
        await update.message.reply_text(
            f"✅ User <code>{target_id}</code> berhasil ditambahkan.\n\n"
            f"⏱ <b>Durasi:</b> {days} hari\n"
            f"📅 <b>Berlaku hingga:</b> {expiry_date.strftime('%d %B %Y, %H:%M')}",
            parse_mode=ParseMode.HTML
        )
    
    async def cmd_removeuser(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /removeuser <user_id> - hanya owner"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat menghapus user.")
            return
        
        if not context.args:
            await update.message.reply_text(
                "📝 <b>Cara penggunaan:</b>\n"
                "<code>/removeuser &lt;telegram_id&gt;</code>\n\n"
                "Contoh: <code>/removeuser 123456789</code>",
                parse_mode=ParseMode.HTML
            )
            return
        
        target_id = context.args[0]
        
        if target_id == str(self.owner_id):
            await update.message.reply_text("⚠️ Tidak dapat menghapus owner dari daftar.")
            return
        
        if self.remove_approved_user(target_id):
            await update.message.reply_text(
                f"✅ User <code>{target_id}</code> berhasil dihapus dari daftar approved.",
                parse_mode=ParseMode.HTML
            )
        else:
            await update.message.reply_text(f"⚠️ User {target_id} tidak ditemukan dalam daftar.")
    
    async def cmd_listusers(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /listusers - hanya owner"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat melihat daftar user.")
            return
        
        if not self.approved_users:
            await update.message.reply_text("📋 Tidak ada approved users.")
            return
        
        # Bersihkan user yang expired terlebih dahulu
        self.get_active_approved_users()
        
        user_lines = []
        for uid in self.approved_users:
            expiry_info = self.get_user_expiry_info(uid)
            is_owner = " 👑" if uid == str(self.owner_id) else ""
            user_lines.append(f"• <code>{uid}</code>{is_owner}\n   ⏱ {expiry_info}")
        
        user_list = "\n".join(user_lines)
        await update.message.reply_text(
            f"📋 <b>Daftar Approved Users ({len(self.approved_users)}):</b>\n\n{user_list}\n\n👑 = Owner",
            parse_mode=ParseMode.HTML
        )
    
    async def cmd_broadcast(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /broadcast <pesan> - hanya owner"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat mengirim broadcast.")
            return
        
        if not context.args:
            await update.message.reply_text(
                "📝 <b>Cara penggunaan:</b>\n"
                "<code>/broadcast &lt;pesan&gt;</code>\n\n"
                "Contoh: <code>/broadcast Halo semua! Ada update penting.</code>",
                parse_mode=ParseMode.HTML
            )
            return
        
        # Gabungkan semua argumen menjadi satu pesan
        message_text = " ".join(context.args)
        
        # Kirim konfirmasi
        await update.message.reply_text("📤 Mengirim broadcast...")
        
        # Format pesan broadcast
        broadcast_message = (
            f"📢 <b>BROADCAST dari Admin</b>\n\n"
            f"{self.escape_html(message_text)}"
        )
        
        # Kirim ke semua approved users
        success_count = await self.send_to_all_approved(broadcast_message)
        active_users, _ = self.get_active_approved_users()
        
        await update.message.reply_text(
            f"✅ Broadcast terkirim ke {success_count}/{len(active_users)} users.",
            parse_mode=ParseMode.HTML
        )
    
    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /status"""
        user_id = update.effective_user.id
        
        if not self.is_approved(user_id):
            await update.message.reply_text("❌ Anda tidak memiliki akses ke perintah ini.")
            return
        
        status_msg = (
            f"📊 <b>Status Bot</b>\n\n"
            f"✅ Bot aktif\n"
            f"⏱ Interval cek: {self.check_interval} detik\n"
            f"👥 Approved users: {len(self.approved_users)}\n"
            f"📧 Email host: {self.email_reader.host}\n"
            f"📬 Folder: {self.email_reader.folder}"
        )
        
        await update.message.reply_text(status_msg, parse_mode=ParseMode.HTML)
    
    async def cmd_kodeunik(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /kodeunik <hari> - hanya owner, generate kode redeem"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat membuat kode.")
            return
        
        if not context.args:
            await update.message.reply_text(
                "📝 <b>Cara penggunaan:</b>\n"
                "<code>/kodeunik &lt;hari&gt;</code>\n\n"
                "Contoh: <code>/kodeunik 7</code> untuk membuat kode dengan akses 7 hari",
                parse_mode=ParseMode.HTML
            )
            return
        
        try:
            days = int(context.args[0])
            if days <= 0:
                await update.message.reply_text("⚠️ Jumlah hari harus lebih dari 0.")
                return
        except ValueError:
            await update.message.reply_text("⚠️ Jumlah hari harus berupa angka.")
            return
        
        # Generate kode unik
        code = self.create_redeem_code(days)
        
        await update.message.reply_text(
            f"🎫 <b>Kode Redeem Berhasil Dibuat!</b>\n\n"
            f"📋 Kode: <code>{code}</code>\n"
            f"⏱ Durasi: {days} hari\n\n"
            f"Bagikan kode ini ke user. User dapat menggunakan:\n"
            f"<code>/redeem {code}</code>",
            parse_mode=ParseMode.HTML
        )
    
    async def cmd_listkode(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /listkode - hanya owner, lihat semua kode"""
        user_id = update.effective_user.id
        
        if not self.is_owner(user_id):
            await update.message.reply_text("❌ Hanya owner yang dapat melihat daftar kode.")
            return
        
        if not self.redeem_codes:
            await update.message.reply_text("📋 Tidak ada kode redeem.")
            return
        
        active_codes = []
        used_codes = []
        
        for code, data in self.redeem_codes.items():
            if data["used"]:
                used_codes.append(f"• <code>{code}</code> ({data['days']} hari) - ✅ Digunakan oleh {data['used_by']}")
            else:
                active_codes.append(f"• <code>{code}</code> ({data['days']} hari) - 🟢 Aktif")
        
        message = f"🎫 <b>Daftar Kode Redeem</b>\n\n"
        
        if active_codes:
            message += f"<b>🟢 Kode Aktif ({len(active_codes)}):</b>\n" + "\n".join(active_codes) + "\n\n"
        
        if used_codes:
            message += f"<b>✅ Kode Terpakai ({len(used_codes)}):</b>\n" + "\n".join(used_codes[-10:])  # Tampilkan 10 terakhir
            if len(used_codes) > 10:
                message += f"\n... dan {len(used_codes) - 10} lainnya"
        
        await update.message.reply_text(message, parse_mode=ParseMode.HTML)
    
    async def cmd_redeem(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /redeem <kode> - untuk user redeem kode"""
        user_id = update.effective_user.id
        
        if not context.args:
            await update.message.reply_text(
                "📝 <b>Cara penggunaan:</b>\n"
                "<code>/redeem &lt;kode&gt;</code>\n\n"
                "Contoh: <code>/redeem ABC123</code>",
                parse_mode=ParseMode.HTML
            )
            return
        
        code = context.args[0].upper()
        
        # Cek apakah user sudah punya akses
        if self.is_approved(user_id):
            user_data = self.approved_users.get(str(user_id), {})
            expires_at = user_data.get("expires_at")
            if expires_at is None:
                await update.message.reply_text("✅ Anda sudah memiliki akses permanen!")
                return
        
        # Gunakan kode
        days, error = self.use_redeem_code(code, user_id)
        
        if error:
            await update.message.reply_text(f"❌ {error}")
            return
        
        # Tambahkan akses ke user
        expires_at = self.add_approved_user(user_id, days=days)
        expiry_date = datetime.fromisoformat(expires_at)
        
        await update.message.reply_text(
            f"🎉 <b>Kode Berhasil Digunakan!</b>\n\n"
            f"✅ Anda sekarang memiliki akses selama <b>{days} hari</b>.\n"
            f"📅 Berlaku hingga: {expiry_date.strftime('%d %B %Y, %H:%M')}\n\n"
            f"Anda akan menerima notifikasi email dari bot ini.",
            parse_mode=ParseMode.HTML
        )
        
        # Notifikasi ke owner
        if self.owner_id:
            owner_msg = (
                f"📢 <b>Kode Digunakan!</b>\n\n"
                f"👤 User: <code>{user_id}</code>\n"
                f"🎫 Kode: <code>{code}</code>\n"
                f"⏱ Durasi: {days} hari"
            )
            try:
                await self.send_message(self.owner_id, owner_msg)
            except:
                pass
    
    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handler untuk command /help"""
        user_id = update.effective_user.id
        
        help_text = (
            "📖 <b>Daftar Perintah</b>\n\n"
            "/start - Mulai bot\n"
            "/myid - Lihat ID Telegram Anda\n"
            "/redeem &lt;kode&gt; - Gunakan kode akses\n"
            "/status - Cek status bot\n"
            "/help - Tampilkan bantuan\n"
        )
        
        if self.is_owner(user_id):
            help_text += (
                "\n<b>🔐 Perintah Owner:</b>\n"
                "/adduser &lt;id&gt; - Tambah user (permanen)\n"
                "/addakses &lt;id&gt; &lt;hari&gt; - Tambah user dengan durasi\n"
                "/removeuser &lt;id&gt; - Hapus approved user\n"
                "/listusers - Lihat daftar approved users\n"
                "/kodeunik &lt;hari&gt; - Buat kode redeem\n"
                "/listkode - Lihat semua kode redeem\n"
                "/broadcast &lt;pesan&gt; - Kirim pesan ke semua users\n"
            )
        
        await update.message.reply_text(help_text, parse_mode=ParseMode.HTML)
    
    def start_polling(self):
        """Memulai polling untuk memeriksa email baru secara berkala"""
        logger.info(f"Bot dimulai, memeriksa email setiap {self.check_interval} detik")
        logger.info(f"Owner ID: {self.owner_id}")
        logger.info(f"Approved users: {len(self.approved_users)}")
        
        # Buat application untuk menangani commands
        app = Application.builder().token(self.bot_token).build()
        
        # Tambahkan command handlers
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("myid", self.cmd_myid))
        app.add_handler(CommandHandler("adduser", self.cmd_adduser))
        app.add_handler(CommandHandler("addakses", self.cmd_addakses))
        app.add_handler(CommandHandler("removeuser", self.cmd_removeuser))
        app.add_handler(CommandHandler("listusers", self.cmd_listusers))
        app.add_handler(CommandHandler("status", self.cmd_status))
        app.add_handler(CommandHandler("broadcast", self.cmd_broadcast))
        app.add_handler(CommandHandler("kodeunik", self.cmd_kodeunik))
        app.add_handler(CommandHandler("listkode", self.cmd_listkode))
        app.add_handler(CommandHandler("redeem", self.cmd_redeem))
        app.add_handler(CommandHandler("help", self.cmd_help))
        
        # Jadwalkan pemeriksaan email berkala menggunakan job queue
        async def check_emails_job(context: ContextTypes.DEFAULT_TYPE):
            await self.process_new_emails()
        
        # Jalankan bot dengan polling
        import asyncio
        
        async def main():
            async with app:
                await app.start()
                await app.updater.start_polling()
                
                # Jalankan pemeriksaan email pertama kali
                await self.process_new_emails()
                
                # Cek expiry pertama kali
                await self.check_and_notify_expiring_users()
                
                # Loop untuk pemeriksaan email dan expiry berkala
                while True:
                    await asyncio.sleep(self.check_interval)
                    await self.process_new_emails()
                    await self.check_and_notify_expiring_users()
        
        asyncio.run(main())

# Untuk menjalankan bot
if __name__ == "__main__":
    bot = EmailForwarderBot()
    bot.start_polling()
