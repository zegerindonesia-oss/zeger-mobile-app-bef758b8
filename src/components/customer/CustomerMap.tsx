import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Navigation, Loader2, AlertCircle, RefreshCw, Heart, Phone, MessageCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildMapsScriptUrl, getGoogleMapsKey } from '@/config/maps';

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
    // Use geo: on mobile, fallback to Google Maps universal link
    const geo = `geo:${rider.lat},${rider.lng}?q=${rider.lat},${rider.lng}`;
    const gmap = `https://maps.google.com/?q=${rider.lat},${rider.lng}`;
    const win = window.open(geo, '_blank');
    setTimeout(() => {
      try { if (!win || win.closed) window.location.href = gmap; } catch { window.location.href = gmap; }
    }, 400);
  };

  const statusLabel = (r: Rider) => {
    if (r.location_source === 'checkpoint') return { text: 'On Location', color: 'bg-green-500' };
    if (r.total_stock > 0) return { text: 'Siap menerima order', color: 'bg-green-500' };
    return { text: 'Tidak tersedia', color: 'bg-gray-400' };
  };

  return (
    <div className="min-h-screen bg-white pb-4">
      {/* Hero banner */}
      <div className="relative bg-[#EA2831] px-4 pt-6 pb-24 overflow-hidden">
        <h1 className="text-white text-2xl font-extrabold leading-tight max-w-[60%]">
          KINI HADIR LEBIH DEKAT LEBIH HEMAT
        </h1>
        <div className="absolute right-2 top-2 w-40 h-40 rounded-full bg-white/10" />
      </div>

      {/* Greeting card */}
      <div className="mx-4 -mt-16 mb-4 bg-white rounded-2xl shadow-lg p-4 relative z-10">
        <p className="font-bold text-gray-900 text-base">
          Hi, {(customerUser?.name || 'GUEST').toUpperCase()}
        </p>
      </div>

      {/* Distance filter chips */}
      <div className="px-4 mb-3 flex gap-2">
        {DISTANCE_OPTIONS.map(km => (
          <button
            key={km}
            onClick={() => setRadiusKm(km)}
            className={`flex-1 py-3 rounded-full font-semibold text-sm transition-all ${
              radiusKm === km
                ? 'bg-[#EA2831] text-white shadow-md'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {km} km
          </button>
        ))}
      </div>

      {/* Section title + refresh */}
      <div className="px-4 flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold text-gray-900">Temukan Rider-mu</h2>
        <button
          onClick={() => userLocation && fetchNearbyRiders(userLocation.lat, userLocation.lng)}
          className="w-10 h-10 rounded-lg bg-[#EA2831] text-white flex items-center justify-center shadow-md active:scale-95"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Map */}
      <div className="px-4 mb-4">
        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white">
          <div ref={mapContainer} className="h-64 w-full bg-gray-100" />
          {mapsKeyMissing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-8 text-center">
              <MapPin className="mb-3 h-10 w-10 text-[#EA2831]" />
              <p className="font-bold text-gray-900">Peta belum aktif</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Google Maps browser key belum tersedia. Rider tetap bisa dipilih dari daftar di bawah.
              </p>
            </div>
          ) : mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-8 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-[#EA2831]" />
              <p className="font-bold text-gray-900">Peta gagal dimuat</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {mapError}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {mapError && (
        <div className="mx-4 mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {mapError}
        </div>
      )}

      {/* Rider cards */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#EA2831] mx-auto mb-2" />
          <p className="text-sm text-gray-500">Mencari rider terdekat...</p>
        </div>
      ) : filteredRiders.length === 0 ? (
        <div className="mx-4 py-10 text-center bg-gray-50 rounded-2xl">
          <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">Belum ada rider dalam {radiusKm} km</p>
          <p className="text-xs text-gray-500 mt-1">Coba perluas jangkauan pencarian</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
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
                className={`rounded-2xl p-3 bg-white flex items-center gap-3 active:scale-[0.99] transition-all ${
                  isFocused
                    ? 'border-2 border-[#EA2831] shadow-lg ring-2 ring-[#EA2831]/20'
                    : 'border-2 border-[#EA2831]/30 shadow-sm'
                }`}
                onClick={() => focusRiderOnMap(rider)}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-white ring-1 ring-black/5 shadow-md flex items-center justify-center">
                    {rider.photo_url ? (
                      <img src={rider.photo_url} alt={rider.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#EA2831] font-bold text-xl">
                        {rider.full_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className={`absolute -bottom-0 -right-0 w-4 h-4 rounded-full border-2 border-white ${status.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 uppercase truncate">{rider.full_name}</p>
                      <p className="text-xs text-gray-500 leading-tight line-clamp-2">{subtitle}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(rider.id); }}
                      className="flex-shrink-0"
                      aria-label="Favorit"
                    >
                      <Heart className={`h-5 w-5 ${isFav ? 'fill-[#EA2831] text-[#EA2831]' : 'text-gray-400'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {rider.lat !== null && rider.lng !== null && (
                        <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded">
                          {rider.distance_km.toFixed(2)} km
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(rider.phone, rider.full_name); }}
                        className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center shadow-sm active:scale-95"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDirection(rider); }}
                        disabled={rider.lat === null || rider.lng === null}
                        className="w-7 h-7 rounded-full bg-[#EA2831] flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                        aria-label="Direction"
                      >
                        <Navigation className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedRider(rider); }}
                      className="px-4 py-1.5 rounded-full bg-[#EA2831] text-white text-xs font-bold shadow"
                    >
                      Lihat Stok
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
        <SheetContent side="bottom" className="p-0 h-[90vh] rounded-t-3xl overflow-hidden">
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
    <div className="flex flex-col h-full bg-white">
      {/* Header with back */}
      <div className="relative bg-white h-40 flex-shrink-0">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-[#EA2831] text-white flex items-center justify-center shadow-lg"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-full h-full flex items-center justify-center">
          <MapPin className="h-16 w-16 text-[#EA2831]" />
        </div>
      </div>

      {/* Rider info card */}
      <div className="mx-4 -mt-14 relative z-10 bg-white rounded-2xl border-2 border-[#EA2831]/30 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white ring-1 ring-black/5 shadow-lg flex-shrink-0">
            {rider.photo_url ? (
              <img src={rider.photo_url} alt={rider.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#EA2831] font-bold text-2xl">
                {rider.full_name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-extrabold text-gray-900 uppercase">{rider.full_name}</p>
                <p className="text-sm text-gray-500 leading-tight">{subtitle}</p>
              </div>
              <button onClick={onToggleFav} aria-label="Favorit">
                <Heart className={`h-6 w-6 ${isFav ? 'fill-[#EA2831] text-[#EA2831]' : 'text-gray-400'}`} />
              </button>
            </div>
            {rider.lat !== null && rider.lng !== null && (
              <span className="inline-block mt-1 px-3 py-1 bg-green-50 text-green-700 text-sm font-semibold rounded">
                {rider.distance_km.toFixed(2)} km
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={onWhatsApp}
            className="rounded-full bg-green-500 hover:bg-green-600 h-12 w-12 p-0 flex-shrink-0"
            aria-label="WhatsApp"
          >
            <Phone className="h-5 w-5 text-white" />
          </Button>
          <Button
            onClick={onDirection}
            disabled={rider.lat === null || rider.lng === null}
            className="flex-1 rounded-full bg-[#EA2831] hover:bg-[#c92028] h-12 font-bold"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Direction
          </Button>
        </div>
      </div>

      {/* Stock list */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-6">
        <h3 className="text-xl font-extrabold text-gray-900 mb-3">Stok Rider</h3>
        {stock.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl">
            Belum ada data stok dari rider ini.
          </div>
        ) : (
          <div className="space-y-3">
            {stock.map(item => {
              const qty = item.stock_quantity;
              const outOfStock = qty <= 0;
              const low = qty > 0 && qty < 5;
              return (
                <button
                  key={item.product_id}
                  onClick={() => setSelectedProduct(item)}
                  className={`w-full text-left flex gap-3 p-3 rounded-2xl border transition-transform active:scale-[0.99] ${outOfStock ? 'bg-white border-gray-100 opacity-70' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'}`}
                >
                  <div className="w-20 h-20 rounded-xl bg-white overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-900 leading-tight">{item.name}</p>
                      <Heart className="h-5 w-5 text-gray-300 flex-shrink-0" />
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-semibold text-gray-700">
                        Rp {item.price.toLocaleString('id-ID')}
                      </p>
                      {outOfStock ? (
                        <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                          Stok Habis
                        </span>
                      ) : low ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                          Stok &lt; 5
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Stok {qty}
                        </span>
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
        <SheetContent side="bottom" className="p-0 h-[90vh] rounded-t-3xl overflow-hidden !bg-white">
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
      <td className="py-1 pr-2 text-[11px] text-gray-700 whitespace-nowrap">{label}</td>
      <td className="py-1">
        <div className="flex gap-1 justify-end">
          {[1, 2, 3, 4, 5].map(i => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full border ${i <= level ? 'bg-[#EA2831] border-[#EA2831]' : 'bg-white border-gray-300'}`}
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
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with image */}
      <div className="relative bg-white pt-4 pb-16">
        <div className="flex items-center justify-between px-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-white"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="text-gray-900 text-lg font-bold">Detail Menu</h2>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-white" aria-label="Favorit">
            <Heart className="h-6 w-6" />
          </button>
        </div>
        <div className="flex justify-center mt-4 relative bg-white">
          <img
            src="/__l5e/assets-v1/fae4c1de-2361-4c9e-8f55-4976866ad7f6/zeger-logo.png"
            alt="Zeger"
            className="absolute top-0 right-4 w-10 h-10 object-contain opacity-90"
          />
          <div className="relative w-64 h-64 flex items-end justify-center bg-white">
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-40 h-3 rounded-full bg-black/15 blur-md" />
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="relative max-h-64 object-contain"
              />
            ) : (
              <div className="relative w-40 h-56 bg-white rounded-2xl" />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 -mt-6 bg-white">
        <h1 className="text-2xl font-extrabold text-gray-900 text-center mb-4">{product.name}</h1>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 flex items-center justify-center">
            <p className="text-xl font-extrabold text-gray-900">Rp {product.price.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2">
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
          <p className="text-center text-gray-500 mt-4 leading-relaxed">{product.description}</p>
        )}

        <div className="mt-4 flex items-center justify-center">
          <span className="px-4 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
            Tersedia {product.stock_quantity} cup
          </span>
        </div>
      </div>
    </div>
  );
}

export default CustomerMap;