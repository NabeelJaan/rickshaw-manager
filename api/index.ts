import express from 'express';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── DB Init ──────────────────────────────────────────────────────────────────
let dbReady = false;
async function ensureDb() {
  if (dbReady) return;

  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS rickshaws (
    id SERIAL PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    purchase_date TEXT NOT NULL,
    investment_cost REAL NOT NULL,
    status TEXT DEFAULT 'active'
  )`;
  await sql`CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    join_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    pending_balance REAL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS rickshaw_assignments (
    id SERIAL PRIMARY KEY,
    rickshaw_id INTEGER NOT NULL REFERENCES rickshaws(id),
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    start_date TEXT NOT NULL,
    end_date TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    rickshaw_id INTEGER REFERENCES rickshaws(id),
    driver_id INTEGER REFERENCES drivers(id),
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    currency TEXT DEFAULT 'PKR',
    currency_symbol TEXT DEFAULT 'Rs.',
    date_format TEXT DEFAULT 'DD-MM-YYYY',
    auto_backup INTEGER DEFAULT 0,
    report_format TEXT DEFAULT 'pdf'
  )`;
  await sql`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type)
  )`;
  const defaults: [string, string][] = [
    ['rent','income'],['rent_recovery','income'],['tips','income'],['other','income'],
    ['fuel','expense'],['maintenance','expense'],['salary','expense'],['rent_pending','expense'],['other','expense'],
  ];
  for (const [n, t] of defaults) {
    await sql`INSERT INTO categories (name,type,is_default) VALUES (${n},${t},1) ON CONFLICT (name,type) DO NOTHING`;
  }
  dbReady = true;
}

// ─── EMERGENCY RESET (one-time use — DELETE THIS AFTER USE) ───────────────────
// Visit: /api/auth/emergency-reset?secret=RESET_SECRET_2026
// This clears all users so you can re-register from scratch
app.get('/api/auth/emergency-reset', async (req, res) => {
  try {
    if (req.query.secret !== 'RESET_SECRET_2026') {
      return res.status(403).json({ error: 'Invalid secret' });
    }
    await ensureDb();
    await sql`DELETE FROM password_resets`;
    await sql`DELETE FROM users`;
    res.json({
      success: true,
      message: 'All users deleted. Refresh your app to register a new super admin.',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// Check if first-time setup is needed
app.get('/api/auth/can-register', async (req, res) => {
  try {
    await ensureDb();
    const users = await sql`SELECT id FROM users LIMIT 1`;
    res.json({ canRegister: users.rowCount === 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// First-time registration — creates the super admin
app.post('/api/auth/register-first', async (req, res) => {
  try {
    await ensureDb();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await sql`SELECT id FROM users LIMIT 1`;
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'Registration closed. Contact administrator.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (username, password, role)
      VALUES (${username}, ${hashedPassword}, 'super_admin')
      RETURNING id, username, role
    `;
    const newUser = result.rows[0];
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ success: true, user: newUser, token });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    await ensureDb();
    const { username, password } = req.body;
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const result = await sql`SELECT id, username, role FROM users WHERE id = ${req.user.id}`;
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Forgot password — returns token on screen (no email needed)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    await ensureDb();
    const { username } = req.body;
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = result.rows[0];
    if (!user) return res.json({ message: 'If the user exists, a reset token has been generated' });

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await sql`INSERT INTO password_resets (user_id, token, expires_at) VALUES (${user.id}, ${resetToken}, ${expiresAt})`;
    res.json({ success: true, resetToken, expiresAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    await ensureDb();
    const { token, newPassword } = req.body;
    const result = await sql`
      SELECT pr.*, u.username FROM password_resets pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.token = ${token} AND pr.used = 0 AND pr.expires_at > ${new Date().toISOString()}
      LIMIT 1
    `;
    const reset = result.rows[0];
    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset token' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${reset.user_id}`;
    await sql`UPDATE password_resets SET used = 1 WHERE id = ${reset.id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Change password (logged in)
app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { currentPassword, newPassword } = req.body;
    const result = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${req.user.id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get all users (super admin only)
app.get('/api/auth/users', authenticate, async (req, res) => {
  try {
    await ensureDb();
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const result = await sql`SELECT id, username, role, created_at FROM users ORDER BY id`;
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create new user (super admin only)
app.post('/api/auth/register', authenticate, async (req, res) => {
  try {
    await ensureDb();
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, role = 'admin' } = req.body;
    if (!['admin', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (username, password, role)
      VALUES (${username}, ${hashedPassword}, ${role})
      RETURNING id, username, role
    `;
    res.json({ success: true, user: result.rows[0] });
  } catch (e: any) {
    if (e.message?.includes('unique')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Super admin resets another user's password
app.post('/api/auth/users/:id/reset-password', authenticate, async (req, res) => {
  try {
    await ensureDb();
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const r = await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${req.params.id} RETURNING id, username`;
    if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, username: r.rows[0].username });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete user (super admin only)
app.delete('/api/auth/users/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await sql`DELETE FROM users WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Rickshaws ────────────────────────────────────────────────────────────────
app.get('/api/rickshaws', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const r = await sql`
      SELECT r.*,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE rickshaw_id=r.id AND type='income' AND category!='rent_pending'),0) -
        COALESCE((SELECT SUM(amount) FROM transactions WHERE rickshaw_id=r.id AND type='expense' AND category!='rent_pending'),0) as recovered_cost
      FROM rickshaws r ORDER BY r.id DESC`;
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rickshaws', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { number, purchase_date, investment_cost } = req.body;
    const r = await sql`INSERT INTO rickshaws (number,purchase_date,investment_cost) VALUES (${number},${purchase_date},${investment_cost}) RETURNING *`;
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/rickshaws/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { number, purchase_date, investment_cost } = req.body;
    const r = await sql`UPDATE rickshaws SET number=${number},purchase_date=${purchase_date},investment_cost=${investment_cost} WHERE id=${req.params.id} RETURNING *`;
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/rickshaws/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const id = req.params.id;
    await sql`DELETE FROM rickshaw_assignments WHERE rickshaw_id=${id}`;
    await sql`DELETE FROM transactions WHERE rickshaw_id=${id}`;
    await sql`DELETE FROM rickshaws WHERE id=${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Drivers ──────────────────────────────────────────────────────────────────
app.get('/api/drivers', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const r = await sql`
      SELECT d.*, rk.number as assigned_rickshaw
      FROM drivers d
      LEFT JOIN rickshaw_assignments a ON d.id=a.driver_id AND a.end_date IS NULL
      LEFT JOIN rickshaws rk ON a.rickshaw_id=rk.id
      ORDER BY d.id DESC`;
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/drivers', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { name, phone, join_date } = req.body;
    const r = await sql`INSERT INTO drivers (name,phone,join_date) VALUES (${name},${phone??null},${join_date}) RETURNING *`;
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/drivers/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { name, phone, join_date } = req.body;
    const r = await sql`UPDATE drivers SET name=${name},phone=${phone??null},join_date=${join_date} WHERE id=${req.params.id} RETURNING *`;
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/drivers/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const id = req.params.id;
    await sql`DELETE FROM rickshaw_assignments WHERE driver_id=${id}`;
    await sql`DELETE FROM transactions WHERE driver_id=${id}`;
    await sql`DELETE FROM drivers WHERE id=${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.post('/api/drivers/:id/pending-balance', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { amount, notes } = req.body;
    const id = req.params.id;
    const r = await sql`UPDATE drivers SET pending_balance = pending_balance + ${amount} WHERE id=${id} RETURNING *`;
    if (r.rowCount === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Assignments ──────────────────────────────────────────────────────────────
app.get('/api/assignments', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const r = await sql`
      SELECT a.*, rk.number as rickshaw_number, d.name as driver_name
      FROM rickshaw_assignments a
      JOIN rickshaws rk ON a.rickshaw_id=rk.id
      JOIN drivers d ON a.driver_id=d.id
      ORDER BY a.start_date DESC`;
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assignments', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { rickshaw_id, driver_id, start_date } = req.body;
    await sql`UPDATE rickshaw_assignments SET end_date=${start_date} WHERE rickshaw_id=${rickshaw_id} AND end_date IS NULL`;
    const r = await sql`INSERT INTO rickshaw_assignments (rickshaw_id,driver_id,start_date) VALUES (${rickshaw_id},${driver_id},${start_date}) RETURNING *`;
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Transactions ─────────────────────────────────────────────────────────────
app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { start_date, end_date, rickshaw_id, driver_id, limit, month } = req.query;
    const conds = ['1=1']; const args: any[] = []; let i = 1;
    if (start_date)  { conds.push(`t.date >= $${i++}`);       args.push(start_date); }
    if (end_date)    { conds.push(`t.date <= $${i++}`);       args.push(end_date); }
    if (month) {
      const monthFilter = month === 'all' ? '' : `AND TO_CHAR(TO_DATE(t.date,'YYYY-MM-DD'),'YYYY-MM') = '${month}'`;
      if (monthFilter) { conds.push(monthFilter.replace('AND ', '')); }
    } else {
      conds.push(`TO_CHAR(TO_DATE(t.date,'YYYY-MM-DD'),'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')`);
    }
    if (rickshaw_id) {
      if (Array.isArray(rickshaw_id)) {
        conds.push(`t.rickshaw_id = ANY($${i++})`);
        args.push(rickshaw_id);
      } else {
        conds.push(`t.rickshaw_id = $${i++}`);
        args.push(rickshaw_id);
      }
    }
    if (driver_id)   { conds.push(`t.driver_id = $${i++}`);   args.push(driver_id); }
    let q = `SELECT t.*, rk.number as rickshaw_number, d.name as driver_name
      FROM transactions t
      LEFT JOIN rickshaws rk ON t.rickshaw_id=rk.id
      LEFT JOIN drivers d ON t.driver_id=d.id
      WHERE ${conds.join(' AND ')} ORDER BY t.date DESC, t.id DESC`;
    if (limit) { q += ` LIMIT $${i++}`; args.push(parseInt(limit as string)); }
    const { rows } = await sql.query(q, args);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { date, type, category, amount, rickshaw_id, driver_id, notes } = req.body;
    let fa = amount;
    if ((category==='rent_pending'||type==='pending') && (!amount||amount===0) && notes) {
      const m = notes.match(/(\d+)/); if (m) fa = parseFloat(m[1]);
    }
    const r = await sql`INSERT INTO transactions (date,type,category,amount,rickshaw_id,driver_id,notes)
      VALUES (${date},${type},${category},${fa},${rickshaw_id??null},${driver_id??null},${notes??null}) RETURNING *`;
    if (driver_id) {
      if (type==='pending'||category==='rent_pending')
        await sql`UPDATE drivers SET pending_balance=pending_balance+${fa} WHERE id=${driver_id}`;
      else if (category==='rent_recovery')
        await sql`UPDATE drivers SET pending_balance=pending_balance-${fa} WHERE id=${driver_id}`;
    }
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/transactions/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const { date, type, category, amount, rickshaw_id, driver_id, notes } = req.body;
    const old = (await sql`SELECT * FROM transactions WHERE id=${id}`).rows[0] as any;
    let fa = amount;
    if ((category==='rent_pending'||type==='pending') && (!amount||amount===0) && notes) {
      const m = notes.match(/(\d+)/); if (m) fa = parseFloat(m[1]);
    }
    if (old?.driver_id) {
      let oa = old.amount;
      if ((old.category==='rent_pending'||old.type==='pending') && !old.amount && old.notes) {
        const m = old.notes.match(/(\d+)/); if (m) oa = parseFloat(m[1]);
      }
      if (old.type==='pending'||old.category==='rent_pending')
        await sql`UPDATE drivers SET pending_balance=pending_balance-${oa} WHERE id=${old.driver_id}`;
      else if (old.category==='rent_recovery')
        await sql`UPDATE drivers SET pending_balance=pending_balance+${oa} WHERE id=${old.driver_id}`;
    }
    const r = await sql`UPDATE transactions SET date=${date},type=${type},category=${category},amount=${fa},
      rickshaw_id=${rickshaw_id??null},driver_id=${driver_id??null},notes=${notes??null} WHERE id=${id} RETURNING *`;
    if (r.rowCount===0) return res.status(404).json({ error: 'Not found' });
    if (driver_id) {
      if (category==='rent_pending'||type==='pending')
        await sql`UPDATE drivers SET pending_balance=pending_balance+${fa} WHERE id=${driver_id}`;
      else if (category==='rent_recovery')
        await sql`UPDATE drivers SET pending_balance=pending_balance-${fa} WHERE id=${driver_id}`;
    }
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const tx = (await sql`SELECT * FROM transactions WHERE id=${id}`).rows[0] as any;
    if (tx?.driver_id) {
      let fa = tx.amount;
      if ((tx.category==='rent_pending'||tx.type==='pending') && !tx.amount && tx.notes) {
        const m = tx.notes.match(/(\d+)/); if (m) fa = parseFloat(m[1]);
      }
      if (tx.type==='pending'||tx.category==='rent_pending')
        await sql`UPDATE drivers SET pending_balance=pending_balance-${fa} WHERE id=${tx.driver_id}`;
      else if (tx.category==='rent_recovery')
        await sql`UPDATE drivers SET pending_balance=pending_balance+${fa} WHERE id=${tx.driver_id}`;
    }
    await sql`DELETE FROM transactions WHERE id=${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Categories ───────────────────────────────────────────────────────────────
app.get('/api/categories', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { type } = req.query;
    const r = type
      ? await sql`SELECT * FROM categories WHERE type=${type as string} ORDER BY name`
      : await sql`SELECT * FROM categories ORDER BY type, name`;
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/categories', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { name, type } = req.body;
    const r = await sql`INSERT INTO categories (name,type) VALUES (${name},${type}) RETURNING *`;
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/categories/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const r = await sql`UPDATE categories SET name=${req.body.name} WHERE id=${req.params.id} RETURNING *`;
    if (r.rowCount===0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/categories/:id', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const cat = (await sql`SELECT * FROM categories WHERE id=${id}`).rows[0] as any;
    if (!cat) return res.status(404).json({ error: 'Not found' });
    if (cat.is_default) return res.status(400).json({ error: 'Cannot delete default category' });
    const cnt = Number((await sql`SELECT COUNT(*) as count FROM transactions WHERE category=${cat.name}`).rows[0].count);
    if (cnt > 0) return res.status(400).json({ error: `Used in ${cnt} transaction(s)` });
    await sql`DELETE FROM categories WHERE id=${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const r = await sql`SELECT * FROM settings WHERE id=1`;
    res.json(r.rows[0] ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { currency, currencySymbol, dateFormat, autoBackup, reportFormat } = req.body;
    await sql`INSERT INTO settings (id,currency,currency_symbol,date_format,auto_backup,report_format)
      VALUES (1,${currency},${currencySymbol},${dateFormat},${autoBackup?1:0},${reportFormat})
      ON CONFLICT (id) DO UPDATE SET
        currency=EXCLUDED.currency, currency_symbol=EXCLUDED.currency_symbol,
        date_format=EXCLUDED.date_format, auto_backup=EXCLUDED.auto_backup, report_format=EXCLUDED.report_format`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { driver_id, month, rickshaw_id } = req.query;
    const df = driver_id ? 'AND driver_id = $1' : '';
    const rf = rickshaw_id ? (Array.isArray(rickshaw_id) 
      ? `AND rickshaw_id = ANY($2)` 
      : 'AND rickshaw_id = $2') 
      : '';
    const da = driver_id ? (rickshaw_id ? [driver_id, rickshaw_id] : [driver_id]) : (rickshaw_id ? [rickshaw_id] : []);

    // Calculate stats for specified month or current month
    const monthFilter = month 
      ? (month === 'all' ? '' : `AND TO_CHAR(TO_DATE(date,'YYYY-MM-DD'),'YYYY-MM') = '${month}'`)
      : `AND TO_CHAR(TO_DATE(date,'YYYY-MM-DD'),'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')`;

    const [incR, expR] = await Promise.all([
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type='income' AND category!='rent_pending' ${monthFilter} ${df} ${rf}`, da),
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type='expense' AND category!='rent_pending' ${monthFilter} ${df} ${rf}`, da),
    ]);

    // Calculate profit including pending (for "total profit before excluding pending")
    const [incWithPendingR, expWithPendingR] = await Promise.all([
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type='income' ${monthFilter} ${df} ${rf}`, da),
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type='expense' ${monthFilter} ${df} ${rf}`, da),
    ]);

    // Calculate all-time profit for remaining investment (not filtered by month)
    const [allTimeIncR, allTimeExpR] = await Promise.all([
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type='income' AND category!='rent_pending' ${df} ${rf}`, da),
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type='expense' AND category!='rent_pending' ${df} ${rf}`, da),
    ]);

    const pendR = await sql.query(`SELECT SUM(amount) as total FROM transactions WHERE category='rent_pending' ${monthFilter} ${df} ${rf}`, da);

    const invR = driver_id
      ? await sql`SELECT SUM(rk.investment_cost) as total FROM rickshaws rk JOIN rickshaw_assignments a ON rk.id=a.rickshaw_id WHERE a.driver_id=${driver_id as string} AND a.end_date IS NULL`
      : await sql`SELECT SUM(investment_cost) as total FROM rickshaws`;

    const actR = driver_id
      ? await sql`SELECT COUNT(DISTINCT rk.id) as count FROM rickshaws rk JOIN rickshaw_assignments a ON rk.id=a.rickshaw_id WHERE a.driver_id=${driver_id as string} AND a.end_date IS NULL`
      : await sql`SELECT COUNT(DISTINCT rickshaw_id) as count FROM rickshaw_assignments WHERE end_date IS NULL`;

    const totR = driver_id
      ? await sql`SELECT COUNT(DISTINCT rk.id) as count FROM rickshaws rk JOIN rickshaw_assignments a ON rk.id=a.rickshaw_id WHERE a.driver_id=${driver_id as string}`
      : await sql`SELECT COUNT(id) as count FROM rickshaws`;

    const monR = await sql.query(`
      SELECT TO_CHAR(TO_DATE(date,'YYYY-MM-DD'),'YYYY-MM') as month,
        SUM(CASE WHEN type='income' AND category!='rent_pending' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' AND category!='rent_pending' THEN amount ELSE 0 END) as expense
      FROM transactions WHERE 1=1 ${df} GROUP BY month ORDER BY month ASC LIMIT 12`, da);

    const dayR = await sql.query(`
      SELECT date,
        SUM(CASE WHEN type='income' AND category!='rent_pending' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' AND category!='rent_pending' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days','YYYY-MM-DD') ${df}
      GROUP BY date ORDER BY date ASC`, da);

    res.json({
      totalIncome:     Number(incR.rows[0]?.total) || 0,
      totalExpense:    Number(expR.rows[0]?.total) || 0,
      totalInvestment: Number(invR.rows[0]?.total) || 0,
      profit:          (Number(incR.rows[0]?.total)||0) - (Number(expR.rows[0]?.total)||0),
      profitIncludingPending: (Number(incWithPendingR.rows[0]?.total)||0) - (Number(expWithPendingR.rows[0]?.total)||0),
      allTimeProfit:   (Number(allTimeIncR.rows[0]?.total)||0) - (Number(allTimeExpR.rows[0]?.total)||0),
      allTimeIncome:   Number(allTimeIncR.rows[0]?.total) || 0,
      allTimeExpense:  Number(allTimeExpR.rows[0]?.total) || 0,
      pendingBalance:  Number(pendR.rows[0]?.total) || 0,
      activeRickshaws: Number(actR.rows[0]?.count) || 0,
      totalRickshaws:  Number(totR.rows[0]?.count) || 0,
      monthlyData: monR.rows,
      dailyData:   dayR.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Reports ─────────────────────────────────────────────────────────────────
app.get('/api/reports/:type', authenticate, async (req, res) => {
  try {
    await ensureDb();
    const { type } = req.params;
    const { driver_id, start_date, end_date, month } = req.query;
    
    let query = '';
    let params: any[] = [];
    let conditions: string[] = [];
    
    if (driver_id) {
      params.push(driver_id);
      conditions.push(`driver_id = $${params.length}`);
    }
    
    if (start_date) {
      params.push(start_date);
      conditions.push(`date >= $${params.length}`);
    }
    
    if (end_date) {
      params.push(end_date);
      conditions.push(`date <= $${params.length}`);
    }
    
    if (month) {
      conditions.push(`TO_CHAR(TO_DATE(date,'YYYY-MM-DD'),'YYYY-MM') = '${month}'`);
    }
    
    const df = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
    
    if (type === 'income') {
      query = `
        SELECT t.*, r.number as rickshaw_number, d.name as driver_name
        FROM transactions t
        LEFT JOIN rickshaws r ON t.rickshaw_id = r.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.type = 'income' AND t.category != 'rent_pending' ${df}
        ORDER BY t.date DESC, t.id DESC
      `;
    } else if (type === 'expense') {
      query = `
        SELECT t.*, r.number as rickshaw_number, d.name as driver_name
        FROM transactions t
        LEFT JOIN rickshaws r ON t.rickshaw_id = r.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.type = 'expense' AND t.category != 'rent_pending' ${df}
        ORDER BY t.date DESC, t.id DESC
      `;
    } else if (type === 'summary') {
      query = `
        SELECT t.*, r.number as rickshaw_number, d.name as driver_name
        FROM transactions t
        LEFT JOIN rickshaws r ON t.rickshaw_id = r.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.category != 'rent_pending' ${df}
        ORDER BY t.date DESC, t.id DESC
      `;
    } else {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    const result = await sql.query(query, params);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default app;