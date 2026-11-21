export const COMMITTEE_DEFAULT_AMOUNT = 2000;

export interface CommitteeEntryInput {
  date: string;
  amount: number;
  notes: string;
}

export function validateCommitteeEntry(body: any): CommitteeEntryInput {
  const date = String(body?.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid date');
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error('Choose a valid date');
  }
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be positive');
  return { date, amount: Math.round(amount * 100) / 100, notes: String(body?.notes || '').trim().slice(0, 500) };
}

/** Calendar days in a month, newest first. Future days after `today` are left out. */
export function committeeMonthDays(month: string, today: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= last; d++) {
    const ymd = `${month}-${String(d).padStart(2, '0')}`;
    if (ymd > today) continue;
    days.push(ymd);
  }
  return days.reverse();
}
