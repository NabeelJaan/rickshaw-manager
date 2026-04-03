import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('rickshaw_manager.db');

const lines = fs.readFileSync('raw_data_ilyas.txt', 'utf8').split('\n');

const driver_id = 5; // Ilyas
const rickshaw_id = 1; // BAB 2023

const months = [
  { name: 'Oct 2025', year: 2025, month: 10, rentIdx: 1, pendingIdx: 2, workIdx: 3, remarksIdx: -1 },
  { name: 'Nov 2025', year: 2025, month: 11, rentIdx: 7, pendingIdx: 8, workIdx: 9, remarksIdx: -1 },
  { name: 'Dec 2025', year: 2025, month: 12, rentIdx: 13, pendingIdx: 14, workIdx: 15, remarksIdx: 17 },
  { name: 'Jan 2026', year: 2026, month: 1, rentIdx: 20, pendingIdx: 21, workIdx: 22, remarksIdx: 24 },
  { name: 'Feb 2026', year: 2026, month: 2, rentIdx: 27, pendingIdx: 28, workIdx: 29, remarksIdx: 31 },
];

let addedCount = 0;
let finalPendingBalance = 0;

const insertTx = db.prepare(`
  INSERT INTO transactions (driver_id, rickshaw_id, date, type, category, amount, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  for (let i = 0; i < 31; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split('\t');
    
    for (const m of months) {
      const dayStr = parts[0]; // Day is always the first column in the block, wait, no.
      // Day is at m.rentIdx - 1
      const dayVal = parts[m.rentIdx - 1];
      if (!dayVal || isNaN(parseInt(dayVal))) continue;
      
      const day = parseInt(dayVal);
      const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const rentStr = parts[m.rentIdx];
      const pendingStr = parts[m.pendingIdx];
      const workStr = parts[m.workIdx];
      const remarksStr = m.remarksIdx !== -1 ? parts[m.remarksIdx] : '';
      
      let rentPaid = 0;
      let isLeave = false;
      
      if (rentStr) {
        if (rentStr.toLowerCase().includes('leave')) {
          isLeave = true;
        } else {
          rentPaid = parseInt(rentStr) || 0;
        }
      }
      
      let workAmount = 0;
      if (workStr && !isNaN(parseInt(workStr))) {
        workAmount = parseInt(workStr);
      }
      
      let pendingAmount = 0;
      if (pendingStr && !isNaN(parseInt(pendingStr))) {
        pendingAmount = parseInt(pendingStr);
      }
      
      // If there's rent paid, add income
      if (rentPaid > 0) {
        insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', rentPaid, '');
        addedCount++;
      }
      
      // If there's rickshaw work, add expense
      if (workAmount > 0) {
        let desc = 'Maintenance';
        if (remarksStr && remarksStr.trim() !== '') {
          desc += ': ' + remarksStr.trim();
        }
        insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', workAmount, desc);
        addedCount++;
      }
      
      // If it's a leave, add a 0 income record with description "Leave"
      if (isLeave) {
        insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', 0, 'Leave');
        addedCount++;
      }
      
      // Update final pending balance if it's the last day of the month
      // Actually, we can just look at the last recorded pending balance.
      // Or we can just calculate the pending balance.
      // Wait, the pending balance is cumulative. We can just take the last one.
      if (m.month === 2 && day === 28) { // Feb 28
        if (pendingAmount > 0) {
          finalPendingBalance = pendingAmount;
        }
      }
    }
  }
  
  // Update driver's pending balance
  if (finalPendingBalance > 0) {
    db.prepare('UPDATE drivers SET pending_balance = ? WHERE id = ?').run(finalPendingBalance, driver_id);
  }
})();

console.log(`Successfully added ${addedCount} detailed transactions for Ilyas. Pending balance added: ${finalPendingBalance}`);
