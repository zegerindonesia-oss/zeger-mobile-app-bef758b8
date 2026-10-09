import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Navigation, Loader2, AlertCircle, RefreshCw, Heart, MessageCircle, Bike } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildMapsScriptUrl, getGoogleMapsKey } from '@/config/maps';
import { artworkFor, cxArt, formatRupiah, onArtError } from '@/lib/customer-art';

interface StockItem {
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
  custom_options?: any;
}

interface Rider {
  id: string;
  full_name: string;
  distance_km: number;
  eta_minutes: number;
  rating: number;
  phone: string;
  total_stock: number;
  stock_items?: StockItem[];
  lat: number | null;
  lng: number | null;
  last_updated: string | null;
  is_online: boolean;
  is_shift_active: boolean;
  has_gps?: boolean;
  location_source?: 'checkpoint' | 'gps' | 'branch' | 'none';
  checkpoint_name?: string | null;
  checkpoint_time?: string | null;
  branch_name?: string;
  branch_address?: string;
  photo_url?: string;
}

interface CustomerMapProps {
  customerUser?: any;
  onCallRider?: (orderId: string, rider: Rider) => void;
}

const DISTANCE_OPTIONS = [5, 3, 1.5] as const;

const buildPinIcon = (selected: boolean) => {
  const size = selected ? 56 : 42;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
  <defs><filter id="s" x="-20%" y="-10%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.35"/></filter></defs>
  <path filter="url(#s)" d="M20 1C10 1 2 9 2 19c0 13.5 18 31 18 31s18-17.5 18-31C38 9 30 1 20 1z" fill="#EA2831" stroke="#ffffff" stroke-width="2"/>
  <circle cx="20" cy="19" r="7" fill="#ffffff"/>
</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: size, height: size * 1.3 },
    anchor: { x: size / 2, y: size * 1.3 },
  };
};

