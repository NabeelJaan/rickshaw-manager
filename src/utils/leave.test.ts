import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isDedicatedLeave, isLeaveTransaction, uniqueLeaveDays } from './leave';

test('leave notes, off notes, and leave records all count as leave', () => {
  assert.equal(isLeaveTransaction({ notes: 'On Leave', category: 'rent', type: 'income' }), true);
  assert.equal(isLeaveTransaction({ notes: 'day off', category: 'rent', type: 'income' }), true);
  assert.equal(isLeaveTransaction({ notes: '', category: 'leave', type: 'leave' }), true);
  assert.equal(isLeaveTransaction({ notes: 'fuel top up', category: 'fuel', type: 'expense' }), false);
});

test('a rent note that mentions leave is not a dedicated leave record', () => {
  assert.equal(isDedicatedLeave({ type: 'leave', category: 'leave' }), true);
  assert.equal(isDedicatedLeave({ type: 'income', category: 'rent' }), false);
});

test('every leave day is kept, and the same day is counted once', () => {
  const recentRent = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    notes: 'rent',
    category: 'rent',
    type: 'income',
  }));
  const rows = [
    ...recentRent,
    { id: 100, date: '2026-11-02', notes: 'Leave', category: 'leave', type: 'leave' },
    { id: 101, date: '2026-11-02', notes: 'also leave', category: 'rent', type: 'income' },
    { id: 90, date: '2026-11-01T00:00:00.000Z', notes: 'off', category: 'rent', type: 'income' },
  ];
  const days = uniqueLeaveDays(rows);
  assert.deepEqual(days.map(d => d.date.slice(0, 10)), ['2026-11-02', '2026-11-01']);
  assert.equal(days[0].id, 100);
});
