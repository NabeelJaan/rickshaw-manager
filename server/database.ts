import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'rickshaw_manager.db');
const db = new Database(dbPath);

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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    currency TEXT DEFAULT 'PKR',
    currency_symbol TEXT DEFAULT 'Rs.',
    date_format TEXT DEFAULT 'DD-MM-YYYY',
    auto_backup INTEGER DEFAULT 0,
    report_format TEXT DEFAULT 'pdf'
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type)
  );
`);

try {
  db.exec(`ALTER TABLE drivers ADD COLUMN pending_balance REAL DEFAULT 0;`);
} catch (e) {
  // Column might already exist
}

// Add unique constraint to categories table (if it doesn't exist)
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type ON categories (name, type);`);
} catch (e) {
  // Index might already exist
}

// Insert default categories if they don't exist
const defaultCategories = [
  { name: 'rent', type: 'income' },
  { name: 'rent_recovery', type: 'income' },
  { name: 'tips', type: 'income' },
  { name: 'other', type: 'income' },
  { name: 'fuel', type: 'expense' },
  { name: 'maintenance', type: 'expense' },
  { name: 'salary', type: 'expense' },
  { name: 'rent_pending', type: 'expense' },
  { name: 'other', type: 'expense' }
];

const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name, type, is_default) VALUES (?, ?, 1)");
defaultCategories.forEach(cat => {
  insertCategory.run(cat.name, cat.type);
});

export default db;
