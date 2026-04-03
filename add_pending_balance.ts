import db from "./server/database";
try {
  db.prepare("ALTER TABLE drivers ADD COLUMN pending_balance REAL DEFAULT 0").run();
  console.log("Added pending_balance to drivers");
} catch (e: any) {
  console.log("Column already exists or error:", e.message);
}
