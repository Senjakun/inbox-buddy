import imaplib
import email
import os
import json
from email.header import decode_header
from dotenv import load_dotenv
import logging
import datetime
from bs4 import BeautifulSoup
from lxml import etree
import re

# Konfigurasi logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# File untuk menyimpan settings
SETTINGS_FILE = 'bot_settings.json'

def load_settings():
    """Memuat settings dari file JSON"""
    default_settings = {
        "email_host": "imap.gmail.com",
        "email_port": 993,
        "email_username": "",
        "email_password": "",
        "email_folder": "INBOX",
        "filter_sender": "support@info.airwallex.com",
        "filter_subject": "Your one-time passcode is",
        "check_interval": 2
    }
    
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                saved = json.load(f)
                # Merge dengan default untuk field yang mungkin belum ada
                default_settings.update(saved)
        else:
            # Buat file settings baru
            save_settings(default_settings)
    except Exception as e:
        logger.error(f"Error loading settings: {str(e)}")
    
    return default_settings

def save_settings(settings):
    """Menyimpan settings ke file JSON"""
    try:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
        logger.info("Settings saved successfully")
        return True
    except Exception as e:
        logger.error(f"Error saving settings: {str(e)}")
        return False

class EmailReader:
    def __init__(self):
        # Memuat settings dari file JSON
        self.settings = load_settings()
        self.reload_settings()
        
        # Menyimpan ID email yang sudah diproses
        self.processed_emails = set()
    
    def reload_settings(self):
        """Reload settings dari file"""
        self.settings = load_settings()
        
        self.host = self.settings.get('email_host', 'imap.gmail.com')
        self.port = int(self.settings.get('email_port', 993))
        self.username = self.settings.get('email_username', '')
        self.password = self.settings.get('email_password', '')
        self.folder = self.settings.get('email_folder', 'INBOX')
        
        # Filter email dari settings
        self.filter_sender = self.settings.get('filter_sender', 'support@info.airwallex.com')
        self.filter_subject = self.settings.get('filter_subject', 'Your one-time passcode is')
        
        logger.info(f"Settings reloaded - Host: {self.host}, Username: {self.username}")
    
    def is_configured(self):
        """Memeriksa apakah email sudah dikonfigurasi"""
        return bool(self.username and self.password and self.host)
        
    def connect(self):
        """Menghubungkan ke server email"""
        if not self.is_configured():
            logger.warning("Email belum dikonfigurasi. Gunakan /set email di Telegram.")
            return False
            
        try:
            self.mail = imaplib.IMAP4_SSL(self.host, self.port)
            self.mail.login(self.username, self.password)
            self.mail.select(self.folder)
            logger.info(f"Berhasil terhubung ke {self.host}")
            return True
        except Exception as e:
            logger.error(f"Gagal terhubung ke server email: {str(e)}")
            return False
    
    def disconnect(self):
        """Memutuskan koneksi dari server email"""
        try:
            self.mail.close()
            self.mail.logout()
            logger.info("Koneksi email terputus")
        except Exception as e:
            logger.error(f"Gagal memutuskan koneksi: {str(e)}")
    
    def get_clean_text(self, part):
        """Mengekstrak teks dari bagian email"""
        try:
            body = part.get_payload(decode=True).decode()
        except:
            try:
                body = part.get_payload(decode=True).decode('latin-1')
            except:
                body = "Tidak dapat mendekode konten email"
        return body
    
    def extract_content_by_css(self, html_content, css_selector=None):
        """Mengekstrak konten dari HTML menggunakan CSS selector atau mencari OTP langsung"""
        try:
            # Parse HTML dengan BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Simpan isi email lengkap
            full_text = soup.get_text(separator='\n', strip=True)
            
            # Cari kode OTP di seluruh dokumen
            otp_match = re.search(r'\b\d{6}\b', full_text)
            
            result = {
                "full_content": full_text,
                "otp_found": False,
                "otp_code": None,
                "otp_context": None
            }
            
            if otp_match:
                otp_code = otp_match.group(0)
                result["otp_found"] = True
                result["otp_code"] = otp_code
                
                # Coba dapatkan konteks sekitar OTP (100 karakter sebelum dan sesudah)
                otp_pos = full_text.find(otp_code)
                start_pos = max(0, otp_pos - 100)
                end_pos = min(len(full_text), otp_pos + len(otp_code) + 100)
                otp_context = full_text[start_pos:end_pos]
                result["otp_context"] = otp_context
                
                # Coba cari tabel atau div yang berisi OTP untuk konteks yang lebih baik
                try:
                    # Coba cari tabel yang mungkin berisi OTP
                    tables = soup.find_all('table')
                    for table in tables:
                        table_text = table.get_text(separator='\n', strip=True)
                        if otp_code in table_text:
                            result["otp_context"] = table_text
                            break
                    
                    # Jika tidak ada tabel, cari div dengan konten yang relevan
                    if result["otp_context"] == otp_context:  # Jika masih menggunakan konteks default
                        divs = soup.find_all('div')
                        for div in divs:
                            div_text = div.get_text(separator='\n', strip=True)
                            if otp_code in div_text and len(div_text) < 500:  # Hindari div yang terlalu besar
                                result["otp_context"] = div_text
                                break
                except Exception as inner_e:
                    logger.error(f"Error saat mencari konteks OTP: {str(inner_e)}")
            
            return result
        except Exception as e:
            logger.error(f"Error saat mengekstrak konten: {str(e)}")
            return {
                "full_content": f"Error saat mengekstrak konten: {str(e)}",
                "otp_found": False,
                "otp_code": None,
                "otp_context": None
            }
    
    def process_email_part(self, part):
        """Memproses bagian email dan mengekstrak teks atau lampiran"""
        content_type = part.get_content_type()
        content_disposition = str(part.get("Content-Disposition"))
        
        if "attachment" in content_disposition:
            # Ini adalah lampiran
            filename = part.get_filename()
            if filename:
                # Decode filename jika perlu
                if decode_header(filename)[0][1] is not None:
                    filename = decode_header(filename)[0][0].decode(decode_header(filename)[0][1])
                return {
                    "type": "attachment",
                    "filename": filename,
                    "data": part.get_payload(decode=True)
                }
        elif content_type == "text/plain":
            # Ini adalah teks biasa
            return {
                "type": "text",
                "content": self.get_clean_text(part)
            }
        elif content_type == "text/html":
            # Ini adalah HTML
            return {
                "type": "html",
                "content": self.get_clean_text(part)
            }
        return None
    
    def should_process_email(self, from_email, subject):
        """Memeriksa apakah email harus diproses berdasarkan filter"""
        # Jika filter kosong, proses semua email
        if not self.filter_sender and not self.filter_subject:
            return True
        
        # Periksa apakah pengirim dan subjek sesuai dengan filter
        sender_match = not self.filter_sender or self.filter_sender.lower() in from_email.lower()
        subject_match = not self.filter_subject or self.filter_subject.lower() in subject.lower()
        
        return sender_match and subject_match
    
    def get_new_emails(self):
        """Mengambil email baru yang belum diproses"""
        # Reload settings sebelum cek email
        self.reload_settings()
        
        if not self.connect():
            return []
        
        try:
            # Cari email yang belum dibaca
            status, messages = self.mail.search(None, 'UNSEEN')
            
            if status != 'OK':
                logger.error("Gagal mencari email baru")
                self.disconnect()
                return []
            
            email_ids = messages[0].split()
            new_emails = []
            
            for e_id in email_ids:
                # Konversi ID email ke string untuk perbandingan
                email_id_str = e_id.decode()
                
                # Lewati email yang sudah diproses
                if email_id_str in self.processed_emails:
                    continue
                
                # Tandai email sebagai sudah diproses
                self.processed_emails.add(email_id_str)
                
                # Ambil email
                status, msg_data = self.mail.fetch(e_id, '(RFC822)')
                
                if status != 'OK':
                    logger.error(f"Gagal mengambil email dengan ID {email_id_str}")
                    continue
                
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                # Ekstrak informasi email
                subject = decode_header(msg["Subject"])[0][0]
                if isinstance(subject, bytes):
                    try:
                        subject = subject.decode()
                    except:
                        subject = subject.decode('latin-1')
                
                from_ = msg.get("From")
                date_str = msg.get("Date")
                try:
                    date = email.utils.parsedate_to_datetime(date_str)
                except:
                    date = datetime.datetime.now()
                
                # Proses konten email
                body_text = ""
                body_html = ""
                extracted_content = ""
                attachments = []
                
                if msg.is_multipart():
                    for part in msg.walk():
                        result = self.process_email_part(part)
                        if result:
                            if result["type"] == "text":
                                body_text = result["content"]
                            elif result["type"] == "html":
                                body_html = result["content"]
                                # Ekstrak konten dari HTML
                                if body_html:
                                    extracted_content = self.extract_content_by_css(body_html)
                            elif result["type"] == "attachment":
                                attachments.append({
                                    "filename": result["filename"],
                                    "data": result["data"]
                                })
                else:
                    content_type = msg.get_content_type()
                    if content_type == "text/plain":
                        body_text = self.get_clean_text(msg)
                    elif content_type == "text/html":
                        body_html = self.get_clean_text(msg)
                        # Ekstrak konten dari HTML
                        if body_html:
                            extracted_content = self.extract_content_by_css(body_html)
                
                # Periksa apakah email sesuai dengan filter
                if self.should_process_email(from_, subject):
                    # Buat objek email
                    email_obj = {
                        "id": email_id_str,
                        "subject": subject,
                        "from": from_,
                        "date": date,
                        "body_text": body_text,
                        "body_html": body_html,
                        "extracted_content": extracted_content,
                        "attachments": attachments
                    }
                    
                    # Jika extracted_content adalah dictionary (hasil dari extract_content_by_css)
                    if isinstance(extracted_content, dict):
                        email_obj["full_content"] = extracted_content.get("full_content", "")
                        email_obj["otp_found"] = extracted_content.get("otp_found", False)
                        email_obj["otp_code"] = extracted_content.get("otp_code", None)
                        email_obj["otp_context"] = extracted_content.get("otp_context", None)
                        # Simpan extracted_content sebagai string untuk kompatibilitas
                        if extracted_content.get("otp_found", False):
                            email_obj["extracted_content"] = f"OTP Code: {extracted_content.get('otp_code')}\n\n{extracted_content.get('otp_context', '')}"
                        else:
                            email_obj["extracted_content"] = "Tidak dapat menemukan kode OTP dalam email."
                    
                    logger.info(f"Email dari {from_} dengan subjek '{subject}' sesuai dengan filter")
                    new_emails.append(email_obj)
                else:
                    logger.info(f"Email dari {from_} dengan subjek '{subject}' tidak sesuai dengan filter, diabaikan")
            
            self.disconnect()
            return new_emails
            
        except Exception as e:
            logger.error(f"Error saat memproses email: {str(e)}")
            self.disconnect()
            return []

# Untuk pengujian
if __name__ == "__main__":
    reader = EmailReader()
    emails = reader.get_new_emails()
    for email in emails:
        print(f"Subject: {email['subject']}")
        print(f"From: {email['from']}")
        print(f"Date: {email['date']}")
        print(f"Body: {email['body_text'][:100]}...")
        print("=" * 50)
