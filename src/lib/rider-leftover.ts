import { buildShiftPicker, shiftTimeMs, type ShiftLike } from './shift-cycle';

export interface LeftoverMovement<Product> {
  product_id: string;
  quantity: number;
  notes?: string | null;
  created_at: string;
  products?: Product | null;
}
export interface LeftoverWaste { product_id: string; quantity: number; created_at: string }

/** Return submission time owns the stock cycle; Hub verification only supplies the final quantity. */
export function latestShiftLeftover<Product extends { name?: string }>(
  shifts: ShiftLike[], movements: LeftoverMovement<Product>[], waste: LeftoverWaste[],
) {
  const pick = buildShiftPicker(shifts);
  const withReturns = shifts.filter(s => movements.some(m => pick(s.rider_id, m.created_at)?.id === s.id));
  withReturns.sort((a, b) => b.shift_date.localeCompare(a.shift_date)
    || (shiftTimeMs(b.shift_start_time, b.shift_date) ?? 0) - (shiftTimeMs(a.shift_start_time, a.shift_date) ?? 0)
    || (b.shift_number ?? 0) - (a.shift_number ?? 0));
  const shift = withReturns[0];
  if (!shift) return null;
  const items: Record<string, { qty: number; name: string; product: Product | null | undefined }> = {};
  const unverified: Record<string, number> = {};
  for (const m of movements) {
    if (pick(shift.rider_id, m.created_at)?.id !== shift.id) continue;
    const item = items[m.product_id] ?? { qty: 0, name: m.products?.name ?? '', product: m.products };
    const verified = /Verified quantity:\s*(\d+)/i.exec(m.notes ?? '');
    item.qty += verified ? Number(verified[1]) : Number(m.quantity || 0);
    if (!verified) unverified[m.product_id] = (unverified[m.product_id] ?? 0) + Number(m.quantity || 0);
    items[m.product_id] = item;
  }
  for (const w of waste) {
    if (pick(shift.rider_id, w.created_at)?.id !== shift.id) continue;
    const item = items[w.product_id];
    const deduction = Math.min(unverified[w.product_id] ?? 0, Math.max(0, Number(w.quantity || 0)));
    if (!item || !deduction) continue;
    item.qty = Math.max(0, item.qty - deduction);
    unverified[w.product_id] -= deduction;
  }
  for (const id of Object.keys(items)) if (items[id].qty <= 0) delete items[id];
  // An empty final shift must not resurrect stock from an older shift.
  return { shift, items };
}