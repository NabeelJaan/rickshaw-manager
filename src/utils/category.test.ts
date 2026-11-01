import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { categoryName, categoryType } from './category';

test('category names normalize consistently across forms and API', () => {
  assert.equal(categoryName('  Engine   Oil  '), 'engine_oil');
  assert.equal(categoryName('Engine_Oil'), 'engine_oil');
  assert.equal(categoryName('  Tyre  '), 'tyre');
});
test('empty and invalid category inputs are rejected', () => {
  for (const value of ['', '  ', null, 123, 'a'.repeat(81)]) assert.throws(() => categoryName(value));
  assert.equal(categoryName('a'.repeat(80)).length, 80);
});
test('only income and expense categories are accepted', () => {
  assert.equal(categoryType('income'), 'income');
  assert.equal(categoryType('expense'), 'expense');
  for (const value of ['pending', '', null]) assert.throws(() => categoryType(value));
});
