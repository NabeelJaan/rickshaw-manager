import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pendingSummary, PendingRecord } from './pendingLedger';
import { validatePendingRecord } from './pendingRecord';
const record = (month: string, amount: number, category: 'pending' | 'payment', driver_id = 1, rickshaw_id = 10): PendingRecord => ({ id: 1, month, date: month + '-01', amount, category, driver_id, rickshaw_id, driver_name: 'Driver', rickshaw_number: 'ABC', notes: '' });
test('rickshaw balance carries across months and driver switches', () => {
  const rows = [record('2026-09', 500, 'pending'), record('2026-10', 100, 'payment', 2), record('2026-10', 200, 'pending', 2), record('2026-11', 99, 'pending'), record('2026-10', 900, 'pending', 1, 20)];
  assert.deepEqual(pendingSummary(rows, '2026-10', '10'), { opening: 500, added: 200, recovered: 100, closing: 600 });
});
test('decimal balances use cents', () => {
  assert.equal(pendingSummary([record('2026-10', 0.1, 'pending'), record('2026-10', 0.2, 'pending')], '2026-10', '10').closing, 0.3);
});
test('register input validates month, date, amount and rickshaw', () => {
  const body = { date: '2026-10-15', month: '2026-09', category: 'pending', amount: 123.45, rickshaw_id: 10 };
  assert.equal(validatePendingRecord(body).month, '2026-09');
  for (const patch of [{ month: '2026-13' }, { date: '2026-02-30' }, { amount: -5 }, { rickshaw_id: '' }, { category: 'income' }]) assert.throws(() => validatePendingRecord({ ...body, ...patch }));
});
