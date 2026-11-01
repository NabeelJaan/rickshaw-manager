import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { Rickshaw, Transaction } from '../types';
import { dailyPendingRows } from './dailyPending';
const fleet = [{ id: 1, number: 'A' }, { id: 2, number: 'B' }, { id: 3, number: 'C' }] as Rickshaw[];
const tx = (rickshaw_id: number | null, amount: number | string, category = 'rent_pending', type = 'income') => ({ rickshaw_id, amount, category, type, driver_id: 1, driver_name: 'Same driver' }) as Transaction;
test('all rickshaws appear and switched driver entries stay with their saved vehicle', () => {
  const rows = dailyPendingRows(fleet, [tx(1, '100.10'), tx(1, 0.2), tx(2, 50, 'other', 'pending'), tx(2, 999, 'rent')]);
  assert.deepEqual(rows.map(r => [r.number, r.amount]), [['A', 100.3], ['B', 50], ['C', 0]]);
});
test('unlinked and removed rickshaws remain visible in totals', () => {
  const rows = dailyPendingRows(fleet, [tx(null, 50), tx(99, 25)]);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 75);
  assert.equal(rows.find(r => r.key === 'unlinked')?.amount, 50);
  assert.equal(rows.find(r => r.key === '99')?.amount, 25);
});
