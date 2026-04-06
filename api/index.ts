import express from 'express';
import { sql, initializeDatabase } from '../server/database';

const app = express();
app.use(express.json());

let dbReady = false;
async function ensureDb() {
  if (!dbReady) {
    await initializeDatabase();
    dbReady = true;
  }
}

// ─── Rickshaws ────────────────────────────────────────────────────────────────

app.get('/api/rickshaws', async (req, res) => {
  await ensureDb();
  try {
    const result = await sql`
      SELECT r.*,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE rickshaw_id = r.id AND type = 'income' AND category != 'rent_pending'), 0) -
        COALESCE((SELECT SUM(amount) FROM transactions WHERE rickshaw_id = r.id AND type = 'expense' AND category != 'rent_pending'), 0) as recovered_cost
      FROM rickshaws r
      ORDER BY r.id DESC
    `;
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rickshaws', async (req, res) => {
  await ensureDb();
  const { number, purchase_date, investment_cost } = req.body;
  try {
    const result = await sql`
      INSERT INTO rickshaws (number, purchase_date, investment_cost)
      VALUES (${number}, ${purchase_date}, ${investment_cost})
      RETURNING *
    `;
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/rickshaws/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  const { number, purchase_date, investment_cost } = req.body;
  try {
    const result = await sql`
      UPDATE rickshaws SET number=${number}, purchase_date=${purchase_date}, investment_cost=${investment_cost}
      WHERE id=${id} RETURNING *
    `;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Rickshaw not found' });
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/rickshaws/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  try {
    await sql`DELETE FROM rickshaw_assignments WHERE rickshaw_id=${id}`;
    await sql`DELETE FROM transactions WHERE rickshaw_id=${id}`;
    await sql`DELETE FROM rickshaws WHERE id=${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Drivers ──────────────────────────────────────────────────────────────────

app.get('/api/drivers', async (req, res) => {
  await ensureDb();
  try {
    const result = await sql`
      SELECT d.*, r.number as assigned_rickshaw
      FROM drivers d
      LEFT JOIN rickshaw_assignments a ON d.id = a.driver_id AND a.end_date IS NULL
      LEFT JOIN rickshaws r ON a.rickshaw_id = r.id
      ORDER BY d.id DESC
    `;
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/drivers', async (req, res) => {
  await ensureDb();
  const { name, phone, join_date } = req.body;
  try {
    const result = await sql`
      INSERT INTO drivers (name, phone, join_date) VALUES (${name}, ${phone ?? null}, ${join_date}) RETURNING *
    `;
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/drivers/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  const { name, phone, join_date } = req.body;
  try {
    const result = await sql`
      UPDATE drivers SET name=${name}, phone=${phone ?? null}, join_date=${join_date}
      WHERE id=${id} RETURNING *
    `;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/drivers/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  try {
    await sql`DELETE FROM rickshaw_assignments WHERE driver_id=${id}`;
    await sql`DELETE FROM transactions WHERE driver_id=${id}`;
    await sql`DELETE FROM drivers WHERE id=${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Assignments ──────────────────────────────────────────────────────────────

app.get('/api/assignments', async (req, res) => {
  await ensureDb();
  try {
    const result = await sql`
      SELECT a.*, r.number as rickshaw_number, d.name as driver_name
      FROM rickshaw_assignments a
      JOIN rickshaws r ON a.rickshaw_id = r.id
      JOIN drivers d ON a.driver_id = d.id
      ORDER BY a.start_date DESC
    `;
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assignments', async (req, res) => {
  await ensureDb();
  const { rickshaw_id, driver_id, start_date } = req.body;
  try {
    await sql`UPDATE rickshaw_assignments SET end_date=${start_date} WHERE rickshaw_id=${rickshaw_id} AND end_date IS NULL`;
    const result = await sql`
      INSERT INTO rickshaw_assignments (rickshaw_id, driver_id, start_date)
      VALUES (${rickshaw_id}, ${driver_id}, ${start_date}) RETURNING *
    `;
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

app.get('/api/transactions', async (req, res) => {
  await ensureDb();
  const { start_date, end_date, rickshaw_id, driver_id, limit } = req.query;
  try {
    // Build dynamic query safely
    let conditions = ['1=1'];
    const args: any[] = [];
    let i = 1;
    if (start_date)  { conditions.push(`t.date >= $${i++}`);         args.push(start_date); }
    if (end_date)    { conditions.push(`t.date <= $${i++}`);         args.push(end_date); }
    if (rickshaw_id) { conditions.push(`t.rickshaw_id = $${i++}`);   args.push(rickshaw_id); }
    if (driver_id)   { conditions.push(`t.driver_id = $${i++}`);     args.push(driver_id); }

    let query = `
      SELECT t.*, r.number as rickshaw_number, d.name as driver_name
      FROM transactions t
      LEFT JOIN rickshaws r ON t.rickshaw_id = r.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.date DESC, t.id DESC
    `;
    if (limit) { query += ` LIMIT $${i++}`; args.push(parseInt(limit as string)); }

    const { rows } = await sql.query(query, args);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', async (req, res) => {
  await ensureDb();
  const { date, type, category, amount, rickshaw_id, driver_id, notes } = req.body;
  try {
    let finalAmount = amount;
    if ((category === 'rent_pending' || type === 'pending') && (!amount || amount === 0) && notes) {
      const m = notes.match(/(\d+)/);
      if (m) finalAmount = parseFloat(m[1]);
    }
    const result = await sql`
      INSERT INTO transactions (date, type, category, amount, rickshaw_id, driver_id, notes)
      VALUES (${date}, ${type}, ${category}, ${finalAmount}, ${rickshaw_id ?? null}, ${driver_id ?? null}, ${notes ?? null})
      RETURNING *
    `;
    if (driver_id) {
      if (type === 'pending' || category === 'rent_pending') {
        await sql`UPDATE drivers SET pending_balance = pending_balance + ${finalAmount} WHERE id = ${driver_id}`;
      } else if (category === 'rent_recovery') {
        await sql`UPDATE drivers SET pending_balance = pending_balance - ${finalAmount} WHERE id = ${driver_id}`;
      }
    }
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/transactions/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  const { date, type, category, amount, rickshaw_id, driver_id, notes } = req.body;
  try {
    const oldResult = await sql`SELECT * FROM transactions WHERE id = ${id}`;
    const oldTx = oldResult.rows[0] as any;

    let finalAmount = amount;
    if ((category === 'rent_pending' || type === 'pending') && (!amount || amount === 0) && notes) {
      const m = notes.match(/(\d+)/);
      if (m) finalAmount = parseFloat(m[1]);
    }

    // Reverse old pending effect
    if (oldTx?.driver_id) {
      let oldAmt = oldTx.amount;
      if ((oldTx.category === 'rent_pending' || oldTx.type === 'pending') && !oldTx.amount && oldTx.notes) {
        const m = oldTx.notes.match(/(\d+)/);
        if (m) oldAmt = parseFloat(m[1]);
      }
      if (oldTx.type === 'pending' || oldTx.category === 'rent_pending') {
        await sql`UPDATE drivers SET pending_balance = pending_balance - ${oldAmt} WHERE id = ${oldTx.driver_id}`;
      } else if (oldTx.category === 'rent_recovery') {
        await sql`UPDATE drivers SET pending_balance = pending_balance + ${oldAmt} WHERE id = ${oldTx.driver_id}`;
      }
    }

    const result = await sql`
      UPDATE transactions SET date=${date}, type=${type}, category=${category}, amount=${finalAmount},
        rickshaw_id=${rickshaw_id ?? null}, driver_id=${driver_id ?? null}, notes=${notes ?? null}
      WHERE id=${id} RETURNING *
    `;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found' });

    // Apply new pending effect
    if (driver_id) {
      if (category === 'rent_pending' || type === 'pending') {
        await sql`UPDATE drivers SET pending_balance = pending_balance + ${finalAmount} WHERE id = ${driver_id}`;
      } else if (category === 'rent_recovery') {
        await sql`UPDATE drivers SET pending_balance = pending_balance - ${finalAmount} WHERE id = ${driver_id}`;
      }
    }
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  try {
    const txResult = await sql`SELECT * FROM transactions WHERE id = ${id}`;
    const tx = txResult.rows[0] as any;
    if (tx?.driver_id) {
      let finalAmount = tx.amount;
      if ((tx.category === 'rent_pending' || tx.type === 'pending') && !tx.amount && tx.notes) {
        const m = tx.notes.match(/(\d+)/);
        if (m) finalAmount = parseFloat(m[1]);
      }
      if (tx.type === 'pending' || tx.category === 'rent_pending') {
        await sql`UPDATE drivers SET pending_balance = pending_balance - ${finalAmount} WHERE id = ${tx.driver_id}`;
      } else if (tx.category === 'rent_recovery') {
        await sql`UPDATE drivers SET pending_balance = pending_balance + ${finalAmount} WHERE id = ${tx.driver_id}`;
      }
    }
    await sql`DELETE FROM transactions WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Categories ───────────────────────────────────────────────────────────────

app.get('/api/categories', async (req, res) => {
  await ensureDb();
  const { type } = req.query;
  try {
    const result = type
      ? await sql`SELECT * FROM categories WHERE type = ${type as string} ORDER BY name`
      : await sql`SELECT * FROM categories ORDER BY type, name`;
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/categories', async (req, res) => {
  await ensureDb();
  const { name, type } = req.body;
  try {
    const result = await sql`INSERT INTO categories (name, type) VALUES (${name}, ${type}) RETURNING *`;
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/categories/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await sql`UPDATE categories SET name=${name} WHERE id=${id} RETURNING *`;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/categories/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  try {
    const catResult = await sql`SELECT * FROM categories WHERE id = ${id}`;
    const cat = catResult.rows[0] as any;
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (cat.is_default) return res.status(400).json({ error: 'Cannot delete default category' });
    const usage = await sql`SELECT COUNT(*) as count FROM transactions WHERE category = ${cat.name}`;
    const count = Number((usage.rows[0] as any).count);
    if (count > 0) return res.status(400).json({ error: `Cannot delete category used in ${count} transaction(s)` });
    await sql`DELETE FROM categories WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', async (req, res) => {
  await ensureDb();
  try {
    const result = await sql`SELECT * FROM settings WHERE id = 1`;
    res.json(result.rows[0] ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
  await ensureDb();
  const { currency, currencySymbol, dateFormat, autoBackup, reportFormat } = req.body;
  try {
    await sql`
      INSERT INTO settings (id, currency, currency_symbol, date_format, auto_backup, report_format)
      VALUES (1, ${currency}, ${currencySymbol}, ${dateFormat}, ${autoBackup ? 1 : 0}, ${reportFormat})
      ON CONFLICT (id) DO UPDATE SET
        currency = EXCLUDED.currency,
        currency_symbol = EXCLUDED.currency_symbol,
        date_format = EXCLUDED.date_format,
        auto_backup = EXCLUDED.auto_backup,
        report_format = EXCLUDED.report_format
    `;
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Stats / Dashboard ────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  await ensureDb();
  const { driver_id } = req.query;
  try {
    const dArgs = driver_id ? [driver_id] : [];
    const dFilter = driver_id ? 'AND driver_id = $1' : '';

    const [incomeR, expenseR] = await Promise.all([
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND category != 'rent_pending' ${dFilter}`, dArgs),
      sql.query(`SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND category != 'rent_pending' ${dFilter}`, dArgs),
    ]);

    const pendingR = driver_id
      ? await sql`SELECT pending_balance as total FROM drivers WHERE id = ${driver_id as string}`
      : await sql`SELECT SUM(pending_balance) as total FROM drivers`;

    const investR = driver_id
      ? await sql`SELECT SUM(r.investment_cost) as total FROM rickshaws r JOIN rickshaw_assignments a ON r.id = a.rickshaw_id WHERE a.driver_id = ${driver_id as string} AND a.end_date IS NULL`
      : await sql`SELECT SUM(investment_cost) as total FROM rickshaws`;

    const activeR = driver_id
      ? await sql`SELECT COUNT(DISTINCT r.id) as count FROM rickshaws r JOIN rickshaw_assignments a ON r.id = a.rickshaw_id WHERE a.driver_id = ${driver_id as string} AND a.end_date IS NULL`
      : await sql`SELECT COUNT(DISTINCT rickshaw_id) as count FROM rickshaw_assignments WHERE end_date IS NULL`;

    const totalR = driver_id
      ? await sql`SELECT COUNT(DISTINCT r.id) as count FROM rickshaws r JOIN rickshaw_assignments a ON r.id = a.rickshaw_id WHERE a.driver_id = ${driver_id as string}`
      : await sql`SELECT COUNT(id) as count FROM rickshaws`;

    const monthlyR = await sql.query(`
      SELECT TO_CHAR(TO_DATE(date, 'YYYY-MM-DD'), 'YYYY-MM') as month,
        SUM(CASE WHEN type = 'income' AND category != 'rent_pending' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' AND category != 'rent_pending' THEN amount ELSE 0 END) as expense
      FROM transactions WHERE 1=1 ${dFilter}
      GROUP BY month ORDER BY month ASC LIMIT 12
    `, dArgs);

    const dailyR = await sql.query(`
      SELECT date,
        SUM(CASE WHEN type = 'income' AND category != 'rent_pending' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' AND category != 'rent_pending' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD') ${dFilter}
      GROUP BY date ORDER BY date ASC
    `, dArgs);

    const totalIncome     = Number(incomeR.rows[0]?.total) || 0;
    const totalExpense    = Number(expenseR.rows[0]?.total) || 0;
    const totalInvestment = Number(investR.rows[0]?.total) || 0;
    const pendingBalance  = Number(pendingR.rows[0]?.total) || 0;
    const activeRickshaws = Number(activeR.rows[0]?.count) || 0;
    const totalRickshaws  = Number(totalR.rows[0]?.count) || 0;

    res.json({
      totalIncome, totalExpense, totalInvestment,
      profit: totalIncome - totalExpense,
      pendingBalance, activeRickshaws, totalRickshaws,
      monthlyData: monthlyR.rows,
      dailyData: dailyR.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default app;