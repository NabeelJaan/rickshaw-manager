import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'rickshaw_manager.db');

console.log('Fixing corrupted database...');

// Remove corrupted database file
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
    console.log('Removed corrupted database file');
  } catch (error) {
    console.error('Error removing database file:', error);
    process.exit(1);
  }
}

// Create new database with fresh schema
const db = new Database(dbPath);

console.log('Creating new database schema...');

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
`);

console.log('Database schema created successfully!');
console.log('Database is now ready to use.');

db.close();
