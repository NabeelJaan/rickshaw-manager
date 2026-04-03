import express from "express";
import { createServer as createViteServer } from "vite";
import db from "./server/database";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Rickshaws
  app.get("/api/rickshaws", (req, res) => {
    const rickshaws = db.prepare(`
      SELECT r.*, 
             COALESCE((SELECT SUM(amount) FROM transactions WHERE rickshaw_id = r.id AND type = 'income' AND category != 'rent_pending'), 0) - 
             COALESCE((SELECT SUM(amount) FROM transactions WHERE rickshaw_id = r.id AND type = 'expense' AND category != 'rent_pending'), 0) as recovered_cost
      FROM rickshaws r 
      ORDER BY r.id DESC
    `).all();
    res.json(rickshaws);
  });

  app.post("/api/rickshaws", (req, res) => {
    const { number, purchase_date, investment_cost } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO rickshaws (number, purchase_date, investment_cost) VALUES (?, ?, ?)");
      const info = stmt.run(number, purchase_date, investment_cost);
      res.json({ id: info.lastInsertRowid, number, purchase_date, investment_cost });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/rickshaws/:id", (req, res) => {
    const { id } = req.params;
    const { number, purchase_date, investment_cost } = req.body;
    try {
      const stmt = db.prepare("UPDATE rickshaws SET number = ?, purchase_date = ?, investment_cost = ? WHERE id = ?");
      const info = stmt.run(number, purchase_date, investment_cost, id);
      if (info.changes === 0) {
        return res.status(404).json({ error: "Rickshaw not found" });
      }
      res.json({ id, number, purchase_date, investment_cost });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/rickshaws/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.transaction(() => {
        // Delete related assignments
        db.prepare("DELETE FROM rickshaw_assignments WHERE rickshaw_id = ?").run(id);
        // Delete related transactions
        db.prepare("DELETE FROM transactions WHERE rickshaw_id = ?").run(id);
        // Delete rickshaw
        const info = db.prepare("DELETE FROM rickshaws WHERE id = ?").run(id);
        if (info.changes === 0) {
          throw new Error("Rickshaw not found");
        }
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Drivers
  app.get("/api/drivers", (req, res) => {
    const drivers = db.prepare(`
      SELECT d.*, r.number as assigned_rickshaw
      FROM drivers d
      LEFT JOIN rickshaw_assignments a ON d.id = a.driver_id AND a.end_date IS NULL
      LEFT JOIN rickshaws r ON a.rickshaw_id = r.id
      ORDER BY d.id DESC
    `).all();
    res.json(drivers);
  });

  app.post("/api/drivers", (req, res) => {
    const { name, phone, join_date } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO drivers (name, phone, join_date) VALUES (?, ?, ?)");
      const info = stmt.run(name, phone, join_date);
      res.json({ id: info.lastInsertRowid, name, phone, join_date });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/drivers/:id", (req, res) => {
    const { id } = req.params;
    const { name, phone, join_date } = req.body;
    try {
      const stmt = db.prepare("UPDATE drivers SET name = ?, phone = ?, join_date = ? WHERE id = ?");
      const info = stmt.run(name, phone, join_date, id);
      if (info.changes === 0) {
        return res.status(404).json({ error: "Driver not found" });
      }
      res.json({ id, name, phone, join_date });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/drivers/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.transaction(() => {
        // Delete related assignments
        db.prepare("DELETE FROM rickshaw_assignments WHERE driver_id = ?").run(id);
        // Delete related transactions
        db.prepare("DELETE FROM transactions WHERE driver_id = ?").run(id);
        // Delete driver
        const info = db.prepare("DELETE FROM drivers WHERE id = ?").run(id);
        if (info.changes === 0) {
          throw new Error("Driver not found");
        }
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Assignments
  app.get("/api/assignments", (req, res) => {
    const assignments = db.prepare(`
      SELECT a.*, r.number as rickshaw_number, d.name as driver_name 
      FROM rickshaw_assignments a
      JOIN rickshaws r ON a.rickshaw_id = r.id
      JOIN drivers d ON a.driver_id = d.id
      ORDER BY a.start_date DESC
    `).all();
    res.json(assignments);
  });

  app.post("/api/assignments", (req, res) => {
    const { rickshaw_id, driver_id, start_date } = req.body;
    try {
      // End previous assignment for this rickshaw if exists
      db.prepare("UPDATE rickshaw_assignments SET end_date = ? WHERE rickshaw_id = ? AND end_date IS NULL").run(start_date, rickshaw_id);
      
      const stmt = db.prepare("INSERT INTO rickshaw_assignments (rickshaw_id, driver_id, start_date) VALUES (?, ?, ?)");
      const info = stmt.run(rickshaw_id, driver_id, start_date);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Transactions
  app.get("/api/transactions", (req, res) => {
    const { start_date, end_date, rickshaw_id, driver_id, limit } = req.query;
    let query = `
      SELECT t.*, r.number as rickshaw_number, d.name as driver_name 
      FROM transactions t
      LEFT JOIN rickshaws r ON t.rickshaw_id = r.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) {
      query += " AND t.date >= ?";
      params.push(start_date);
    }
    if (end_date) {
      query += " AND t.date <= ?";
      params.push(end_date);
    }
    if (rickshaw_id) {
      query += " AND t.rickshaw_id = ?";
      params.push(rickshaw_id);
    }
    if (driver_id) {
      query += " AND t.driver_id = ?";
      params.push(driver_id);
    }

    query += " ORDER BY t.date DESC, t.id DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit as string));
    }

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const { date, type, category, amount, rickshaw_id, driver_id, notes } = req.body;
    try {
      db.transaction(() => {
        let finalAmount = amount;
        
        // If category is rent_pending or type is pending and amount is 0 or empty, try to parse from notes
        if ((category === 'rent_pending' || type === 'pending') && (!amount || amount === 0) && notes) {
          const amountMatch = notes.match(/(\d+)/);
          if (amountMatch) {
            finalAmount = parseFloat(amountMatch[1]);
          }
        }
        
        const stmt = db.prepare("INSERT INTO transactions (date, type, category, amount, rickshaw_id, driver_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const info = stmt.run(date, type, category, finalAmount, rickshaw_id || null, driver_id || null, notes || null);
        
        if (driver_id) {
          if (type === 'pending' || category === 'rent_pending') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance + ? WHERE id = ?").run(finalAmount, driver_id);
          } else if (category === 'rent_recovery') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance - ? WHERE id = ?").run(finalAmount, driver_id);
          }
        }
        res.json({ id: info.lastInsertRowid });
      })();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    const { date, type, category, amount, rickshaw_id, driver_id, notes } = req.body;
    try {
      db.transaction(() => {
        // Get old transaction to update pending balance if needed
        const oldTx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as any;
        
        let finalAmount = amount;
        
        // If category is rent_pending or type is pending and amount is 0 or empty, try to parse from notes
        if ((category === 'rent_pending' || type === 'pending') && (!amount || amount === 0) && notes) {
          const amountMatch = notes.match(/(\d+)/);
          if (amountMatch) {
            finalAmount = parseFloat(amountMatch[1]);
          }
        }
        
        // Update pending balance for old transaction
        if (oldTx && oldTx.driver_id) {
          let oldFinalAmount = oldTx.amount;
          if ((oldTx.category === 'rent_pending' || oldTx.type === 'pending') && (!oldTx.amount || oldTx.amount === 0) && oldTx.notes) {
            const amountMatch = oldTx.notes.match(/(\d+)/);
            if (amountMatch) {
              oldFinalAmount = parseFloat(amountMatch[1]);
            }
          }
          
          if (oldTx.type === 'pending' || oldTx.category === 'rent_pending') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance - ? WHERE id = ?").run(oldFinalAmount, oldTx.driver_id);
          } else if (oldTx.category === 'rent_recovery') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance + ? WHERE id = ?").run(oldFinalAmount, oldTx.driver_id);
          }
        }
        
        // Update transaction
        const stmt = db.prepare("UPDATE transactions SET date = ?, type = ?, category = ?, amount = ?, rickshaw_id = ?, driver_id = ?, notes = ? WHERE id = ?");
        const info = stmt.run(date, type, category, finalAmount, rickshaw_id || null, driver_id || null, notes || null, id);
        
        if (info.changes === 0) {
          throw new Error("Transaction not found");
        }
        
        // Update pending balance for new transaction
        if (driver_id) {
          if (category === 'rent_pending' || type === 'pending') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance + ? WHERE id = ?").run(finalAmount, driver_id);
          } else if (category === 'rent_recovery') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance - ? WHERE id = ?").run(finalAmount, driver_id);
          }
        }
        
        res.json({ id, date, type, category, amount: finalAmount, rickshaw_id, driver_id, notes });
      })();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    try {
      db.transaction(() => {
        const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id) as any;
        if (tx && tx.driver_id) {
          let finalAmount = tx.amount;
          
          // If category is rent_pending or type is pending and amount is 0 or empty, try to parse from notes
          if ((tx.category === 'rent_pending' || tx.type === 'pending') && (!tx.amount || tx.amount === 0) && tx.notes) {
            const amountMatch = tx.notes.match(/(\d+)/);
            if (amountMatch) {
              finalAmount = parseFloat(amountMatch[1]);
            }
          }
          
          if (tx.type === 'pending' || tx.category === 'rent_pending') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance - ? WHERE id = ?").run(finalAmount, tx.driver_id);
          } else if (tx.category === 'rent_recovery') {
            db.prepare("UPDATE drivers SET pending_balance = pending_balance + ? WHERE id = ?").run(finalAmount, tx.driver_id);
          }
        }
        db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
        res.json({ success: true });
      })();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Categories endpoints
  app.get("/api/categories", (req, res) => {
    const { type } = req.query;
    try {
      let query = "SELECT * FROM categories ORDER BY type, name";
      let params: any[] = [];
      
      if (type) {
        query = "SELECT * FROM categories WHERE type = ? ORDER BY name";
        params = [type];
      }
      
      const categories = db.prepare(query).all(...params);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", (req, res) => {
    const { name, type } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO categories (name, type) VALUES (?, ?)");
      const info = stmt.run(name, type);
      res.json({ id: info.lastInsertRowid, name, type });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const stmt = db.prepare("UPDATE categories SET name = ? WHERE id = ?");
      const info = stmt.run(name, id);
      if (info.changes === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ id, name });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    try {
      // First check if category exists and get its details
      const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
      
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // Check if it's a default category
      if (category.is_default) {
        return res.status(400).json({ error: "Cannot delete default category" });
      }
      
      // Check if category is being used in transactions
      const usageCount = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE category = ?").get(category.name) as { count: number };
      
      if (usageCount.count > 0) {
        return res.status(400).json({ error: `Cannot delete category that is used in ${usageCount.count} transaction(s)` });
      }
      
      // Delete the category
      const stmt = db.prepare("DELETE FROM categories WHERE id = ?");
      const info = stmt.run(id);
      
      if (info.changes === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json({ success: true, message: "Category deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Settings endpoints
  app.get("/api/settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      res.json(settings || {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings", (req, res) => {
    try {
      const { currency, currencySymbol, dateFormat, autoBackup, reportFormat } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO settings (id, currency, currency_symbol, date_format, auto_backup, report_format)
        VALUES (1, ?, ?, ?, ?, ?)
      `);
      stmt.run(currency, currencySymbol, dateFormat, autoBackup ? 1 : 0, reportFormat);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Dashboard Stats
  app.get("/api/stats", (req, res) => {
    const { driver_id } = req.query;
    try {
      let driverFilter = "";
      let params: any[] = [];
      if (driver_id) {
        driverFilter = " AND driver_id = ?";
        params.push(driver_id);
      }

      const totalIncome = db.prepare(`SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND category != 'rent_pending'${driverFilter}`).get(...params) as { total: number };
      const totalExpense = db.prepare(`SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND category != 'rent_pending'${driverFilter}`).get(...params) as { total: number };
      
      let totalInvestment = { total: 0 };
      if (driver_id) {
        totalInvestment = db.prepare(`
          SELECT SUM(r.investment_cost) as total 
          FROM rickshaws r
          JOIN rickshaw_assignments a ON r.id = a.rickshaw_id
          WHERE a.driver_id = ? AND a.end_date IS NULL
        `).get(driver_id) as { total: number };
      } else {
        totalInvestment = db.prepare("SELECT SUM(investment_cost) as total FROM rickshaws").get() as { total: number };
      }
      
      const monthlyData = db.prepare(`
        SELECT strftime('%Y-%m', date) as month, 
               SUM(CASE WHEN type = 'income' AND category != 'rent_pending' THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type = 'expense' AND category != 'rent_pending' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE 1=1 ${driverFilter}
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12
      `).all(...params);

      const dailyData = db.prepare(`
        SELECT date, 
               SUM(CASE WHEN type = 'income' AND category != 'rent_pending' THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type = 'expense' AND category != 'rent_pending' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE date >= date('now', '-30 days') ${driverFilter}
        GROUP BY date
        ORDER BY date ASC
      `).all(...params);

      let pendingBalance = { total: 0 };
      if (driver_id) {
        pendingBalance = db.prepare("SELECT pending_balance as total FROM drivers WHERE id = ?").get(driver_id) as { total: number };
      } else {
        pendingBalance = db.prepare("SELECT SUM(pending_balance) as total FROM drivers").get() as { total: number };
      }

      let activeRickshaws = { count: 0 };
      let totalRickshaws = { count: 0 };
      if (driver_id) {
        activeRickshaws = db.prepare(`
          SELECT COUNT(DISTINCT r.id) as count
          FROM rickshaws r
          JOIN rickshaw_assignments a ON r.id = a.rickshaw_id
          WHERE a.driver_id = ? AND a.end_date IS NULL
        `).get(driver_id) as { count: number };
        totalRickshaws = db.prepare(`
          SELECT COUNT(DISTINCT r.id) as count
          FROM rickshaws r
          JOIN rickshaw_assignments a ON r.id = a.rickshaw_id
          WHERE a.driver_id = ?
        `).get(driver_id) as { count: number };
      } else {
        activeRickshaws = db.prepare(`
          SELECT COUNT(DISTINCT rickshaw_id) as count 
          FROM rickshaw_assignments 
          WHERE end_date IS NULL
        `).get() as { count: number };
        totalRickshaws = db.prepare(`
          SELECT COUNT(id) as count 
          FROM rickshaws
        `).get() as { count: number };
      }

      res.json({
        totalIncome: totalIncome.total || 0,
        totalExpense: totalExpense.total || 0,
        totalInvestment: totalInvestment.total || 0,
        profit: (totalIncome.total || 0) - (totalExpense.total || 0),
        pendingBalance: pendingBalance?.total || 0,
        activeRickshaws: activeRickshaws?.count || 0,
        totalRickshaws: totalRickshaws?.count || 0,
        monthlyData,
        dailyData
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
