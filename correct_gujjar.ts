import db from "./server/database";

const rickshawId = 1; // BAB 2023
const driverId = 1; // Gujjar

// Delete existing transactions for Gujjar
db.prepare("DELETE FROM transactions WHERE driver_id = ? AND rickshaw_id = ?").run(driverId, rickshawId);

const insertTx = db.prepare("INSERT INTO transactions (date, type, category, amount, rickshaw_id, driver_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");

const records = [
  { month: '2025-05-28', income: 3000, expense: 3000 },
  { month: '2025-06-28', income: 18700, expense: 2950 },
  { month: '2025-07-28', income: 30900, expense: 4600 },
  { month: '2025-08-28', income: 31000, expense: 6200 },
  { month: '2025-09-28', income: 30000, expense: 5200 },
  { month: '2025-10-28', income: 31000, expense: 4300 },
  { month: '2025-11-28', income: 26000, expense: 2600 },
  { month: '2025-12-28', income: 31000, expense: 3550 },
  { month: '2026-01-28', income: 29000, expense: 6150 },
  { month: '2026-02-28', income: 23200, expense: 2400 },
];

let added = 0;

for (const record of records) {
  if (record.income > 0) {
    insertTx.run(record.month, 'income', 'rent', record.income, rickshawId, driverId, 'Monthly Total');
    added++;
  }
  if (record.expense > 0) {
    insertTx.run(record.month, 'expense', 'maintenance', record.expense, rickshawId, driverId, 'Monthly Total');
    added++;
  }
}

console.log(`Successfully added ${added} monthly summary transactions for Gujjar.`);
