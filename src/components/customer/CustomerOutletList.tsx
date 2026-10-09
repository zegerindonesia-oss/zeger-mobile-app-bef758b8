import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MapPin, Navigation, Phone, Search, Store, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  distance?: number | null;
}

interface CustomerOutletListProps {
  onNavigate: (view: string) => void;
  onSelectOutlet?: (outlet: { id: string; name: string; address: string }) => void;
  channel?: 'branch' | 'street';
  orderMode?: 'pickup' | 'delivery';
}

const toRad = (v: number) => (v * Math.PI) / 180;
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function CustomerOutletList({ onNavigate, onSelectOutlet, channel = 'branch', orderMode = 'pickup' }: CustomerOutletListProps) {
  const [outlets, setOutlets] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoDenied(true); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('branches')
        .select('id, name, address, latitude, longitude, phone')
        .in('branch_type', ['hub', 'small'])
        .eq('customer_channel', channel)
        .eq('is_active', true)
        .order('name');
      if (alive) { setOutlets((data as Branch[]) || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [channel]);

  const open = useMemo(() => {
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));
    return h >= 7 && h < 21;
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return outlets
      .map((o) => ({
        ...o,
        distance: here && o.latitude && o.longitude ? distanceKm(here.lat, here.lng, o.latitude, o.longitude) : null,
      }))
      .filter((o) => !q || o.name.toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q))
      .sort((a, b) => (a.distance ?? 9e9) - (b.distance ?? 9e9));
  }, [outlets, here, query]);

  const title = channel === 'street' ? 'Zeger On The Street' : 'Zeger Branch';

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      <header className="cx-bar sticky top-0 z-20 px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('home')} aria-label="Kembali" className="cx-icon-btn h-10 w-10 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {orderMode === 'delivery' ? 'Diantar ke lokasimu' : 'Ambil sendiri di outlet'} · Pilih outlet
            </p>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', open ? 'bg-emerald-50 text-emerald-600' : 'bg-zeger-soft text-zeger')}>
            {open ? 'Buka' : 'Tutup'}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama outlet atau area"
            className="h-11 w-full rounded-2xl border border-[hsl(var(--cx-line))] bg-white pl-11 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-zeger focus:shadow-[0_0_0_4px_hsl(var(--zeger)/0.12)]"
          />
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="flex items-start gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-xs text-muted-foreground shadow-[0_1px_2px_hsl(var(--cx-shadow)/0.05)]">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zeger" />
          <span>
            Jam operasional 07.00 – 21.00 WIB.
            {geoDenied ? ' Aktifkan lokasi untuk melihat jarak outlet.' : here ? ' Diurutkan dari yang terdekat denganmu.' : ' Mencari lokasimu…'}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="cx-shimmer h-[116px] rounded-[22px]" />)
        ) : list.length === 0 ? (
          <div className="cx-card flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
            <Store className="h-12 w-12 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Outlet belum tersedia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {query ? 'Coba kata kunci lain.' : `Belum ada outlet untuk layanan ${title}.`}
            </p>
            <button onClick={() => onNavigate('home')} className="cx-btn cx-btn-ghost mt-4 px-5 py-2 text-sm">Kembali ke beranda</button>
          </div>
        ) : (
          list.map((o) => (
            <button
              key={o.id}
              disabled={!open}
              onClick={() => {
                onSelectOutlet?.({ id: o.id, name: o.name, address: o.address || '' });
                onNavigate('menu');
              }}
              className={cn(
                'cx-card w-full rounded-[22px] p-4 text-left transition-transform',
                open ? 'active:scale-[0.985]' : 'opacity-60',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="cx-stage flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-zeger">
                  <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{o.name}</p>
                  {o.address && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{o.address}</p>}
                  {o.phone && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Phone className="h-3 w-3" /> {o.phone}
                    </p>
                  )}
                </div>
                {o.distance !== null && o.distance !== undefined && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zeger-soft px-2.5 py-1 text-[11px] font-bold text-zeger">
                    <Navigation className="h-3 w-3" />
                    {o.distance < 1 ? `${Math.round(o.distance * 1000)} m` : `${o.distance.toFixed(1)} km`}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-[hsl(var(--cx-line))] pt-3">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {orderMode === 'delivery' ? 'Siap antar' : 'Siap ambil'}
                </span>
                <span className={cn('cx-btn px-5 py-1.5 text-xs', open ? 'cx-btn-primary' : 'cx-btn-ghost')}>
                  {open ? 'Pilih outlet' : 'Tutup'}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default CustomerOutletList;
