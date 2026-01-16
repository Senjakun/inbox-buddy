/**
 * Telegram Email Bot - Standalone Version
 * 
 * Reads settings from local settings.json (created by server.js)
 * No external database required!
 * 
 * Run: node telegram-bot-standalone.js
 * With PM2: pm2 start telegram-bot-standalone.js --name email-bot
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');

let config = null;
let bot = null;
let imap = null;

// Store sent messages for auto-delete
const sentMessages = new Map();

// Load settings from local file
function loadSettings() {
  console.log('🔄 Loading settings from settings.json...');
  
  if (!fs.existsSync(SETTINGS_FILE)) {
    console.error('❌ settings.json not found!');
    console.error('👉 Run server.js first and configure via http://YOUR_IP:3000/owner');
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    
    if (!data.is_active) {
      console.log('⏸️ Bot is disabled. Enable it from /owner page.');
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
        // Default for personal outlook.com accounts
        // (Some environments work better with outlook.office365.com)
        host: (data.imap_host || 'imap-mail.outlook.com').trim(),
        port: 993,
        tls: true,
        // Outlook IMAP can be slow; increase timeouts to avoid timeout-auth
        connTimeout: 30000,
        authTimeout: 30000,
        keepalive: true,
        tlsOptions: {
          rejectUnauthorized: false,
          servername: (data.imap_host || 'imap-mail.outlook.com').trim(),
        },
      },
      emailFilter: data.email_filter || '',
      autoDeleteAfterDays: 7,
    };
  } catch (error) {
    console.error('❌ Error reading settings.json:', error.message);
    return null;
  }
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
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

// Send email to Telegram
async function sendToTelegram(email) {
  try {
    const message = `📧 *Email Baru*\n\n*Dari:* ${escapeMarkdown(email.from)}\n*Subjek:* ${escapeMarkdown(email.subject)}\n\n${escapeMarkdown(email.text?.substring(0, 500) || '')}`;
    
    const result = await bot.sendMessage(config.telegram.ownerId, message, {
      parse_mode: 'MarkdownV2'
    });
    
    sentMessages.set(result.message_id, {
      chatId: config.telegram.ownerId,
      sentAt: new Date()
    });
    
    console.log(`✅ Email sent to Telegram: ${email.subject}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send to Telegram:', error.message);
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
    
    // Check filter - empty/whitespace filter = forward all emails
    const filter = (config.emailFilter || '').trim();
    if (filter) {
      const subjectLower = email.subject.toLowerCase().trim();
      const filterLower = filter.toLowerCase();
      if (!subjectLower.includes(filterLower)) {
        console.log(`⏭️ Skipped (filter "${filter}"): ${email.subject}`);
        return;
      }
    }
    
    console.log(`📧 Processing email: ${email.subject}`);
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
  console.log(`📡 Connecting IMAP: ${config.email.host}:${config.email.port} ...`);
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
      
      imap.on('mail', (numNewMsgs) => {
        console.log(`📨 ${numNewMsgs} new email(s)!`);
        
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
    const msg = err?.message || String(err);
    console.error('❌ IMAP Error:', err);

    // Most common: Outlook auth timeout (app password/IMAP access/basic auth)
    if (err?.source === 'timeout-auth' || msg.toLowerCase().includes('timed out while authenticating')) {
      console.error('👉 IMAP auth timeout. Cek: App Password benar (tanpa spasi), IMAP diaktifkan di Outlook, dan port 993 tidak diblokir dari VPS.');
      console.error("👉 Kalau masih timeout, coba set IMAP Host ke 'outlook.office365.com' via /owner (opsional).");
    }

    // Explicit login failure
    if (err?.source === 'authentication' || msg.toLowerCase().includes('login failed')) {
      console.error('👉 LOGIN failed biasanya karena:');
      console.error('   1) App Password salah / kepaste ada spasi');
      console.error('   2) Email yang dipakai bukan PRIMARY ALIAS (lihat Outlook: Settings → Email aliases)');
      console.error("   3) Coba ganti IMAP Host ke 'outlook.office365.com' (kadang lebih cocok dari VPS)");
    }

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
    bot.sendMessage(msg.chat.id, `👋 Bot Email aktif!\n\n📧 Email: ${config.email.user}\n🔍 Filter: ${config.emailFilter || 'Semua email'}\n🗑️ Auto-delete: ${config.autoDeleteAfterDays} hari\n\nCommands:\n/status - Cek status\n/myid - Lihat Chat ID\n/reload - Reload settings\n/update - Update bot dari GitHub`);
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
    
    const newConfig = loadSettings();
    if (newConfig && validateConfig(newConfig)) {
      if (config.email.user !== newConfig.email.user || config.email.password !== newConfig.email.password) {
        if (imap) {
          imap.end();
        }
        config = newConfig;
        startIMAP();
      } else {
        config = newConfig;
      }
      bot.sendMessage(msg.chat.id, '✅ Settings reloaded from settings.json!');
    } else {
      bot.sendMessage(msg.chat.id, '❌ Failed to reload settings.');
    }
  });

  bot.onText(/\/update/, async (msg) => {
    if (msg.chat.id.toString() !== config.telegram.ownerId) {
      return bot.sendMessage(msg.chat.id, '❌ Hanya owner yang bisa update bot.');
    }
    
    bot.sendMessage(msg.chat.id, '🔄 Updating bot dari GitHub...');
    
    const projectDir = path.join(__dirname, '..');
    
    exec(`cd ${projectDir} && git pull origin main`, (error, stdout, stderr) => {
      if (error) {
        bot.sendMessage(msg.chat.id, `❌ Git pull gagal:\n\`\`\`\n${error.message}\n\`\`\``, { parse_mode: 'Markdown' });
        return;
      }
      
      const gitOutput = stdout.trim() || 'No changes';
      bot.sendMessage(msg.chat.id, `✅ Git pull berhasil:\n\`\`\`\n${gitOutput}\n\`\`\`\n\n🔄 Restarting bot...`, { parse_mode: 'Markdown' });
      
      // Restart bot via PM2
      exec('pm2 restart email-bot', (err2, stdout2, stderr2) => {
        if (err2) {
          bot.sendMessage(msg.chat.id, `⚠️ Bot updated tapi restart gagal. Manual restart: pm2 restart email-bot`);
        }
        // Bot will restart, so this message might not be sent
      });
    });
  });
}

// Main startup
async function main() {
  console.log('🚀 Starting Telegram Email Bot (Standalone)...');
  
  config = loadSettings();
  
  if (!config) {
    console.error('\n❌ Cannot start bot!');
    console.error('👉 Configure settings at: http://YOUR_IP:3000/owner');
    console.error('👉 Make sure bot is enabled (is_active = true)');
    process.exit(1);
  }
  
  if (!validateConfig(config)) {
    console.error('\n❌ Invalid configuration!');
    console.error('👉 Check settings at: http://YOUR_IP:3000/owner');
    process.exit(1);
  }
  
  console.log(`\n✅ Settings loaded!`);
  console.log(`📧 Email: ${config.email.user}`);
  console.log(`🌐 IMAP Host: ${config.email.host}:${config.email.port}`);
  console.log(`🔍 Filter: ${config.emailFilter || 'All emails'}`);
  console.log(`👤 Owner ID: ${config.telegram.ownerId}`);
  
  bot = new TelegramBot(config.telegram.token, { polling: true });
  setupBotCommands();
  
  startIMAP();
  
  setInterval(cleanupOldMessages, 60 * 60 * 1000);
  
  console.log('\n✅ Bot is running! Press Ctrl+C to stop.');
  console.log('💡 Use /reload command in Telegram to reload settings.');
}

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

main();
