export function monthlyProfit(row: { income: number; expense: number; pending?: number }) {
  const cents = (value: number | undefined) => Math.round((Number(value) || 0) * 100);
  const net = cents(row.income) - cents(row.expense);
  return { net: net / 100, includingPending: (net + cents(row.pending)) / 100 };
}
