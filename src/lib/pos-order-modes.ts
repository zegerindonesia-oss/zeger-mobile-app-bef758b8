export interface OrderMode { id: string; label: string }

export const ALL_ORDER_MODES: OrderMode[] = [
  { id: 'dine_in', label: 'Dine In' },
  { id: 'take_away', label: 'Take Away' },
  { id: 'gofood', label: 'GoFood' },
  { id: 'grabfood', label: 'GrabFood' },
  { id: 'shopeefood', label: 'ShopeeFood' },
  { id: 'zeger_app', label: 'Zeger App' },
  { id: 'internal', label: 'Internal' },
];

export const EXTERNAL_MODES = ['gofood', 'grabfood', 'shopeefood'];
const KEY = 'pos_enabled_order_modes';

export const getEnabledModes = (): OrderMode[] => {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(ids) && ids.length) return ALL_ORDER_MODES.filter((m) => ids.includes(m.id));
  } catch { /* ignore */ }
  return ALL_ORDER_MODES.slice(0, 5);
};
export const setEnabledModes = (ids: string[]) => localStorage.setItem(KEY, JSON.stringify(ids));
export const modeLabel = (id: string) => ALL_ORDER_MODES.find((m) => m.id === id)?.label || id;
