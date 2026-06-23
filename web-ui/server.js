const express = require('express');
const session = require('express-session');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Admin credentials (change these!)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const OCPASSWD_FILE = '/etc/ocserv/ocpasswd';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vpn-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 3600000 }
}));

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth routes ────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// ── VPN User routes ────────────────────────────────────────────────────────────

// List all VPN users
app.get('/api/users', requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(OCPASSWD_FILE)) {
      return res.json({ users: [] });
    }
    const content = fs.readFileSync(OCPASSWD_FILE, 'utf8');
    const users = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(':');
        return { username: parts[0], group: parts[1] || 'default' };
      });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read users: ' + err.message });
  }
});

// Add a VPN user
app.post('/api/users', requireAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, _ and -' });
  }
  try {
    // Use ocpasswd to add user (pipe password twice for confirmation)
    execSync(`echo -e "${password}\n${password}" | ocpasswd -c ${OCPASSWD_FILE} ${username}`);
    res.json({ success: true, message: `User ${username} created` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

// Delete a VPN user
app.delete('/api/users/:username', requireAuth, (req, res) => {
  const { username } = req.params;
  try {
    execSync(`ocpasswd -c ${OCPASSWD_FILE} -d ${username}`);
    res.json({ success: true, message: `User ${username} deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

// ── VPN Status routes ──────────────────────────────────────────────────────────

// Get server status and active connections
app.get('/api/status', requireAuth, (req, res) => {
  try {
    // Try to get occtl status
    let connections = [];
    let serverRunning = false;

    try {
      const output = execSync('occtl -j show users 2>/dev/null || echo "[]"').toString();
      connections = JSON.parse(output) || [];
      serverRunning = true;
    } catch {
      // ocserv might not be running yet or occtl unavailable
      serverRunning = fs.existsSync('/var/run/ocserv.pid');
    }

    // Count users
    let totalUsers = 0;
    if (fs.existsSync(OCPASSWD_FILE)) {
      const content = fs.readFileSync(OCPASSWD_FILE, 'utf8');
      totalUsers = content.split('\n').filter(l => l.trim()).length;
    }

    res.json({
      server: {
        running: serverRunning,
        uptime: getUptime(),
        version: getOcservVersion()
      },
      stats: {
        activeConnections: Array.isArray(connections) ? connections.length : 0,
        totalUsers
      },
      connections: Array.isArray(connections) ? connections : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function getUptime() {
  try {
    const uptime = fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0];
    const seconds = parseFloat(uptime);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  } catch { return 'N/A'; }
}

function getOcservVersion() {
  try {
    return execSync('ocserv --version 2>&1 | head -1').toString().trim();
  } catch { return 'ocserv'; }
}

// ── Serve SPA for all other routes ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VPN Admin UI running on http://localhost:${PORT}`);
});
