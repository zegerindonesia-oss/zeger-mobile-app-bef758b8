import cupIced from '@/assets/customer/cup-iced-3d.png';
import cupHot from '@/assets/customer/cup-hot-3d.png';
import bottle3d from '@/assets/customer/bottle-3d.png';
import bag3d from '@/assets/customer/bag-3d.png';
import coin3d from '@/assets/customer/coin-3d.png';
import scooter3d from '@/assets/customer/scooter-3d.png';
import gift3d from '@/assets/customer/gift-3d.png';
import crown3d from '@/assets/customer/crown-3d.png';

export const cxArt = {
  cupIced,
  cupHot,
  bottle: bottle3d,
  bag: bag3d,
  coin: coin3d,
  scooter: scooter3d,
  gift: gift3d,
  crown: crown3d,
};

/**
 * Picks the 3D artwork that best matches a menu item, used whenever a product
 * has no photo yet so the catalogue never shows an empty grey box.
 */
export function artworkFor(input?: { name?: string | null; category?: string | null } | null): string {
  const text = `${input?.category || ''} ${input?.name || ''}`.toLowerCase();
  if (/botol|bottle|liter|1lt|200\s?ml|330\s?ml|can\b/.test(text)) return bottle3d;
  if (/snack|roti|cake|pastry|makan|food|paket/.test(text)) return bag3d;
  if (/hot|panas|americano|espresso|long black|tubruk/.test(text)) return cupHot;
  return cupIced;
}

/** Fallback chain for any remote image that fails to load. */
export function onArtError(fallback: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.dataset.fallbackApplied === '1') return;
    el.dataset.fallbackApplied = '1';
    el.src = fallback;
  };
}

export const formatRupiah = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
