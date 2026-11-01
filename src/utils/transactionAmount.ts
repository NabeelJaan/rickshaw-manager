// Resolve notes-based pending amounts consistently in both API implementations.
export function transactionAmount(amount: unknown, category: string, type: string, notes?: string): number {
  let value = Number(amount);
  if ((category === 'rent_pending' || type === 'pending') && !value && notes) {
    const match = notes.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/);
    if (match) value = Number(match[0].replace(/,/g, ''));
  }
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be a positive number');
  return Math.round(value * 100) / 100;
}
