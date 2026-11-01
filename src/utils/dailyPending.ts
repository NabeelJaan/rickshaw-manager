import type { Rickshaw, Transaction } from '../types';
import { isPendingTransaction } from './transactionStatus';

export function dailyPendingRows(rickshaws: Rickshaw[], transactions: Transaction[], date: string) {
  const rows = new Map<string, { key: string; number: string; cents: number; drivers: string }>();
  for (const t of transactions) {
    if (t.date?.slice(0, 10) !== date || !isPendingTransaction(t)) continue;
    const amount = Number(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = `${t.rickshaw_id ?? 'unlinked'}:${t.driver_id ?? t.driver_name ?? 'unknown'}`;
    const number = rickshaws.find(r => String(r.id) === String(t.rickshaw_id))?.number
      || t.rickshaw_number || (t.rickshaw_id == null ? 'Unlinked rickshaw' : `Rickshaw #${t.rickshaw_id}`);
    const row = rows.get(key) || { key, number, cents: 0, drivers: t.driver_name || 'Unknown driver' };
    row.cents += Math.round(amount * 100);
    rows.set(key, row);
  }
  return [...rows.values()].filter(row => row.cents > 0).map(row => ({ key: row.key, number: row.number, amount: row.cents / 100, drivers: row.drivers }));
}
