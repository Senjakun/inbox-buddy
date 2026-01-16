/**
 * Self-hosted Web Server for Bot Configuration
 * 
 * Run: node server.js
 * Access: http://YOUR_IP:3000/owner
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const Imap = require('imap');

const app = express();
const PORT = process.env.PORT || 3000;

// Settings file path
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  telegram_bot_token: '',
  telegram_owner_id: '',
  outlook_email: '',
  outlook_password: '',
  imap_host: 'imap-mail.outlook.com',
  polling_interval_minutes: 1,
  email_filter: 'OTP',
  is_active: false,
  owner_secret: 'GANTI_SECRET_INI' // User MUST change this!
};

// Ensure settings file exists
function ensureSettingsFile() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    console.log('📄 Created settings.json - EDIT owner_secret before using!');
  }
}

// Load settings
function loadSettings() {
  ensureSettingsFile();
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

// Save settings
function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get settings (requires auth)
app.post('/api/get-settings', (req, res) => {
  const { owner_secret } = req.body;
  const settings = loadSettings();
  
  if (!owner_secret || owner_secret !== settings.owner_secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Mask sensitive data
  res.json({
    settings: {
      ...settings,
      telegram_bot_token: settings.telegram_bot_token ? '***' + settings.telegram_bot_token.slice(-6) : '',
      outlook_password: settings.outlook_password ? '********' : '',
      owner_secret: undefined
    }
  });
});

// API: Update settings (requires auth)
app.post('/api/update-settings', (req, res) => {
  const { owner_secret, ...updates } = req.body;
  const settings = loadSettings();
  
  if (!owner_secret || owner_secret !== settings.owner_secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Update only provided fields
  const newSettings = { ...settings };
  
  if (updates.telegram_bot_token) newSettings.telegram_bot_token = updates.telegram_bot_token;
  if (updates.telegram_owner_id !== undefined) newSettings.telegram_owner_id = updates.telegram_owner_id;
  if (updates.outlook_email !== undefined) newSettings.outlook_email = updates.outlook_email;
  if (updates.outlook_password) newSettings.outlook_password = updates.outlook_password;
  if (updates.imap_host !== undefined) newSettings.imap_host = updates.imap_host;
  if (updates.polling_interval_minutes !== undefined) newSettings.polling_interval_minutes = updates.polling_interval_minutes;
  if (updates.email_filter !== undefined) newSettings.email_filter = updates.email_filter;
  if (updates.is_active !== undefined) newSettings.is_active = updates.is_active;
  
  saveSettings(newSettings);
  res.json({ success: true });
});

// API: Get settings for bot (internal use)
app.get('/api/bot-settings', (req, res) => {
  const settings = loadSettings();
  res.json({ settings });
});

function testImapLogin({ host, user, password, port = 993 }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user,
      password,
      host,
      port,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000,
      keepalive: false,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: host,
      },
    });

    const done = (err) => {
      try {
        imap.end();
      } catch (_) {
        // ignore
      }
      if (err) reject(err);
      else resolve(true);
    };

    imap.once('ready', () => done());
    imap.once('error', (err) => done(err));

    try {
      imap.connect();
    } catch (err) {
      done(err);
    }
  });
}

// API: Test IMAP login (requires auth)
app.post('/api/test-imap', async (req, res) => {
  const { owner_secret, outlook_email, outlook_password, imap_host } = req.body || {};
  const settings = loadSettings();

  if (!owner_secret || owner_secret !== settings.owner_secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const host = String(imap_host || settings.imap_host || 'imap-mail.outlook.com').trim();
  const user = String(outlook_email || settings.outlook_email || '').trim();
  // App Password kadang ada spasi waktu di-copy; aman kita hapus semua whitespace
  const password = String(outlook_password || '').replace(/\s+/g, '').trim();

  if (!user) {
    return res.status(400).json({ error: 'Email kosong' });
  }

  // For security: require password to be provided explicitly for tests
  if (!password) {
    return res.status(400).json({ error: 'Masukkan App Password untuk test' });
  }

  const normalizeErr = (err) => ({
    message: err?.message || String(err),
    source: err?.source,
    type: err?.type,
  });

  const KNOWN_HOSTS = ['imap-mail.outlook.com', 'outlook.office365.com'];

  try {
    await testImapLogin({ host, user, password });
    return res.json({ success: true, host });
  } catch (err) {
    const first = normalizeErr(err);

    // Auto fallback: kalau host 1 gagal, coba host satunya.
    if (KNOWN_HOSTS.includes(host)) {
      const fallbackHost = KNOWN_HOSTS.find((h) => h !== host);
      try {
        await testImapLogin({ host: fallbackHost, user, password });
        return res.json({ success: true, host: fallbackHost, fallback_from: host });
      } catch (err2) {
        const second = normalizeErr(err2);
        return res.status(400).json({
          success: false,
          error: first.message,
          source: first.source,
          type: first.type,
          tried_hosts: [host, fallbackHost],
          fallback_error: second,
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: first.message,
      source: first.source,
      type: first.type,
    });
  }
});

// Serve owner page
app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

// Redirect root to owner
app.get('/', (req, res) => {
  res.redirect('/owner');
});

app.listen(PORT, '0.0.0.0', () => {
  ensureSettingsFile();
  console.log(`\n🌐 Web Server running at http://0.0.0.0:${PORT}`);
  console.log(`📝 Configure bot at: http://YOUR_IP:${PORT}/owner`);
  console.log(`\n⚠️  IMPORTANT: Edit settings.json and change owner_secret!`);
});
