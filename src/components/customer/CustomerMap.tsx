import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Navigation, Loader2, AlertCircle, RefreshCw, Heart, Phone } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

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

const CustomerMap = ({ customerUser, onCallRider }: CustomerMapProps = {}) => {
  const [nearbyRiders, setNearbyRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);

  useEffect(() => {
    getUserLocation();
    try {
      const stored = JSON.parse(localStorage.getItem('zeger-fav-riders') || '[]');
      setFavorites(new Set(stored));
    } catch {}
    return () => {
      markers.current.forEach(m => m.setMap && m.setMap(null));
      markers.current = [];
    };
  }, []);

  useEffect(() => {
    if (!userLocation || !mapContainer.current || map.current) return;
    loadGoogleMaps().then(initializeMap).catch(err => {
      console.error(err);
      setMapError('Gagal memuat peta');
    });
  }, [userLocation]);

  useEffect(() => {
    if (!map.current || !(window as any).google?.maps || !userLocation) return;
    // clear existing markers
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];
    const google = (window as any).google;
    filteredRiders.forEach(rider => {
      if (!rider.lat || !rider.lng) return;
      const marker = new google.maps.Marker({
        position: { lat: rider.lat, lng: rider.lng },
        map: map.current,
        title: rider.full_name,
        icon: {
          path: 'M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z',
          fillColor: '#EA2831',
          fillOpacity: 1,
          strokeColor: '#0F1B3D',
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(12, 22),
        },
      });
      marker.addListener('click', () => setSelectedRider(rider));
      markers.current.push(marker);
    });
  }, [nearbyRiders, radiusKm, userLocation]);

  const loadGoogleMaps = (): Promise<void> => new Promise((resolve, reject) => {
    if ((window as any).google?.maps) return resolve();
    const existing = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('load fail')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('load fail'));
    document.head.appendChild(script);
  });

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
    () => nearbyRiders.filter(r => r.distance_km <= radiusKm),
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
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(`Halo ${name}, saya ingin memesan.`)}`, '_blank');
  };

  const openDirection = (rider: Rider) => {
    if (!rider.lat || !rider.lng) return toast.error('Lokasi rider tidak tersedia');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${rider.lat},${rider.lng}`, '_blank');
  };

  const statusLabel = (r: Rider) => {
    if (!r.is_shift_active) return { text: 'Offline', color: 'bg-gray-400' };
    if (r.location_source === 'checkpoint') return { text: 'On Location', color: 'bg-green-500' };
    if (r.is_online) return { text: 'Online', color: 'bg-green-500' };
    return { text: 'Shift Aktif', color: 'bg-amber-500' };
  };

  return (
    <div className="min-h-screen bg-white pb-4">
      {/* Hero banner */}
      <div className="relative bg-[#EA2831] px-4 pt-6 pb-24 overflow-hidden">
        <h1 className="text-white text-2xl font-extrabold leading-tight max-w-[60%]">
          KINI HADIR LEBIH DEKAT DENGAN KAWAN SEJIWA
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
        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div ref={mapContainer} className="h-64 w-full bg-gray-100" />
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
            const subtitle = rider.checkpoint_name || rider.branch_address || rider.branch_name || 'Lokasi tidak tersedia';
            return (
              <div
                key={rider.id}
                className="border-2 border-[#EA2831]/30 rounded-2xl p-3 bg-white flex items-center gap-3 shadow-sm active:scale-[0.99] transition-transform"
                onClick={() => setSelectedRider(rider)}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full border-2 border-[#0F1B3D] overflow-hidden bg-[#EA2831]/10 flex items-center justify-center">
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
                    <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded">
                      {rider.distance_km.toFixed(2)} km
                    </span>
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
  const subtitle = rider.checkpoint_name || rider.branch_address || rider.branch_name || '';
  const stock = rider.stock_items || [];
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with back */}
      <div className="relative bg-gray-100 h-40 flex-shrink-0">
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
          <div className="w-20 h-20 rounded-full border-2 border-[#0F1B3D] overflow-hidden bg-[#EA2831]/10 flex-shrink-0">
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
            <span className="inline-block mt-1 px-3 py-1 bg-green-50 text-green-700 text-sm font-semibold rounded">
              {rider.distance_km.toFixed(2)} km
            </span>
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
                  className={`w-full text-left flex gap-3 p-3 rounded-2xl border transition-transform active:scale-[0.99] ${outOfStock ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'}`}
                >
                  <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
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
        <SheetContent side="bottom" className="p-0 h-[90vh] rounded-t-3xl overflow-hidden bg-white">
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
      {/* Dark navy header with image */}
      <div className="relative bg-[#0F1B3D] pt-4 pb-16 rounded-b-[40%_15%]">
        <div className="flex items-center justify-between px-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="text-white text-lg font-bold">Detail Menu</h2>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-white" aria-label="Favorit">
            <Heart className="h-6 w-6" />
          </button>
        </div>
        <div className="flex justify-center mt-4 relative">
          <img
            src="/__l5e/assets-v1/fae4c1de-2361-4c9e-8f55-4976866ad7f6/zeger-logo.png"
            alt="Zeger"
            className="absolute top-0 right-4 w-10 h-10 object-contain opacity-90"
          />
          <div className="relative w-64 h-64 flex items-end justify-center">
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-40 h-3 rounded-full bg-black/25 blur-md" />
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="relative max-h-64 object-contain drop-shadow-2xl"
              />
            ) : (
              <div className="relative w-40 h-56 bg-white/10 rounded-2xl" />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 -mt-6">
        <h1 className="text-2xl font-extrabold text-gray-900 text-center mb-4">{product.name}</h1>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 p-4 flex items-center justify-center">
            <p className="text-xl font-extrabold text-gray-900">Rp {product.price.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 px-3 py-2">
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