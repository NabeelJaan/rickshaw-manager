import type { Transaction } from '../types';

export const isPendingTransaction = (transaction: Pick<Transaction, 'type' | 'category'>): boolean =>
  transaction.category === 'rent_pending' || transaction.type === 'pending';
