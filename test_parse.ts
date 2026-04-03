import fs from 'fs';

const lines = fs.readFileSync('raw_data_waseem_abbass.txt', 'utf8').split('\n');

for (let i = 1; i <= 31; i++) {
  const line = lines[i - 1];
  if (!line) continue;
  
  const parts = line.split(new RegExp(`\\b${i}\\b`));
  console.log(`Day ${i}:`, parts.map(p => p.trim()));
}
