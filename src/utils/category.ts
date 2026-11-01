export function categoryName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Category name is required');
  const name = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (!name || name.length > 80) throw new Error('Category name must be between 1 and 80 characters');
  return name;
}
export function categoryType(value: unknown): 'income' | 'expense' {
  if (value !== 'income' && value !== 'expense') throw new Error('Choose income or expense');
  return value;
}
