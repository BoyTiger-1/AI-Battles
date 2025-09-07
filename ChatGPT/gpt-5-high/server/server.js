// server.js - Express app, routes, uploads, security, admin, and APIs.
// Focus on clean, maintainable structure, accessibility, and required features.

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { db, run, get, all, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and parsing
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "img-src": ["'self'", "data:"],
      "script-src": ["'self'"],
      "connect-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"], // allow inline for demo
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessions (MemoryStore for demo; for production, use a store)
app.use(session({
  name: 'lf.sid',
  secret: process.env.SESSION_SECRET || 'demo-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// Rate limit for abuse prevention on POST endpoints
const postLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(['/api/items', '/api/auth/login', '/api/items/*/claim'], postLimiter);

// Static files
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: true }));
app.use(express.static(PUBLIC_DIR));

// Multer upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${uuidv4()}${ext.toLowerCase()}`);
  }
});
const fileFilter = (req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('Only JPEG/PNG/WEBP images allowed'), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Helpers
function isAdmin(req) {
  return req.session && req.session.user && req.session.user.role === 'admin';
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function sanitizeString(s, max = 500) {
  if (!s) return '';
  return String(s).slice(0, max).trim();
}

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Items: list/search
app.get('/api/items', async (req, res) => {
  try {
    const {
      q = '', category = '', location = '',
      status = 'approved', date_from = '', date_to = '',
      sort = 'newest', page = 1, limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const perPage = Math.max(1, Math.min(50, parseInt(limit)));

    const where = [];
    const params = [];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (q) {
      where.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (location) {
      where.push('location_found LIKE ?');
      params.push(`%${location}%`);
    }
    if (date_from) {
      where.push('date_found >= ?');
      params.push(date_from);
    }
    if (date_to) {
      where.push('date_found <= ?');
      params.push(date_to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = sort === 'oldest' ? 'ORDER BY created_at ASC' : 'ORDER BY created_at DESC';

    const totalRow = await get(`SELECT COUNT(*) as count FROM items ${whereSql}`, params);
    const total = totalRow?.count || 0;

    const offset = (pageNum - 1) * perPage;
    const rows = await all(
      `SELECT id, title, description, category, location_found, date_found, photo_filename, status, created_at
       FROM items ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({
      page: pageNum, limit: perPage, total, items: rows
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Item details (approved only unless admin)
app.get('/api/items/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await get(`SELECT * FROM items WHERE id = ?`, [id]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (item.status !== 'approved' && !isAdmin(req)) {
      return res.status(403).json({ error: 'Item not accessible' });
    }
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Report a found item (public) - multipart
app.post('/api/items', upload.single('photo'), async (req, res) => {
  try {
    const body = req.body;

    const title = sanitizeString(body.title, 120);
    const description = sanitizeString(body.description, 2000);
    const category = sanitizeString(body.category, 60);
    const location_found = sanitizeString(body.location_found, 120);
    const date_found = sanitizeString(body.date_found, 10);
    const reporter_name = sanitizeString(body.reporter_name, 80);
    const reporter_email = sanitizeString(body.reporter_email, 120);

    if (!title || !description || !category || !location_found || !date_found || !reporter_name || !reporter_email) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const photo_filename = req.file ? path.basename(req.file.filename) : null;

    const result = await run(
      `INSERT INTO items (title, description, category, location_found, date_found, photo_filename, status, reporter_name, reporter_email)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [title, description, category, location_found, date_found, photo_filename, reporter_name, reporter_email]
    );

    res.status(201).json({ id: result.lastID, status: 'pending', message: 'Submitted for review' });
  } catch (e) {
    console.error(e);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Failed to submit item' });
  }
});

// Claim/inquiry on item (public) - multipart optional proof
app.post('/api/items/:id/claim', upload.single('proof'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await get(`SELECT id, status FROM items WHERE id = ?`, [id]);
    if (!item || item.status === 'archived') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Item not found' });
    }

    const body = req.body;
    const claimant_name = sanitizeString(body.claimant_name, 80);
    const claimant_email = sanitizeString(body.claimant_email, 120);
    const student_id = sanitizeString(body.student_id, 40);
    const message = sanitizeString(body.message, 1500);
    const proof_filename = req.file ? path.basename(req.file.filename) : null;

    if (!claimant_name || !claimant_email || !message) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const result = await run(
      `INSERT INTO claims (item_id, claimant_name, claimant_email, student_id, message, proof_filename, status)
       VALUES (?, ?, ?, ?, ?, ?, 'new')`,
      [id, claimant_name, claimant_email, student_id, message, proof_filename]
    );

    res.status(201).json({ id: result.lastID, status: 'new', message: 'Claim submitted' });
  } catch (e) {
    console.error(e);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username = '', password = '' } = req.body;
    const user = await get(`SELECT * FROM users WHERE username = ?`, [username.trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ message: 'Logged in', user: { username: user.username, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

// Admin: Items
app.get('/api/admin/items', requireAdmin, async (req, res) => {
  try {
    const { status = '', q = '' } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (q) { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const items = await all(
      `SELECT id, title, category, location_found, date_found, status, created_at
       FROM items ${whereSql} ORDER BY created_at DESC LIMIT 200`, params
    );
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load items' });
  }
});

app.patch('/api/admin/items/:id', requireAdmin, express.json(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action } = req.body;

    const item = await get(`SELECT * FROM items WHERE id = ?`, [id]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (action === 'approve') {
      await run(`UPDATE items SET status = 'approved' WHERE id = ?`, [id]);
    } else if (action === 'archive') {
      await run(`UPDATE items SET status = 'archived' WHERE id = ?`, [id]);
    } else if (action === 'mark_claimed') {
      await run(`UPDATE items SET status = 'claimed' WHERE id = ?`, [id]);
    } else if (action === 'edit') {
      const { title, description, category, location_found, date_found } = req.body;
      await run(
        `UPDATE items SET title = ?, description = ?, category = ?, location_found = ?, date_found = ? WHERE id = ?`,
        [
          sanitizeString(title, 120),
          sanitizeString(description, 2000),
          sanitizeString(category, 60),
          sanitizeString(location_found, 120),
          sanitizeString(date_found, 10),
          id
        ]
      );
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const updated = await get(`SELECT * FROM items WHERE id = ?`, [id]);
    res.json({ item: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Admin update failed' });
  }
});

app.delete('/api/admin/items/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Clean up photo + claim proofs
    const item = await get(`SELECT photo_filename FROM items WHERE id = ?`, [id]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const claims = await all(`SELECT proof_filename FROM claims WHERE item_id = ?`, [id]);
    for (const c of claims) {
      if (c.proof_filename) {
        fs.unlink(path.join(UPLOAD_DIR, c.proof_filename), () => {});
      }
    }
    if (item.photo_filename) {
      fs.unlink(path.join(UPLOAD_DIR, item.photo_filename), () => {});
    }

    await run(`DELETE FROM items WHERE id = ?`, [id]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Admin: Claims
app.get('/api/admin/claims', requireAdmin, async (req, res) => {
  try {
    const { status = '' } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('c.status = ?'); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await all(
      `SELECT c.id, c.item_id, c.claimant_name, c.claimant_email, c.student_id, c.status, c.created_at,
              i.title as item_title, i.status as item_status
       FROM claims c
       JOIN items i ON i.id = c.item_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT 200`, params
    );
    res.json({ claims: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load claims' });
  }
});

app.patch('/api/admin/claims/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const valid = ['new', 'in_review', 'approved', 'rejected', 'resolved'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await run(`UPDATE claims SET status = ? WHERE id = ?`, [status, id]);
    const claim = await get(`SELECT * FROM claims WHERE id = ?`, [id]);
    res.json({ claim });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Admin: basic stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalItems = await get(`SELECT COUNT(*) as c FROM items`);
    const pending = await get(`SELECT COUNT(*) as c FROM items WHERE status = 'pending'`);
    const approved = await get(`SELECT COUNT(*) as c FROM items WHERE status = 'approved'`);
    const claimed = await get(`SELECT COUNT(*) as c FROM items WHERE status = 'claimed'`);
    const totalClaims = await get(`SELECT COUNT(*) as c FROM claims`);
    const newClaims = await get(`SELECT COUNT(*) as c FROM claims WHERE status = 'new'`);
    res.json({
      items: {
        total: totalItems.c, pending: pending.c, approved: approved.c, claimed: claimed.c
      },
      claims: { total: totalClaims.c, new: newClaims.c }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Change password (admin)
app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  try {
    const { current = '', next = '' } = req.body;
    const user = await get(`SELECT * FROM users WHERE id = ?`, [req.session.user.id]);
    const ok = await bcrypt.compare(current, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password incorrect' });
    if (next.length < 8) return res.status(400).json({ error: 'New password too short' });
    const hash = await bcrypt.hash(next, 10);
    await run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, user.id]);
    res.json({ message: 'Password changed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

init().then(() => {
  app.listen(PORT, () => console.log(`Lost & Found running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to init DB', err);
  process.exit(1);
});
