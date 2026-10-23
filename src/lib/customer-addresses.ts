import { useEffect, useState } from 'react';

/** Saved delivery addresses live on the customer's device; the active one is mirrored to ACTIVE_KEY. */
export type SavedAddress = { id: string; label: string; address: string; lat?: number; lng?: number; note?: string };

const LIST_KEY = 'cx_addresses_v1';
export const ACTIVE_KEY = 'cx_delivery_address_v1';
const EVT = 'cx-addresses-change';

const read = <T,>(k: string, fb: T): T => {
  try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch { return fb; }
};

export function loadAddresses(): SavedAddress[] {
  const list = read<SavedAddress[]>(LIST_KEY, []);
  const active = read<SavedAddress | null>(ACTIVE_KEY, null);
  if (active && !list.length) {
    const seeded = { ...active, id: active.id || 'a' + Date.now() };
    localStorage.setItem(LIST_KEY, JSON.stringify([seeded]));
    return [seeded];
  }
  return list;
}

export function loadActiveAddress(): SavedAddress | null {
  return read<SavedAddress | null>(ACTIVE_KEY, null);
}

const emit = () => window.dispatchEvent(new Event(EVT));

export function saveAddresses(list: SavedAddress[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
  const active = loadActiveAddress();
  if (active && !list.some((a) => a.id === active.id)) {
    if (list[0]) localStorage.setItem(ACTIVE_KEY, JSON.stringify(list[0]));
    else localStorage.removeItem(ACTIVE_KEY);
  }
  emit();
}

export function setActiveAddress(a: SavedAddress) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
  emit();
}

export function upsertAddress(a: Omit<SavedAddress, 'id'> & { id?: string }, makeActive = false): SavedAddress {
  const list = loadAddresses();
  const item: SavedAddress = { ...a, id: a.id || 'a' + Date.now() } as SavedAddress;
  const next = list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  localStorage.setItem(LIST_KEY, JSON.stringify(next));
  if (makeActive || !loadActiveAddress()) localStorage.setItem(ACTIVE_KEY, JSON.stringify(item));
  emit();
  return item;
}

export function useAddresses() {
  const [list, setList] = useState<SavedAddress[]>(() => loadAddresses());
  const [active, setActive] = useState<SavedAddress | null>(() => loadActiveAddress());
  useEffect(() => {
    const h = () => { setList(loadAddresses()); setActive(loadActiveAddress()); };
    window.addEventListener(EVT, h);
    window.addEventListener('storage', h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener('storage', h); };
  }, []);
  return { list, active };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=id`);
    const j = await r.json();
    if (j?.display_name) return j.display_name;
  } catch { /* keep coords */ }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
