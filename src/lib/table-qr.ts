// Smart hybrid table QR: one URL works for app users and walk-in web orders.
export const PUBLIC_ORIGIN = 'https://flowfnb.flowsstack.com';
export const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.zeger.customer';

export const tableQrUrl = (branchId: string, tableNumber: string) =>
  `${PUBLIC_ORIGIN}/table?b=${encodeURIComponent(branchId)}&t=${encodeURIComponent(tableNumber)}`;

export interface TableContext {
  branchId: string;
  branchName: string;
  branchAddress: string;
  table: string;
  at: number;
}

const KEY = 'cx_table_ctx_v1';
const TTL = 4 * 60 * 60 * 1000; // a dine-in visit lasts at most a few hours

export const saveTableContext = (c: Omit<TableContext, 'at'>) =>
  sessionStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() }));

export const readTableContext = (): TableContext | null => {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!c || Date.now() - c.at > TTL) return null;
    return c;
  } catch {
    return null;
  }
};

export const clearTableContext = () => sessionStorage.removeItem(KEY);
