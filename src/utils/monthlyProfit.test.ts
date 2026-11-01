import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { monthlyProfit } from './monthlyProfit';
test('net profit deducts expenses and pending is added once', () => {
  assert.deepEqual(monthlyProfit({ income: 1000, expense: 300, pending: 200 }), { net: 700, includingPending: 900 });
});
test('losses, missing pending and decimal amounts are preserved', () => {
  assert.deepEqual(monthlyProfit({ income: 100, expense: 200 }), { net: -100, includingPending: -100 });
  assert.deepEqual(monthlyProfit({ income: 0.3, expense: 0.1, pending: 0.1 }), { net: 0.2, includingPending: 0.3 });
});
