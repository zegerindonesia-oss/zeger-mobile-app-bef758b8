/** Active cashier (signed in with PIN) per branch, kept on this device. */
export type ActiveCashier = { id: string; name: string; at: number };
const key = (b: string | null) => `pos_active_cashier_${b || 'none'}`;

export const getActiveCashier = (branchId: string | null): ActiveCashier | null => {
  try { return JSON.parse(localStorage.getItem(key(branchId)) || 'null'); } catch { return null; }
};
export const setActiveCashier = (branchId: string | null, c: ActiveCashier | null) => {
  if (c) localStorage.setItem(key(branchId), JSON.stringify(c));
  else localStorage.removeItem(key(branchId));
  window.dispatchEvent(new Event('pos-cashier-changed'));
};
