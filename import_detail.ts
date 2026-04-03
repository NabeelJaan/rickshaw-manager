import db from "./server/database";

const csvData = `Date	Rent Paid	Rent Pending	Rickshaw Work	Net Profit	Remarks		Date	Rent Paid	Rent Pending	Rickshaw Work	Net Profit	Remarks		Date	Rent Paid	Rent Pending	Rickshaw Work	Net Profit	Remarks	Recovery
1	1000						1	1000						1	1000					
2	1000						2	1000						2	1000					
3	1000						3	1000						3	1000					100
4	1000						4	1000						4	1000					100
5	1000						5	1000						5	1000					100
6	1000		400		Engine Ceils		6	1000						6	1000					100
7	1000		600		Oil		7	1000						7	1000					100
8	1000						8	1000						8	1000		700			100
9	1000						9	1000	500					9	Leave					100
10	1000						10	1000						10	1000					100
11	1000						11	1000		4250				11	1000					100
12	1000						12	1000						12	1000					100
13	1000						13	1000						13	1000					100
14	1000						14	1000						14	1000					100
15	1000						15	1000	500					15	1000					100
16	1000						16	1000	1000					16	Leave					-
17	1000		700		Oil 		17	Leave						17	1000					100
18	1300						18	1000						18	1000		1000			100
19	700						19	1000	300	700				19	800					100
20	1000						20	1000						20	800		700		Oil	100
21	1000						21	1000						21	800					-
22	1000						22	1000						22	800					
23	1000						23	1000		700		Break shu		23	800					
24	1000						24	1000						24	800					
25	1000						25	1000						25	800					
26	1000						26	1000		500		Bearing		26	Leave					
27	1000						27	1000						27	800					
28	1000						28	Leave						28	800					
29	1000						29	1000						29						
30	1000		1850				30	1000	300	700		Oil		30						
31	1000						31	1000						31						`;

const lines = csvData.split('\n');
const dataLines = lines.slice(1);

const rickshawId = 1; // BAB 2023
const driverId = 1; // Gujjar

// Delete the monthly summary transactions for Dec, Jan, Feb
db.prepare("DELETE FROM transactions WHERE driver_id = ? AND date IN ('2025-12-28', '2026-01-28', '2026-02-28')").run(driverId);

const insertTx = db.prepare("INSERT INTO transactions (date, type, category, amount, rickshaw_id, driver_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");

let added = 0;
let pendingBalance = 0;

for (const line of dataLines) {
  const cols = line.split('\t');
  
  // Dec 2025
  const decDayStr = cols[0];
  if (decDayStr && decDayStr.trim()) {
    const day = parseInt(decDayStr.trim());
    if (!isNaN(day)) {
      const dateStr = `2025-12-${String(day).padStart(2, '0')}`;
      const rentPaid = parseFloat(cols[1]);
      const rentPending = parseFloat(cols[2]);
      const rickshawWork = parseFloat(cols[3]);
      const remarks = cols[5] ? cols[5].trim() : '';

      if (!isNaN(rentPaid) && rentPaid > 0) {
        insertTx.run(dateStr, 'income', 'rent', rentPaid, rickshawId, driverId, remarks || null);
        added++;
      }
      if (!isNaN(rentPending) && rentPending > 0) {
        pendingBalance += rentPending;
      }
      if (!isNaN(rickshawWork) && rickshawWork > 0) {
        insertTx.run(dateStr, 'expense', 'maintenance', rickshawWork, rickshawId, driverId, remarks || null);
        added++;
      }
    }
  }

  // Jan 2026
  const janDayStr = cols[7];
  if (janDayStr && janDayStr.trim() && janDayStr.trim() !== 'Leave') {
    const day = parseInt(janDayStr.trim());
    if (!isNaN(day)) {
      const dateStr = `2026-01-${String(day).padStart(2, '0')}`;
      const rentPaid = parseFloat(cols[8]);
      const rentPending = parseFloat(cols[9]);
      const rickshawWork = parseFloat(cols[10]);
      const remarks = cols[12] ? cols[12].trim() : '';

      if (!isNaN(rentPaid) && rentPaid > 0) {
        insertTx.run(dateStr, 'income', 'rent', rentPaid, rickshawId, driverId, remarks || null);
        added++;
      }
      if (!isNaN(rentPending) && rentPending > 0) {
        pendingBalance += rentPending;
      }
      if (!isNaN(rickshawWork) && rickshawWork > 0) {
        insertTx.run(dateStr, 'expense', 'maintenance', rickshawWork, rickshawId, driverId, remarks || null);
        added++;
      }
    }
  }

  // Feb 2026
  const febDayStr = cols[14];
  if (febDayStr && febDayStr.trim() && febDayStr.trim() !== 'Leave') {
    const day = parseInt(febDayStr.trim());
    if (!isNaN(day)) {
      const dateStr = `2026-02-${String(day).padStart(2, '0')}`;
      const rentPaid = parseFloat(cols[15]);
      const rentPending = parseFloat(cols[16]);
      const rickshawWork = parseFloat(cols[17]);
      const remarks = cols[19] ? cols[19].trim() : '';
      const recoveryStr = cols[20];
      const recovery = recoveryStr && recoveryStr.trim() !== '-' ? parseFloat(recoveryStr) : NaN;

      if (!isNaN(rentPaid) && rentPaid > 0) {
        insertTx.run(dateStr, 'income', 'rent', rentPaid, rickshawId, driverId, remarks || null);
        added++;
      }
      if (!isNaN(rentPending) && rentPending > 0) {
        pendingBalance += rentPending;
      }
      if (!isNaN(rickshawWork) && rickshawWork > 0) {
        insertTx.run(dateStr, 'expense', 'maintenance', rickshawWork, rickshawId, driverId, remarks || null);
        added++;
      }
      if (!isNaN(recovery) && recovery > 0) {
        pendingBalance -= recovery;
        // Recovery is also income
        insertTx.run(dateStr, 'income', 'rent_recovery', recovery, rickshawId, driverId, 'Pending Rent Recovery');
        added++;
      }
    }
  }
}

db.prepare("UPDATE drivers SET pending_balance = ? WHERE id = ?").run(pendingBalance, driverId);

console.log(`Successfully added ${added} detailed transactions for Dec-Feb. Pending balance for Gujjar: ${pendingBalance}`);
