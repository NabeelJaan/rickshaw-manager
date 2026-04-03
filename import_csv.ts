import db from "./server/database";

const csvData = `October,,,,,,November,,,,,,December-25,,,,,,,January-26,,,,,,,Februry-26,,,,,
Date,Rent Paid,Rent Pending,Rickshaw Work,Net Profit,,Date,Rent Paid,Rent Pending,Rickshaw Work,Net Profit,,Date,Rent Paid,Rent Pending,Rickshaw Work,Net Profit,Remarks,,Date,Rent Paid,Rent Pending,Rickshaw Work,Net Profit,Remarks,,Date,Rent Paid,Rent Pending,Rickshaw Work,Net Profit,Remarks
1,,,,,,1,1000,,,,,1,1150,,1150,,Kamani work,,1,1000,,900,,,,1,1000,,,,
2,,,,,,2,1000,,,,,2,1000,,,,,,2,1000,,1200,,,,2,1000,,,,
3,,,,,,3,1000,,,,,3,0,,,,Leave,,3,1000,,,,,,3,1000,,,,
4,,,,,,4,1000,300,700,,,4,0,,,,Leave,,4,1000,,,,,,4,1000,,,,
5,1000,,,,,5,1000,,,,,5,0,,,,Leave,,5,1000,,,,,,5,1000,,1000,,Lota
6,1000,,,,,6,1000,,,,,6,0,,,,Leave,,6,500,,500,,Gotka,,6,1000,,,,
7,1000,,,,,7,1000,,,,,7,1000,,,,,,7,1000,,,,,,7,Leave,,,,
8,1000,,,,,8,1000,1000,,,,8,1000,1000,,,,,8,1000,,,,,,8,Leave,,,,
9,1000,,,,,9,1000,1000,,,,9,0,,,,,,9,1000,,,,,,9,1000,,,,
10,1000,500,,,,10,1000,,,,,10,1000,,,,,,10,800,,700,,,,10,1000,,,,
11,0,,700,,,11,1000,,,,,11,1000,,700,,,,11,1000,,,,,,11,1000,,,,
12,0,,,,,12,1000,,,,,12,1000,,,,,,12,1000,,,,,,12,1000,,,,
13,1000,,500,,,13,1000,,700,,,13,0,600,1950,,,,13,,,,,,,13,1000,,,,
14,1000,,,,,14,1000,,850,,,14,1000,,,,,,14,,,1500,,Oil pump ceil ,,14,Leave,,,,
15,1000,,,,,15,1000,,,,,15,1000,,,,,,15,,,,,,,15,1000,1000,4500,,
16,1000,,300,,,16,1000,300,,,,16,1000,,,,,,16,,,,,,,16,1000,1000,,,
17,1000,,,,,17,1000,,,,,17,1000,,,,,,17,3000,,,,,,17,1000,1000,,,
18,1000,,,,,18,1000,,,,,18,1000,,,,,,18,1000,,,,,,18,1000,100,800,,
19,1000,,700,,,19,0,,,,,19,1000,,,,,,19,1000,,1200,,Oil + Timing chain,,19,1000,1000,,,
20,1000,,,,,20,1000,,,,,20,1000,,,,,,20,,,,,,,20,1000,,800,,Oil
21,1000,,,,,21,1000,,,,,21,0,,,,,,21,,,,,,,21,1000,1000,,,
22,1000,,,,,22,1000,,1250,,,22,1000,,,,,,22,Leave,,,,New Driver,,22,1000,,300,,Plug
23,1000,,,,,23,1000,,,,,23,1000,,,,,,23,Leave,,,,,,23,1000,1000,,,
24,1000,,,,,24,1000,,,,,24,0,,,,,,24,Leave,,,,,,24,1000,500,,,
25,1000,,,,,25,1000,500,500,,,25,1000,,650,,,,25,Leave,,,,,,25,1000,,,,
26,0,,,,,26,1000,,,,,26,1000,,700,,,,26,Leave,,,,,,26,1000,1000,2500,,
27,1000,,,,,27,0,,,,,27,1000,500,,,,,27,Leave,,,,,,27,1000,,,,
28,1000,,,,,28,1000,,,,,28,1000,,,,,,28,1000,,,,,,28,1000,1000,,,
29,1000,,,,,29,1000,,400,,,29,0,,,,,,29,1000,,,,,,29,,,,,
30,1000,,700,,,30,1000,,700,,,30,0,,,,,,30,1000,,,,,,30,,,,,
31,1000,,,,,31,,,,,,31,1000,,1000,,,,31,1000,,,,,,31,,,,,`;

const lines = csvData.split('\n');
const dataLines = lines.slice(2, 33); // Days 1 to 31

const months = [
  { name: 'October', year: 2025, offset: 0, remarksOffset: -1 }, // No remarks col, use -1 to ignore
  { name: 'November', year: 2025, offset: 6, remarksOffset: -1 },
  { name: 'December', year: 2025, offset: 12, remarksOffset: 17 },
  { name: 'January', year: 2026, offset: 19, remarksOffset: 24 },
  { name: 'February', year: 2026, offset: 26, remarksOffset: 31 },
];

const rickshawId = 1; // BAB 2023
const driverId = 1; // Gujjar

// Reset current entries for this rickshaw
db.prepare("DELETE FROM transactions WHERE rickshaw_id = ?").run(rickshawId);

const insertTx = db.prepare("INSERT INTO transactions (date, type, category, amount, rickshaw_id, driver_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");

let added = 0;

for (const line of dataLines) {
  const cols = line.split(',');
  
  for (const month of months) {
    const dayStr = cols[month.offset];
    if (!dayStr || !dayStr.trim()) continue;
    
    const day = parseInt(dayStr.trim());
    if (isNaN(day)) continue;
    
    const dateStr = `${month.year}-${String(month.year === 2025 && month.name === 'October' ? 10 : month.year === 2025 && month.name === 'November' ? 11 : month.year === 2025 && month.name === 'December' ? 12 : month.year === 2026 && month.name === 'January' ? 1 : 2).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const rentPaidStr = cols[month.offset + 1];
    const rickshawWorkStr = cols[month.offset + 3];
    const remarks = month.remarksOffset !== -1 ? cols[month.remarksOffset] : '';
    
    // Check if it's "Leave"
    if (rentPaidStr === 'Leave' || rickshawWorkStr === 'Leave' || remarks === 'Leave') {
      // Maybe add a note or skip
      continue;
    }
    
    const rentPaid = parseFloat(rentPaidStr);
    const rickshawWork = parseFloat(rickshawWorkStr);
    
    if (!isNaN(rentPaid) && rentPaid > 0) {
      insertTx.run(dateStr, 'income', 'rent', rentPaid, rickshawId, driverId, remarks || null);
      added++;
    }
    
    if (!isNaN(rickshawWork) && rickshawWork > 0) {
      insertTx.run(dateStr, 'expense', 'maintenance', rickshawWork, rickshawId, driverId, remarks || null);
      added++;
    }
  }
}

console.log(`Successfully imported ${added} transactions for Rickshaw ${rickshawId} and Driver ${driverId}.`);
