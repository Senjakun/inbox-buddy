/**
 * Telegram Email Bot - VPS Version with IMAP IDLE (Real-time)
 * 
 * Fetches settings from Supabase database (same as /owner page)
 * 
 * Install: npm install imap mailparser node-telegram-bot-api @supabase/supabase-js
 * Run: node telegram-email-bot.js
 * With PM2: pm2 start telegram-email-bot.js --name email-bot
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - same as your Lovable project
const SUPABASE_URL = 'https://fqynkjlckhqcsahstasm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxeW5ramxja2hxY3NhaHN0YXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODIwNDYsImV4cCI6MjA4NDA1ODA0Nn0.28JTukSi9q10f1C-ewQiqv5c9afg1f36F_o5JKb4IeY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let config = null;
let bot = null;
let imap = null;

// Store sent messages for auto-delete
const sentMessages = new Map();

// Fetch settings from database
async function fetchSettings() {
  console.log('🔄 Fetching settings from database...');
  
  const { data, error } = await supabase
    .from('bot_settings')
    .select('*')
    .limit(1)
    .single();
  
  if (error) {
    console.error('❌ Error fetching settings:', error.message);
    return null;
  }
  
  if (!data) {
    console.error('❌ No settings found in database!');
    console.error('👉 Go to your app /owner page to configure settings first.');
    return null;
  }
  
  if (!data.is_active) {
    console.log('⏸️ Bot is disabled in settings. Enable it from /owner page.');
    return null;
  }
  
  return {
    telegram: {
      token: data.telegram_bot_token,
      ownerId: data.telegram_owner_id,
    },
    email: {
      user: data.outlook_email,
      password: data.outlook_password,
      host: 'imap-mail.outlook.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    },
    emailFilter: data.email_filter || '',
    autoDeleteAfterDays: 7,
  };
}

// Validate config
function validateConfig(cfg) {
  if (!cfg.telegram.token) {
    console.error('❌ Missing: Telegram Bot Token');
    return false;
  }
  if (!cfg.telegram.ownerId) {
    console.error('❌ Missing: Telegram Owner ID');
    return false;
  }
  if (!cfg.email.user) {
    console.error('❌ Missing: Outlook Email');
    return false;
  }
  if (!cfg.email.password) {
    console.error('❌ Missing: Outlook Password/App Password');
    return false;
  }
  return true;
}

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
        sentMessages.delete(messageId);
      }
    }
  }
}

// IMAP connection with IDLE
function startIMAP() {
  imap = new Imap(config.email);
  
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
    setTimeout(startIMAP, 5000);
  });
  
  imap.once('end', () => {
    console.log('⚠️ IMAP Connection ended, reconnecting...');
    setTimeout(startIMAP, 5000);
  });
  
  imap.connect();
}

// Telegram bot commands
function setupBotCommands() {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `👋 Bot Email aktif!\n\n📧 Email: ${config.email.user}\n🔍 Filter: ${config.emailFilter || 'Semua email'}\n🗑️ Auto-delete: ${config.autoDeleteAfterDays} hari\n\nCommands:\n/status - Cek status\n/myid - Lihat Chat ID\n/reload - Reload settings`);
  });

  bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, `✅ Bot aktif!\n📧 Monitoring: ${config.email.user}\n🔍 Filter: ${config.emailFilter || 'Semua'}\n📊 Pesan tersimpan: ${sentMessages.size}`);
  });

  bot.onText(/\/myid/, (msg) => {
    bot.sendMessage(msg.chat.id, `🆔 Chat ID kamu: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/reload/, async (msg) => {
    if (msg.chat.id.toString() !== config.telegram.ownerId) {
      return bot.sendMessage(msg.chat.id, '❌ Hanya owner yang bisa reload settings.');
    }
    
    bot.sendMessage(msg.chat.id, '🔄 Reloading settings...');
    
    const newConfig = await fetchSettings();
    if (newConfig && validateConfig(newConfig)) {
      // Restart IMAP if email changed
      if (config.email.user !== newConfig.email.user || config.email.password !== newConfig.email.password) {
        if (imap) {
          imap.end();
        }
        config = newConfig;
        startIMAP();
      } else {
        config = newConfig;
      }
      bot.sendMessage(msg.chat.id, '✅ Settings reloaded!');
    } else {
      bot.sendMessage(msg.chat.id, '❌ Failed to reload settings.');
    }
  });
}

// Main startup
async function main() {
  console.log('🚀 Starting Telegram Email Bot...');
  console.log('📡 Fetching settings from Lovable Cloud database...');
  
  config = await fetchSettings();
  
  if (!config) {
    console.error('\n❌ Cannot start bot!');
    console.error('👉 Configure settings at your Lovable app: /owner');
    console.error('👉 Make sure bot is enabled (is_active = true)');
    process.exit(1);
  }
  
  if (!validateConfig(config)) {
    console.error('\n❌ Invalid configuration!');
    console.error('👉 Check settings at your Lovable app: /owner');
    process.exit(1);
  }
  
  console.log(`\n✅ Settings loaded!`);
  console.log(`📧 Email: ${config.email.user}`);
  console.log(`🔍 Filter: ${config.emailFilter || 'All emails'}`);
  console.log(`👤 Owner ID: ${config.telegram.ownerId}`);
  
  // Initialize Telegram Bot
  bot = new TelegramBot(config.telegram.token, { polling: true });
  setupBotCommands();
  
  // Start IMAP
  startIMAP();
  
  // Cleanup old messages every hour
  setInterval(cleanupOldMessages, 60 * 60 * 1000);
  
  console.log('\n✅ Bot is running! Press Ctrl+C to stop.');
  console.log('💡 Use /reload command in Telegram to reload settings from database.');
}

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

main();
