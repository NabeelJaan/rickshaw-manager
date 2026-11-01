import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { transactionAmount } from './transactionAmount';

test('pending notes preserve decimal and thousands amounts', () => {
  assert.equal(transactionAmount(0, 'rent_pending', 'income', '1,500.50 pending'), 1500.5);
  assert.equal(transactionAmount('', 'other', 'pending', '500.75 pending'), 500.75);
  assert.equal(transactionAmount('250.25', 'rent_pending', 'income', '500 pending'), 250.25);
});
test('invalid amounts cannot corrupt balances', () => {
  for (const value of [-5, 'bad', Infinity, '', 0]) {
    assert.throws(() => transactionAmount(value, 'rent', 'income'));
  }
  assert.throws(() => transactionAmount(0, 'rent_pending', 'income', '-500 pending'));
  assert.equal(transactionAmount('100.10', 'rent', 'income'), 100.1);
});
