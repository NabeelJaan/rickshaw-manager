// A leave day is any transaction marked as leave, including older notes
// ("leave" / "off") and the dedicated leave records created from the Add menu.

export function isLeaveTransaction(t: { notes?: string | null; category?: string | null; type?: string | null }): boolean {
  const category = String(t.category || '').toLowerCase();
  const type = String(t.type || '').toLowerCase();
  if (category === 'leave' || type === 'leave') return true;
  const notes = String(t.notes || '').toLowerCase();
  return notes.includes('leave') || notes.includes('off');
}

// Dedicated leave rows carry no money. A rent payment that merely mentions
// "leave" in the notes is still income and must stay in the money lists.
export function isDedicatedLeave(t: { category?: string | null; type?: string | null }): boolean {
  return String(t.category || '').toLowerCase() === 'leave' || String(t.type || '').toLowerCase() === 'leave';
}

export function leaveDayKey(date: string): string {
  const raw = String(date || '');
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw.slice(0, 10);
}

// One entry per calendar day, newest first. The same day is often written twice
// (a rent note plus a leave record); the day count should still be one.
export function uniqueLeaveDays<T extends { id?: number; date: string; notes?: string | null; category?: string | null; type?: string | null }>(rows: T[]): T[] {
  const sorted = rows.filter(isLeaveTransaction).sort((a, b) => {
    const byDate = leaveDayKey(b.date).localeCompare(leaveDayKey(a.date));
    if (byDate !== 0) return byDate;
    // Keep the dedicated leave row when a rent note on the same day also says "leave",
    // so removing it does not delete the rent payment.
    const byKind = Number(isDedicatedLeave(b)) - Number(isDedicatedLeave(a));
    if (byKind !== 0) return byKind;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
  const seen = new Set<string>();
  const days: T[] = [];
  for (const row of sorted) {
    const key = leaveDayKey(row.date);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    days.push(row);
  }
  return days;
}
