export function customerCategory(product: { sub_category?: string | null; category?: string | null }): string {
  return product.sub_category?.trim() || product.category?.trim() || 'Lainnya';
}

export function normalizeCategoryOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

// Unconfigured/new categories remain visible, following their original order.
export function orderCustomerCategories(available: string[], configured: unknown): string[] {
  const categories = normalizeCategoryOrder(available);
  const preferred = normalizeCategoryOrder(configured).filter(category => categories.includes(category));
  return [...preferred, ...categories.filter(category => !preferred.includes(category))];
}

export function moveCustomerCategory(order: string[], category: string, direction: -1 | 1): string[] {
  const next = [...order];
  const index = next.indexOf(category);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}