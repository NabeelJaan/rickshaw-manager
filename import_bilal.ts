import Database from 'better-sqlite3';

const db = new Database('rickshaw_manager.db');

const driver_id = 6; // Bilal
const rickshaw_id = 1; // Assuming BAB 2023

let addedCount = 0;
let pendingBalance = 0;

const insertTx = db.prepare(`
  INSERT INTO transactions (driver_id, rickshaw_id, date, type, category, amount, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  // Delete existing transactions for Bilal to avoid duplicates
  db.prepare('DELETE FROM transactions WHERE driver_id = ?').run(driver_id);

  // Jan 2026
  for (let i = 1; i <= 31; i++) {
    const dateStr = '2026-01-' + String(i).padStart(2, '0');
    
    if (i >= 9 && i <= 31) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', 1000, '');
      addedCount++;
    }
    
    if ([16].includes(i)) pendingBalance += 500;
    if ([17, 18, 21, 22, 23].includes(i)) pendingBalance += 1000;
    
    if (i === 13) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', 1000, 'Maintenance');
      addedCount++;
    }
    if (i === 30) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', 1100, 'Maintenance');
      addedCount++;
    }
  }

  // Feb 2026
  for (let i = 1; i <= 28; i++) {
    const dateStr = '2026-02-' + String(i).padStart(2, '0');
    
    if (i === 6 || i === 7) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', 0, 'Leave');
      addedCount++;
      continue;
    }
    
    insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', 1000, '');
    addedCount++;
    
    if ([3, 4, 5, 13, 14].includes(i)) pendingBalance += 1000;
    if (i === 15) pendingBalance += 800;
    
    if (i === 12) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', 900, 'Maintenance');
      addedCount++;
    }
    if (i === 18) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', 1600, 'Maintenance');
      addedCount++;
    }
    if (i === 23) {
      insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', 1800, 'Maintenance');
      addedCount++;
    }
  }

  // March 2026
  insertTx.run(driver_id, rickshaw_id, '2026-03-01', 'income', 'Daily Rent', 1000, '');
  addedCount++;

  // Update driver's pending balance
  db.prepare('UPDATE drivers SET pending_balance = ? WHERE id = ?').run(pendingBalance, driver_id);
})();

console.log('Successfully added ' + addedCount + ' transactions for Bilal. Pending balance: ' + pendingBalance);