const CustomerMap = ({ customerUser, onCallRider }: CustomerMapProps = {}) => {
  const [nearbyRiders, setNearbyRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapsKeyMissing, setMapsKeyMissing] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [focusedRiderId, setFocusedRiderId] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Record<string, any>>({});
  const riderCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    getUserLocation();
    try {
      const stored = JSON.parse(localStorage.getItem('zeger-fav-riders') || '[]');
      setFavorites(new Set(stored));
    } catch {}
    return () => {
      Object.values(markers.current).forEach((m: any) => m.setMap && m.setMap(null));
      markers.current = {};
    };
  }, []);

  useEffect(() => {
    if (!userLocation || !mapContainer.current || map.current) return;
    setMapError(null);
    loadGoogleMaps().then(initializeMap).catch(err => {
      console.error('Google Maps gagal dimuat:', err);
      const message = err instanceof Error ? err.message : 'Gagal memuat peta';
      setMapError(message);
    });
  }, [userLocation]);

  useEffect(() => {
    if (!map.current || !(window as any).google?.maps || !userLocation) return;
    Object.values(markers.current).forEach((m: any) => m.setMap(null));
    markers.current = {};
    const google = (window as any).google;
    filteredRiders.forEach(rider => {
      if (!rider.lat || !rider.lng) return;
      const isSelected = focusedRiderId === rider.id;
      const icon = buildPinIcon(isSelected);
      const marker = new google.maps.Marker({
        position: { lat: rider.lat, lng: rider.lng },
        map: map.current,
        title: rider.full_name,
        icon: {
          url: icon.url,
          scaledSize: new google.maps.Size(icon.scaledSize.width, icon.scaledSize.height),
          anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y),
        },
        zIndex: isSelected ? 999 : 1,
      });
      marker.addListener('click', () => {
        setFocusedRiderId(rider.id);
        const el = riderCardRefs.current[rider.id];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      markers.current[rider.id] = marker;
    });
  }, [nearbyRiders, radiusKm, userLocation, focusedRiderId]);

  const focusRiderOnMap = (rider: Rider) => {
    setFocusedRiderId(rider.id);
    if (rider.lat && rider.lng && map.current) {
      map.current.panTo({ lat: rider.lat, lng: rider.lng });
      map.current.setZoom(Math.max(map.current.getZoom() || 14, 15));
    }
  };

  const loadGoogleMaps = async (): Promise<void> => {
    const key = await getGoogleMapsKey();
    if (!key) {
      setMapsKeyMissing(true);
      throw new Error('Google Maps browser key belum aktif. Reconnect Google Maps Platform connector atau refresh environment project.');
    }
    setMapsKeyMissing(false);
    if ((window as any).google?.maps?.Map) return;
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-zeger-google-maps="true"]');
    if (!existingScript) {
      const callbackName = 'zegerGoogleMapsReady';
      const callbackReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Google Maps timeout. Coba refresh halaman atau reconnect Google Maps connector.')), 15000);
        (window as any)[callbackName] = () => {
          window.clearTimeout(timeout);
          resolve();
        };
      });
      const script = document.createElement('script');
      script.src = buildMapsScriptUrl({ libraries: 'places', callback: callbackName });
      script.async = true;
      script.defer = true;
      script.dataset.zegerGoogleMaps = 'true';
      script.onerror = () => {
        setMapError('Google Maps gagal load. Pastikan Maps JavaScript API aktif dan domain preview diizinkan.');
      };
      document.head.appendChild(script);
      await callbackReady;
    }
    // With loading=async, google.maps.Map is not available at script load time.
    // Use importLibrary which resolves when the maps library is ready.
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const g = (window as any).google;
        if (g?.maps?.importLibrary) return resolve();
        if (Date.now() - start > 15000) return reject(new Error('Google Maps timeout. Coba refresh halaman atau reconnect Google Maps connector.'));
        setTimeout(tick, 100);
      };
      tick();
    });
    await (window as any).google.maps.importLibrary('maps');
    await (window as any).google.maps.importLibrary('marker');
  };

  const initializeMap = () => {
    if (!mapContainer.current || !userLocation) return;
    const google = (window as any).google;
    map.current = new google.maps.Map(mapContainer.current, {
      center: userLocation,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    });
    new google.maps.Marker({
      position: userLocation,
      map: map.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 4,
      },
    });
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      const fallback = { lat: -7.4478, lng: 112.7183 }; // Sidoarjo fallback
      setUserLocation(fallback);
      fetchNearbyRiders(fallback.lat, fallback.lng);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        fetchNearbyRiders(loc.lat, loc.lng);
      },
      () => {
        const fallback = { lat: -7.4478, lng: 112.7183 };
        setUserLocation(fallback);
        fetchNearbyRiders(fallback.lat, fallback.lng);
        toast.error('Tidak dapat mengakses lokasi Anda');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchNearbyRiders = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-nearby-riders', {
        body: { customer_lat: lat, customer_lng: lng, radius_km: 50 }
      });
      if (error) throw error;
      setNearbyRiders(data.riders || []);
      setMapError(null);
    } catch (e: any) {
      setMapError('Gagal memuat rider terdekat');
      toast.error('Gagal memuat rider');
    } finally {
      setLoading(false);
    }
  };

  const filteredRiders = useMemo(
    () => nearbyRiders.filter(r => r.lat === null || r.lng === null || r.distance_km <= radiusKm),
    [nearbyRiders, radiusKm]
  );

  const toggleFav = (riderId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(riderId) ? next.delete(riderId) : next.add(riderId);
      localStorage.setItem('zeger-fav-riders', JSON.stringify([...next]));
      return next;
    });
  };

  const openWhatsApp = (phone: string, name: string) => {
    if (!phone) return toast.error('Nomor rider tidak tersedia');
    const clean = phone.replace(/[^0-9]/g, '').replace(/^0/, '62');
    const text = encodeURIComponent(`Halo ${name}, saya ingin memesan.`);
    // Try native WhatsApp scheme first (works on mobile even if wa.me is blocked)
    const waScheme = `whatsapp://send?phone=${clean}&text=${text}`;
    const waWeb = `https://wa.me/${clean}?text=${text}`;
    const win = window.open(waScheme, '_blank');
    // Fallback to web link if scheme not handled
    setTimeout(() => {
      try { if (!win || win.closed) window.location.href = waWeb; } catch { window.location.href = waWeb; }
    }, 400);
  };

  const openDirection = (rider: Rider) => {
    if (!rider.lat || !rider.lng) return toast.error('Lokasi rider tidak tersedia');
    const destination = encodeURIComponent(`${rider.lat},${rider.lng}`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    // A new tab opened from Lovable's preview inherits the iframe sandbox and
    // Google rejects it. Target the top browsing context from this user click
    // so the universal URL can be handed directly to Google Maps.
    try {
      if (window.top && window.top !== window) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_top';
        link.rel = 'external';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
    } catch (error) {
      console.warn('Top-level Google Maps navigation was blocked:', error);
    }

    window.location.href = url;
  };

  const statusLabel = (r: Rider) => {
    if (r.location_source === 'checkpoint') return { text: 'On Location', color: 'bg-green-500' };
    if (r.total_stock > 0) return { text: 'Siap menerima order', color: 'bg-green-500' };
    return { text: 'Tidak tersedia', color: 'bg-gray-400' };
  };

  return (
    <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))] pb-6">
      {/* Hero */}
      <div className="cx-stage relative overflow-hidden bg-gradient-to-br from-zeger-dark to-zeger px-5 pb-24 pt-7">
        <div className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          <Bike className="h-3.5 w-3.5" /> Zeger On The Wheels
        </span>
        <h1 className="relative mt-3 max-w-[64%] text-2xl font-extrabold leading-tight text-white">
          Kopi favoritmu, antar sampai titikmu
        </h1>
        <img src={cxArt.scooter} alt="" className="cx-art cx-float pointer-events-none absolute -bottom-2 right-2 h-28 w-auto opacity-95" />
      </div>

      {/* Greeting card */}
      <div className="relative z-10 mx-5 -mt-14 mb-4">
        <div className="cx-card cx-rise flex items-center gap-3 rounded-[24px] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zeger-soft text-sm font-extrabold text-zeger">
            {(customerUser?.name || 'G').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">Hai, {(customerUser?.name || 'Guest')}</p>
            <p className="truncate text-[11px] text-muted-foreground">Pilih rider terdekat untuk pesananmu</p>
          </div>
        </div>
      </div>

      {/* Distance filter */}
      <div className="mb-4 px-5">
        <div className="cx-seg flex">
          {DISTANCE_OPTIONS.map(km => (
            <button
              key={km}
              onClick={() => setRadiusKm(km)}
              data-active={radiusKm === km}
              className="cx-seg-item flex-1 py-2.5 text-xs font-bold"
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      {/* Section title + refresh */}
      <div className="mb-3 flex items-center justify-between px-5">
        <h2 className="text-base font-extrabold">Temukan rider-mu</h2>
        <button
          onClick={() => userLocation && fetchNearbyRiders(userLocation.lat, userLocation.lng)}
          className="cx-icon-btn h-10 w-10"
          aria-label="Muat ulang"
        >
          <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Map */}
      <div className="mb-4 px-5">
        <div className="cx-card relative overflow-hidden rounded-[26px] p-0">
          <div ref={mapContainer} className="h-60 w-full bg-[hsl(var(--cx-rail))]" />
          {mapsKeyMissing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-8 text-center">
              <MapPin className="mb-3 h-9 w-9 text-zeger" />
              <p className="text-sm font-extrabold">Peta belum aktif</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Rider tetap bisa dipilih dari daftar di bawah.
              </p>
            </div>
          ) : mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-8 text-center">
              <AlertCircle className="mb-3 h-9 w-9 text-zeger" />
              <p className="text-sm font-extrabold">Peta gagal dimuat</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{mapError}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Rider cards */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-zeger" />
          <p className="text-xs font-semibold text-muted-foreground">Mencari rider terdekat…</p>
        </div>
      ) : filteredRiders.length === 0 ? (
        <div className="mx-5 rounded-[26px] bg-[hsl(var(--cx-rail))] py-10 text-center">
          <MapPin className="mx-auto mb-2 h-9 w-9 text-muted-foreground/50" />
          <p className="text-sm font-bold">Belum ada rider dalam {radiusKm} km</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Coba perluas jangkauan pencarian</p>
        </div>
      ) : (
        <div className="space-y-3 px-5">
          {filteredRiders.map(rider => {
            const status = statusLabel(rider);
            const isFav = favorites.has(rider.id);
            const isFocused = focusedRiderId === rider.id;
            const subtitle = rider.location_source === 'checkpoint'
              ? (rider.checkpoint_name || 'On Location')
              : rider.location_source === 'branch'
                ? `Siap menerima order • Lokasi sementara: ${rider.branch_name || 'Branch'}`
                : 'Siap menerima order • Lokasi belum tersedia';
            return (
              <div
                key={rider.id}
                ref={(el) => { riderCardRefs.current[rider.id] = el; }}
                className={`cx-card cx-rise flex items-center gap-3 rounded-[24px] p-3.5 transition-all active:scale-[0.99] ${
                  isFocused ? 'ring-2 ring-zeger/35' : ''
                }`}
                onClick={() => focusRiderOnMap(rider)}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-zeger-soft shadow-md ring-2 ring-white">
                    {rider.photo_url ? (
                      <img src={rider.photo_url} alt={rider.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-extrabold text-zeger">{rider.full_name.charAt(0)}</span>
                    )}
                  </div>
                  <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white ${status.color}`} />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{rider.full_name}</p>
                      <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(rider.id); }}
                      className="flex-shrink-0 transition active:scale-90"
                      aria-label="Favorit"
                    >
                      <Heart className={`h-5 w-5 ${isFav ? 'fill-zeger text-zeger' : 'text-muted-foreground/50'}`} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {rider.lat !== null && rider.lng !== null && (
                        <span className="cx-num rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          {rider.distance_km.toFixed(2)} km
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(rider.phone, rider.full_name); }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition active:scale-90"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDirection(rider); }}
                        disabled={rider.lat === null || rider.lng === null}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-zeger text-white shadow-sm transition active:scale-90 disabled:opacity-40"
                        aria-label="Rute"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedRider(rider); }}
                      className="cx-btn cx-btn-primary px-4 py-2 text-[11px]"
                    >
                      Lihat stok
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rider detail bottom sheet */}
      <Sheet open={!!selectedRider} onOpenChange={(o) => !o && setSelectedRider(null)}>
        <SheetContent side="bottom" className="cx-app h-[92vh] overflow-hidden rounded-t-[30px] p-0">
          {selectedRider && <RiderDetailSheet
            rider={selectedRider}
            isFav={favorites.has(selectedRider.id)}
            onToggleFav={() => toggleFav(selectedRider.id)}
            onClose={() => setSelectedRider(null)}
            onWhatsApp={() => openWhatsApp(selectedRider.phone, selectedRider.full_name)}
            onDirection={() => openDirection(selectedRider)}
          />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

function RiderDetailSheet({
  rider, isFav, onToggleFav, onClose, onWhatsApp, onDirection,
}: {
  rider: Rider;
  isFav: boolean;
  onToggleFav: () => void;
  onClose: () => void;
  onWhatsApp: () => void;
  onDirection: () => void;
}) {
  const subtitle = rider.location_source === 'checkpoint'
    ? (rider.checkpoint_name || 'On Location')
    : rider.location_source === 'branch'
      ? `Siap menerima order • Lokasi sementara: ${rider.branch_name || 'Branch'}`
      : 'Siap menerima order • Lokasi belum tersedia';
  const stock = rider.stock_items || [];
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--cx-canvas))]">
      {/* Header */}
      <div className="cx-stage relative h-32 flex-shrink-0 overflow-hidden bg-gradient-to-br from-zeger-dark to-zeger">
        <button
          onClick={onClose}
          className="cx-icon-btn absolute left-4 top-4 z-10 h-10 w-10"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={cxArt.scooter} alt="" className="cx-art cx-float absolute right-4 top-3 h-24 w-auto" />
      </div>

      {/* Rider info card */}
      <div className="relative z-10 mx-4 -mt-12">
        <div className="cx-card cx-rise rounded-[26px] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zeger-soft shadow-lg ring-2 ring-white">
              {rider.photo_url ? (
                <img src={rider.photo_url} alt={rider.full_name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-zeger">{rider.full_name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold">{rider.full_name}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
                </div>
                <button onClick={onToggleFav} aria-label="Favorit" className="transition active:scale-90">
                  <Heart className={`h-6 w-6 ${isFav ? 'fill-zeger text-zeger' : 'text-muted-foreground/50'}`} />
                </button>
              </div>
              {rider.lat !== null && rider.lng !== null && (
                <span className="cx-num mt-1.5 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  {rider.distance_km.toFixed(2)} km dari kamu
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={onWhatsApp}
              className="cx-btn cx-btn-ghost h-12 w-12 flex-shrink-0 rounded-full p-0 text-emerald-600"
              aria-label="WhatsApp"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              onClick={onDirection}
              disabled={rider.lat === null || rider.lng === null}
              className="cx-btn cx-btn-primary h-12 flex-1 text-xs"
            >
              <Navigation className="h-4 w-4" /> Lihat rute
            </button>
          </div>
        </div>
      </div>

      {/* Stock list */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-5">
        <h3 className="mb-3 text-base font-extrabold">Stok rider</h3>
        {stock.length === 0 ? (
          <div className="rounded-[22px] bg-[hsl(var(--cx-rail))] py-8 text-center text-xs font-semibold text-muted-foreground">
            Belum ada data stok dari rider ini.
          </div>
        ) : (
          <div className="space-y-3">
            {stock.map(item => {
              const qty = item.stock_quantity;
              const outOfStock = qty <= 0;
              const low = qty > 0 && qty < 5;
              const art = artworkFor({ name: item.name, category: item.category });
              return (
                <button
                  key={item.product_id}
                  onClick={() => setSelectedProduct(item)}
                  className={`cx-card flex w-full gap-3 rounded-[24px] p-3 text-left transition active:scale-[0.98] ${outOfStock ? 'opacity-65' : ''}`}
                >
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-[18px] bg-[hsl(var(--cx-rail))]">
                    <img
                      src={item.image_url || art}
                      onError={onArtError(art)}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold leading-tight">{item.name}</p>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.description}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="cx-num text-sm font-bold text-zeger">{formatRupiah(item.price)}</p>
                      {outOfStock ? (
                        <span className="rounded-full bg-[hsl(var(--cx-rail))] px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Stok habis</span>
                      ) : low ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Sisa {qty}</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Stok {qty}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Detail Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={(o) => !o && setSelectedProduct(null)}>
        <SheetContent side="bottom" className="cx-app h-[92vh] overflow-hidden rounded-t-[30px] p-0">
          {selectedProduct && (
            <ProductDetailView product={selectedProduct} onClose={() => setSelectedProduct(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FlavorDots({ label, level }: { label: string; level: number }) {
  return (
    <tr>
      <td className="whitespace-nowrap py-1 pr-2 text-[11px] font-semibold text-muted-foreground">{label}</td>
      <td className="py-1">
        <div className="flex justify-end gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full border ${i <= level ? 'border-zeger bg-zeger' : 'border-[hsl(var(--cx-line))] bg-white'}`}
            />
          ))}
        </div>
      </td>
    </tr>
  );
}

function deriveFlavor(product: StockItem): { coffee: number; creaminess: number; sweetness: number } {
  // Priority: custom_options.flavor { coffee, creaminess, sweetness }
  const opts = (product.custom_options || {}) as any;
  const f = opts.flavor || opts.flavor_profile || {};
  if (typeof f.coffee === 'number' || typeof f.creaminess === 'number' || typeof f.sweetness === 'number') {
    return {
      coffee: Math.max(0, Math.min(5, Number(f.coffee ?? 3))),
      creaminess: Math.max(0, Math.min(5, Number(f.creaminess ?? 3))),
      sweetness: Math.max(0, Math.min(5, Number(f.sweetness ?? 3))),
    };
  }
  // Heuristic based on product name
  const n = product.name.toLowerCase();
  let coffee = 3, creaminess = 3, sweetness = 3;
  if (n.includes('americano') || n.includes('espresso')) { coffee = 5; creaminess = 1; sweetness = 1; }
  else if (n.includes('classic latte')) { coffee = 4; creaminess = 3; sweetness = 2; }
  else if (n.includes('aren')) { coffee = 3; creaminess = 3; sweetness = 5; }
  else if (n.includes('caramel mocha')) { coffee = 4; creaminess = 3; sweetness = 4; }
  else if (n.includes('creamy latte') || n.includes('butterschoot') || n.includes('baileys') || n.includes('dolce')) { coffee = 3; creaminess = 5; sweetness = 4; }
  else if (n.includes('matcha')) { coffee = 0; creaminess = 4; sweetness = 3; }
  else if (n.includes('chocomalt') || n.includes('choco')) { coffee = 1; creaminess = 4; sweetness = 4; }
  else if (n.includes('honey')) { coffee = 3; creaminess = 3; sweetness = 4; }
  return { coffee, creaminess, sweetness };
}

function ProductDetailView({ product, onClose }: { product: StockItem; onClose: () => void }) {
  const flavor = deriveFlavor(product);
  const art = artworkFor({ name: product.name, category: product.category });
  const outOfStock = product.stock_quantity <= 0;

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--cx-canvas))]">
      {/* Header with artwork */}
      <div className="cx-stage relative flex-shrink-0 overflow-hidden bg-gradient-to-br from-zeger-dark to-zeger pb-10 pt-4">
        <div className="relative z-10 flex items-center justify-between px-4">
          <button onClick={onClose} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-extrabold text-white">Detail Menu</h2>
          <span className="w-10" />
        </div>
        <div className="relative z-10 mt-2 flex justify-center">
          <img
            src={product.image_url || art}
            onError={onArtError(art)}
            alt={product.name}
            className="cx-art cx-float h-52 w-auto max-w-[70%] object-contain"
          />
        </div>
      </div>

      <div className="-mt-6 flex-1 overflow-y-auto rounded-t-[28px] bg-[hsl(var(--cx-canvas))] px-5 pb-10 pt-6">
        <h1 className="text-center text-xl font-extrabold">{product.name}</h1>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="cx-card flex items-center justify-center rounded-[22px] p-4">
            <p className="cx-num text-lg font-extrabold text-zeger">{formatRupiah(product.price)}</p>
          </div>
          <div className="cx-card rounded-[22px] px-3.5 py-2.5">
            <table className="w-full">
              <tbody>
                <FlavorDots label="Coffee" level={flavor.coffee} />
                <FlavorDots label="Creaminess" level={flavor.creaminess} />
                <FlavorDots label="Sweetness" level={flavor.sweetness} />
              </tbody>
            </table>
          </div>
        </div>

        {product.description && (
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">{product.description}</p>
        )}

        <div className="mt-5 flex items-center justify-center">
          <span className={`rounded-full px-4 py-1.5 text-xs font-bold ${outOfStock ? 'bg-[hsl(var(--cx-rail))] text-muted-foreground' : 'bg-emerald-50 text-emerald-700'}`}>
            {outOfStock ? 'Stok habis' : `Tersedia ${product.stock_quantity} cup`}
          </span>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Pesan langsung ke rider lewat WhatsApp, atau temui rider di titik lokasinya.
        </p>
      </div>
    </div>
  );
}

export default CustomerMap;