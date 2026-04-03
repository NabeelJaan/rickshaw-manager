import Database from 'better-sqlite3';
import fs from 'fs';

// Delete corrupted database
if (fs.existsSync('rickshaw_manager.db')) {
  fs.unlinkSync('rickshaw_manager.db');
}

const db = new Database('rickshaw_manager.db');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS rickshaws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    purchase_date TEXT NOT NULL,
    investment_cost REAL NOT NULL,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    join_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    pending_balance REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS rickshaw_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rickshaw_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    FOREIGN KEY (rickshaw_id) REFERENCES rickshaws (id),
    FOREIGN KEY (driver_id) REFERENCES drivers (id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL, -- 'income' or 'expense'
    category TEXT NOT NULL, -- 'rent', 'tips', 'fuel', 'maintenance', etc.
    amount REAL NOT NULL,
    rickshaw_id INTEGER,
    driver_id INTEGER,
    notes TEXT,
    FOREIGN KEY (rickshaw_id) REFERENCES rickshaws (id),
    FOREIGN KEY (driver_id) REFERENCES drivers (id)
  );
`);

// Insert initial data
const insertRickshaw = db.prepare('INSERT INTO rickshaws (number, purchase_date, investment_cost) VALUES (?, ?, ?)');
insertRickshaw.run('BAB 2023', '2025-10-01', 243000);

const insertDriver = db.prepare('INSERT INTO drivers (name, phone, join_date) VALUES (?, ?, ?)');
insertDriver.run('Gujjar', '03000000000', '2025-10-01');
insertDriver.run('Sajid', '03000000000', '2025-10-01');
insertDriver.run('Faizan', '03000000000', '2025-10-01');
insertDriver.run('Waseem Abbass', '03000000000', '2025-10-01');
insertDriver.run('Ilyas', '03000000000', '2025-10-01');
insertDriver.run('Bilal', '03000000000', '2026-01-01');

console.log('Database recreated and initial data inserted.');
