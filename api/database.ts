import { sql } from '@vercel/postgres';

export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS rickshaws (
      id SERIAL PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      purchase_date TEXT NOT NULL,
      investment_cost REAL NOT NULL,
      status TEXT DEFAULT 'active'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      join_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      pending_balance REAL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rickshaw_assignments (
      id SERIAL PRIMARY KEY,
      rickshaw_id INTEGER NOT NULL REFERENCES rickshaws(id),
      driver_id INTEGER NOT NULL REFERENCES drivers(id),
      start_date TEXT NOT NULL,
      end_date TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      rickshaw_id INTEGER REFERENCES rickshaws(id),
      driver_id INTEGER REFERENCES drivers(id),
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      currency TEXT DEFAULT 'PKR',
      currency_symbol TEXT DEFAULT 'Rs.',
      date_format TEXT DEFAULT 'DD-MM-YYYY',
      auto_backup INTEGER DEFAULT 0,
      report_format TEXT DEFAULT 'pdf'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, type)
    )
  `;

  const defaults: [string, string][] = [
    ['rent', 'income'],
    ['rent_recovery', 'income'],
    ['tips', 'income'],
    ['other', 'income'],
    ['fuel', 'expense'],
    ['maintenance', 'expense'],
    ['salary', 'expense'],
    ['rent_pending', 'expense'],
    ['other', 'expense'],
  ];

  for (const [name, type] of defaults) {
    await sql`
      INSERT INTO categories (name, type, is_default)
      VALUES (${name}, ${type}, 1)
      ON CONFLICT (name, type) DO NOTHING
    `;
  }
}

export { sql };