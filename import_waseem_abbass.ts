import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('rickshaw_manager.db');

const lines = fs.readFileSync('raw_data_waseem_abbass.txt', 'utf8').split('\n');

const driver_id = 4; // Waseem Abbass
const rickshaw_id = 1; // Assuming BAB 2023

let addedCount = 0;

const insertTx = db.prepare(`
  INSERT INTO transactions (driver_id, rickshaw_id, date, type, category, amount, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  // Delete existing transactions for Waseem Abbass to avoid duplicates
  db.prepare('DELETE FROM transactions WHERE driver_id = ?').run(driver_id);

  for (let i = 1; i <= 31; i++) {
    const line = lines[i - 1];
    if (!line) continue;
    
    const parts = line.split(new RegExp(`\\b${i}\\b`)).map(p => p.trim());
    
    const months = [
      { month: 10, year: 2025, data: parts[1] },
      { month: 11, year: 2025, data: parts[2] },
      { month: 12, year: 2025, data: parts[3] },
      { month: 1, year: 2026, data: parts[4] },
      { month: 2, year: 2026, data: parts[5] }
    ];
    
    for (const m of months) {
      if (!m.data) continue;
      
      const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      let rentPaid = 0;
      let workAmount = 0;
      let remarks = '';
      
      if (m.data.toLowerCase().includes('leave')) {
        insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', 0, 'Leave');
        addedCount++;
        continue;
      }
      
      const tokens = m.data.split(/\s+/);
      const numbers = tokens.filter(t => !isNaN(parseInt(t))).map(t => parseInt(t));
      const words = tokens.filter(t => isNaN(parseInt(t)) && !['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(t));
      
      if (numbers.length > 0) {
        rentPaid = numbers[0];
      }
      
      // Hardcode work amounts based on manual reconciliation
      if (m.month === 10) {
        if (i === 10) workAmount = 1000;
        if (i === 20) workAmount = 1000;
        if (i === 28) workAmount = 1000;
      } else if (m.month === 11) {
        if (i === 4) workAmount = 700;
        if (i === 13) workAmount = 800;
        if (i === 16) workAmount = 350;
        if (i === 20) workAmount = 700;
        if (i === 26) workAmount = 500;
      } else if (m.month === 12) {
        if (i === 1) workAmount = 2000;
        if (i === 8) workAmount = 800;
        if (i === 10) workAmount = 700;
        if (i === 17) workAmount = 700;
        if (i === 25) workAmount = 700;
        if (i === 26) workAmount = 800;
      } else if (m.month === 1) {
        if (i === 1) workAmount = 700;
        if (i === 8) workAmount = 700;
        if (i === 9) workAmount = 500;
        if (i === 19) workAmount = 4000;
        if (i === 24) workAmount = 1200;
      } else if (m.month === 2) {
        if (i === 1) workAmount = 300;
        if (i === 9) workAmount = 300;
      }
      
      if (words.length > 0) {
        remarks = words.join(' ');
        if (remarks.includes('Waseem Abbass End')) {
          remarks = remarks.replace('Waseem Abbass End', '').trim();
        }
      }
      
      if (rentPaid > 0) {
        insertTx.run(driver_id, rickshaw_id, dateStr, 'income', 'Daily Rent', rentPaid, '');
        addedCount++;
      }
      
      if (workAmount > 0) {
        let desc = 'Maintenance';
        if (remarks) desc += ': ' + remarks;
        insertTx.run(driver_id, rickshaw_id, dateStr, 'expense', 'Maintenance', workAmount, desc);
        addedCount++;
      }
    }
  }
})();

console.log(`Successfully added ${addedCount} transactions for Waseem Abbass.`);
