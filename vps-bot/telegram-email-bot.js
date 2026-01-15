/**
 * Telegram Email Bot - VPS Version with IMAP IDLE (Real-time)
 * 
 * Install: npm install imap mailparser node-telegram-bot-api dotenv
 * Run: node telegram-email-bot.js
 * With PM2: pm2 start telegram-email-bot.js --name email-bot
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration from environment variables
const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    ownerId: process.env.TELEGRAM_OWNER_ID,
  },
  email: {
    user: process.env.OUTLOOK_EMAIL,
    password: process.env.OUTLOOK_PASSWORD, // App Password if 2FA enabled
    host: 'imap-mail.outlook.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  },
  emailFilter: process.env.EMAIL_FILTER || '', // Empty = all emails
  autoDeleteAfterDays: parseInt(process.env.AUTO_DELETE_DAYS) || 7,
};

// Validate config
if (!config.telegram.token || !config.telegram.ownerId || !config.email.user || !config.email.password) {
  console.error('❌ Missing required environment variables!');
  console.error('Required: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, OUTLOOK_EMAIL, OUTLOOK_PASSWORD');
  process.exit(1);
}

// Initialize Telegram Bot
const bot = new TelegramBot(config.telegram.token, { polling: true });

// Store sent messages for auto-delete
const sentMessages = new Map(); // messageId -> { chatId, sentAt }

// Escape MarkdownV2 special characters
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*[\\\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Send email to Telegram
async function sendToTelegram(email) {
  try {
    const message = `📧 *Email Baru*\n\n*Dari:* ${escapeMarkdown(email.from)}\n*Subjek:* ${escapeMarkdown(email.subject)}\n\n${escapeMarkdown(email.text?.substring(0, 500) || '')}`;
    
    const result = await bot.sendMessage(config.telegram.ownerId, message, {
      parse_mode: 'MarkdownV2'
    });
    
    // Store for auto-delete
    sentMessages.set(result.message_id, {
      chatId: config.telegram.ownerId,
      sentAt: new Date()
    });
    
    console.log(`✅ Email sent to Telegram: ${email.subject}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send to Telegram:', error.message);
    // Try without markdown if parsing fails
    try {
      const plainMessage = `📧 Email Baru\n\nDari: ${email.from}\nSubjek: ${email.subject}\n\n${email.text?.substring(0, 500) || ''}`;
      await bot.sendMessage(config.telegram.ownerId, plainMessage);
      console.log(`✅ Email sent to Telegram (plain): ${email.subject}`);
    } catch (e) {
      console.error('❌ Failed to send plain message:', e.message);
    }
    return false;
  }
}

// Process new email
async function processEmail(buffer) {
  try {
    const parsed = await simpleParser(buffer);
    
    const email = {
      from: parsed.from?.text || 'Unknown',
      subject: parsed.subject || 'No Subject',
      text: parsed.text || '',
      messageId: parsed.messageId || `msg-${Date.now()}`
    };
    
    // Check filter
    if (config.emailFilter && !email.subject.toLowerCase().includes(config.emailFilter.toLowerCase())) {
      console.log(`⏭️ Skipped (filter): ${email.subject}`);
      return;
    }
    
    await sendToTelegram(email);
  } catch (error) {
    console.error('❌ Error processing email:', error.message);
  }
}

// Auto-delete old messages
async function cleanupOldMessages() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.autoDeleteAfterDays * 24 * 60 * 60 * 1000);
  
  for (const [messageId, data] of sentMessages.entries()) {
    if (data.sentAt < cutoff) {
      try {
        await bot.deleteMessage(data.chatId, messageId);
        sentMessages.delete(messageId);
        console.log(`🗑️ Deleted old message: ${messageId}`);
      } catch (error) {
        // Message might already be deleted
        sentMessages.delete(messageId);
      }
    }
  }
}

// IMAP connection with IDLE
function startIMAP() {
  const imap = new Imap(config.email);
  
  imap.once('ready', () => {
    console.log('📬 IMAP Connected!');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Error opening INBOX:', err);
        return;
      }
      
      console.log(`📥 INBOX opened: ${box.messages.total} messages`);
      console.log('👀 Listening for new emails (IDLE mode)...');
      
      // Listen for new emails
      imap.on('mail', (numNewMsgs) => {
        console.log(`📨 ${numNewMsgs} new email(s)!`);
        
        // Fetch the newest emails
        const fetch = imap.seq.fetch(`${box.messages.total - numNewMsgs + 1}:*`, {
          bodies: '',
          markSeen: true
        });
        
        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', () => {
              processEmail(buffer);
            });
          });
        });
        
        fetch.once('error', (err) => {
          console.error('❌ Fetch error:', err);
        });
      });
    });
  });
  
  imap.once('error', (err) => {
    console.error('❌ IMAP Error:', err);
    // Reconnect after 5 seconds
    setTimeout(startIMAP, 5000);
  });
  
  imap.once('end', () => {
    console.log('⚠️ IMAP Connection ended, reconnecting...');
    setTimeout(startIMAP, 5000);
  });
  
  imap.connect();
  
  return imap;
}

// Telegram bot commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `👋 Bot Email aktif!\n\n📧 Email: ${config.email.user}\n🔍 Filter: ${config.emailFilter || 'Semua email'}\n🗑️ Auto-delete: ${config.autoDeleteAfterDays} hari\n\nCommands:\n/status - Cek status\n/myid - Lihat Chat ID`);
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, `✅ Bot aktif!\n📧 Monitoring: ${config.email.user}\n🔍 Filter: ${config.emailFilter || 'Semua'}\n📊 Pesan tersimpan: ${sentMessages.size}`);
});

bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Chat ID kamu: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
});

// Start
console.log('🚀 Starting Telegram Email Bot...');
console.log(`📧 Email: ${config.email.user}`);
console.log(`🔍 Filter: ${config.emailFilter || 'All emails'}`);
console.log(`👤 Owner ID: ${config.telegram.ownerId}`);

startIMAP();

// Cleanup old messages every hour
setInterval(cleanupOldMessages, 60 * 60 * 1000);

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

console.log('✅ Bot is running! Press Ctrl+C to stop.');
