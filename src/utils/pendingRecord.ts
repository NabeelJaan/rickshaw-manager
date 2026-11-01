export function validatePendingRecord(body: any) {
  const { date, month, category } = body;
  const amount = Number(body.amount);
  const rickshaw_id = Number(body.rickshaw_id);
  const driver_id = body.driver_id ? Number(body.driver_id) : null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('Choose a valid record month');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid date');
  if (!['pending', 'payment'].includes(category)) throw new Error('Invalid record type');
  if (!Number.isFinite(amount) || amount < 0.01) throw new Error('Amount must be positive');
  if (!Number.isSafeInteger(rickshaw_id) || rickshaw_id <= 0) throw new Error('Choose a rickshaw');
  if (driver_id !== null && (!Number.isSafeInteger(driver_id) || driver_id <= 0)) throw new Error('Invalid driver');
  return { date, month, category, amount: Math.round(amount * 100) / 100, rickshaw_id, driver_id, notes: String(body.notes || '').slice(0, 2000) };
}
