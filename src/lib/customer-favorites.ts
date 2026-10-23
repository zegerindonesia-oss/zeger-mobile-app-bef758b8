import { useCallback, useEffect, useState } from 'react';

const KEY = 'cx_favorites_v1';
const EVT = 'cx-favorites-change';

export function readFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(readFavorites);
  useEffect(() => {
    const on = () => setIds(readFavorites());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on); };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = readFavorites();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { ids, isFav: (id: string) => ids.includes(id), toggle };
}
