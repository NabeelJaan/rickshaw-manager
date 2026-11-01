import type { Rickshaw, Transaction } from '../types';
import { isPendingTransaction } from './transactionStatus';

export function dailyPendingRows(rickshaws: Rickshaw[], transactions: Transaction[]) {
  const rows = new Map(rickshaws.map(r => [String(r.id), { key: String(r.id), number: r.number, cents: 0, drivers: new Set<string>() }]));
  for (const t of transactions) {
    if (!isPendingTransaction(t)) continue;
    const key = t.rickshaw_id == null ? 'unlinked' : String(t.rickshaw_id);
    const row = rows.get(key) || { key, number: t.rickshaw_id == null ? 'Unlinked rickshaw' : t.rickshaw_number || `Rickshaw #${t.rickshaw_id}`, cents: 0, drivers: new Set<string>() };
    row.cents += Math.round((Number(t.amount) || 0) * 100);
    if (t.driver_name) row.drivers.add(t.driver_name);
    rows.set(key, row);
  }
  return [...rows.values()].map(row => ({ key: row.key, number: row.number, amount: row.cents / 100, drivers: [...row.drivers].join(', ') }));
}
