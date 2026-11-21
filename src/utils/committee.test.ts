import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { COMMITTEE_DEFAULT_AMOUNT, committeeMonthDays, validateCommitteeEntry } from './committee';

test('daily commetti defaults to 2000 and accepts a plain date', () => {
  assert.equal(COMMITTEE_DEFAULT_AMOUNT, 2000);
  assert.deepEqual(validateCommitteeEntry({ date: '2026-11-21', amount: '2000', notes: '  paid  ' }), {
    date: '2026-11-21', amount: 2000, notes: 'paid',
  });
});

test('invalid dates and amounts are rejected', () => {
  assert.throws(() => validateCommitteeEntry({ date: '2026-02-31', amount: 2000 }));
  assert.throws(() => validateCommitteeEntry({ date: '21-11-2026', amount: 2000 }));
  assert.throws(() => validateCommitteeEntry({ date: '2026-11-21', amount: 0 }));
});

test('month list is newest first and stops at today', () => {
  assert.deepEqual(committeeMonthDays('2026-11', '2026-11-03'), ['2026-11-03', '2026-11-02', '2026-11-01']);
  assert.equal(committeeMonthDays('2026-02', '2026-11-21').length, 28);
});
