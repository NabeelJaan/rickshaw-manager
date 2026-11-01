export interface PendingRecord {
  id: number;
  date: string;
  month: string;
  category: 'pending' | 'payment';
  amount: number;
  rickshaw_id: number;
  driver_id: number | null;
  rickshaw_number: string;
  driver_name: string;
  notes: string;
}
export const isPending = (t: PendingRecord) => t.category === 'pending';
export const isRecovery = (t: PendingRecord) => t.category === 'payment';
export function pendingSummary(records: PendingRecord[], month: string, rickshawId: string) {
  let opening = 0, added = 0, recovered = 0;
  for (const t of records) {
    if (String(t.rickshaw_id) !== rickshawId) continue;
    const amount = Math.round((Number(t.amount) || 0) * 100);
    const delta = isPending(t) ? amount : -amount;
    if (t.month < month) opening += delta;
    if (t.month === month) { if (isPending(t)) added += amount; else recovered += amount; }
  }
  return { opening: opening / 100, added: added / 100, recovered: recovered / 100, closing: (opening + added - recovered) / 100 };
}
