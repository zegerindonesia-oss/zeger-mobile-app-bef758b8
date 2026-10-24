import { supabase } from '@/integrations/supabase/client';
import { ACTIVE_KEY } from '@/lib/customer-addresses';

export interface NearestOutlet { id: string; name: string; address: string; distance?: string }

const toRad = (v: number) => (v * Math.PI) / 180;
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getPosition = () =>
  new Promise<{ lat: number; lng: number } | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });

/** Picks the closest active outlet for the channel. Delivery prefers the saved delivery address. */
export async function findNearestOutlet(channel: string, mode: 'pickup' | 'delivery'): Promise<NearestOutlet | null> {
  let here: { lat: number; lng: number } | null = null;
  if (mode === 'delivery') {
    try {
      const a = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
      if (a?.lat && a?.lng) here = { lat: Number(a.lat), lng: Number(a.lng) };
    } catch { /* ignore */ }
  }
  const [pos, { data }] = await Promise.all([
    here ? Promise.resolve(here) : getPosition(),
    supabase.from('branches').select('id, name, address, latitude, longitude')
      .in('branch_type', ['hub', 'small']).eq('customer_channel', channel as any).eq('is_active', true).order('name'),
  ]);
  const rows = (data as any[]) || [];
  if (!rows.length) return null;
  const ranked = rows
    .map((o) => ({ ...o, d: pos && o.latitude && o.longitude ? distanceKm(pos.lat, pos.lng, o.latitude, o.longitude) : null }))
    .sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9));
  const best = ranked[0];
  if (best.d == null && rows.length > 1) return null; // no location: let the user choose
  return {
    id: best.id, name: best.name, address: best.address || '',
    distance: best.d != null ? `${best.d < 10 ? best.d.toFixed(1) : Math.round(best.d)}km` : undefined,
  };
}
