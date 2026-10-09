import { useEffect, useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Phone, MapPin, Clock, Navigation, Star, CheckCircle2, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cxArt } from '@/lib/customer-art';
import { cn } from '@/lib/utils';

// Import Google Maps API key from config
import { buildMapsScriptUrl, getGoogleMapsKey } from '@/config/maps';

interface Rider {
  id: string;
  full_name: string;
  phone: string;
  photo_url?: string;
  rating?: number;
}

interface CustomerOrderTrackingProps {
  orderId: string;
  rider: Rider;
  customerLat: number;
  customerLng: number;
  deliveryAddress: string;
  onCompleted: () => void;
}

export default function CustomerOrderTracking({
  orderId,
  rider,
  customerLat,
  customerLng,
  deliveryAddress,
  onCompleted,
}: CustomerOrderTrackingProps) {
  const { toast } = useToast();
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('in_progress');
  const [mapLoadError, setMapLoadError] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const riderMarker = useRef<any>(null);
  const polyline = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const loadGoogleMaps = async () => {
      if ((window as any).google?.maps) {
        initializeMap();
        return;
      }

      const key = await getGoogleMapsKey();
      if (!key) {
        setMapLoadError(true);
        return;
      }

      const script = document.createElement('script');
      script.src = buildMapsScriptUrl({ libraries: 'places' });
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;

      script.onerror = () => {
        setMapLoadError(true);
        toast({
          title: 'Peta gagal dimuat',
          description: 'Periksa koneksi internet atau buka lewat Google Maps.',
          variant: 'destructive',
        });
      };

      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapContainer.current || !(window as any).google?.maps) return;
      const google = (window as any).google;

      map.current = new google.maps.Map(mapContainer.current, {
        center: { lat: customerLat, lng: customerLng },
        zoom: 14,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: false,
      });

      // Customer marker (blue)
      new google.maps.Marker({
        position: { lat: customerLat, lng: customerLng },
        map: map.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 4,
        },
        title: 'Lokasi Anda',
      });

      // Initial rider marker (Zeger red)
      riderMarker.current = new google.maps.Marker({
        position: { lat: customerLat, lng: customerLng },
        map: map.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: rider.full_name,
      });

      polyline.current = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: '#EF4444',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        map: map.current,
      });
    };

    loadGoogleMaps();
  }, []);

  // Subscribe to rider location updates and order status
  useEffect(() => {
    if (!rider.id) return;

    const locationChannel = supabase
      .channel('rider_location_tracking')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rider_locations',
        filter: `rider_id=eq.${rider.id}`,
      }, (payload: any) => {
        const newLat = payload.new.latitude;
        const newLng = payload.new.longitude;

        setRiderLocation({ lat: newLat, lng: newLng });

        if (riderMarker.current) {
          riderMarker.current.setPosition({ lat: newLat, lng: newLng });
        }

        if (polyline.current) {
          polyline.current.setPath([
            { lat: newLat, lng: newLng },
            { lat: customerLat, lng: customerLng },
          ]);
        }

        if (map.current) {
          const google = (window as any).google;
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: newLat, lng: newLng });
          bounds.extend({ lat: customerLat, lng: customerLng });
          map.current.fitBounds(bounds, 100);
        }

        calculateDistanceAndETA(newLat, newLng);
      })
      .subscribe();

    const statusChannel = supabase
      .channel('order_status_tracking')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload: any) => {
        const newStatus = payload.new.status;
        setOrderStatus(newStatus);

        if (newStatus === 'delivered') {
          toast({
            title: 'Pesanan telah sampai!',
            description: 'Rider sudah menyelesaikan pengiriman. Selamat menikmati!',
          });

          setTimeout(() => {
            onCompleted();
          }, 3000);
        }
      })
      .subscribe();

    const historyChannel = supabase
      .channel('order_history_tracking')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_status_history',
        filter: `order_id=eq.${orderId}`,
      }, (payload: any) => {
        setOrderStatus(payload.new.status);
      })
      .subscribe();

    const fetchInitialLocation = async () => {
      const { data } = await supabase
        .from('rider_locations')
        .select('latitude, longitude')
        .eq('rider_id', rider.id)
        .single();

      if (data) {
        setRiderLocation({ lat: data.latitude, lng: data.longitude });
        calculateDistanceAndETA(data.latitude, data.longitude);

        if (riderMarker.current) {
          riderMarker.current.setPosition({ lat: data.latitude, lng: data.longitude });
        }
        if (polyline.current) {
          polyline.current.setPath([
            { lat: data.latitude, lng: data.longitude },
            { lat: customerLat, lng: customerLng },
          ]);
        }
      }
    };

    fetchInitialLocation();

    return () => {
      supabase.removeChannel(locationChannel);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [rider.id, orderId]);

  const calculateDistanceAndETA = (riderLat: number, riderLng: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((customerLat - riderLat) * Math.PI) / 180;
    const dLon = ((customerLng - riderLng) * Math.PI) / 180;
    const lat1 = (riderLat * Math.PI) / 180;
    const lat2 = (customerLat * Math.PI) / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    setDistance(dist);

    // ETA assuming average speed of 20 km/h
    const estimatedTime = (dist / 20) * 60;
    setEta(Math.ceil(estimatedTime));
  };

  const riderWa = (() => {
    if (!rider.phone) return '';
    let phoneNumber = rider.phone.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = `62${phoneNumber.slice(1)}`;
    else if (!phoneNumber.startsWith('62')) phoneNumber = `62${phoneNumber}`;
    return phoneNumber;
  })();

  const handleChatRider = () => {
    if (!riderWa) {
      toast({
        title: 'Nomor tidak tersedia',
        description: 'Nomor telepon rider belum terdaftar.',
        variant: 'destructive',
      });
      return;
    }
    window.open(`https://wa.me/${riderWa}`, '_blank');
  };

  const statusText = (() => {
    switch (orderStatus) {
      case 'pending': return 'Mencari rider terdekat…';
      case 'accepted': return 'Rider sedang menuju lokasi kamu';
      case 'in_progress': return 'Rider dalam perjalanan';
      case 'arrived': return 'Rider sudah tiba di lokasi';
      case 'delivered': return 'Pesanan sampai. Selamat menikmati!';
      case 'completed': return 'Pesanan selesai';
      default: return 'Memproses pesanan…';
    }
  })();

  const onTheWay = ['in_progress', 'arrived', 'delivered', 'completed'].includes(orderStatus);
  const arrived = ['delivered', 'completed'].includes(orderStatus);

  const steps = [
    { label: 'Dikonfirmasi', icon: CheckCircle2, done: true, active: !onTheWay },
    { label: 'Dalam perjalanan', icon: Navigation, done: onTheWay, active: onTheWay && !arrived },
    { label: 'Sampai', icon: CheckCircle2, done: arrived, active: arrived },
  ];

  return (
    <div className="cx-app flex min-h-screen flex-col bg-[hsl(var(--cx-canvas))]">
      {/* Map */}
      <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden">
        {mapLoadError ? (
          <div className="flex h-full items-center justify-center bg-[hsl(var(--cx-rail))] px-8">
            <div className="space-y-4 text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-extrabold">Peta tidak dapat dimuat</h3>
                <p className="mt-1 text-xs text-muted-foreground">Gunakan Google Maps sebagai alternatif.</p>
              </div>
              <button
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}`, '_blank')}
                className="cx-btn cx-btn-primary mx-auto px-5 py-3 text-xs"
              >
                <Navigation className="h-4 w-4" /> Buka di Google Maps
              </button>
            </div>
          </div>
        ) : (
          <div ref={mapContainer} className="h-full w-full" />
        )}

        {/* Floating header */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/45 to-transparent px-4 pb-10 pt-4">
          <button onClick={() => window.history.back()} aria-label="Kembali" className="cx-icon-btn h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-extrabold text-white drop-shadow">Lacak Pesanan</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Live badge */}
        {riderLocation && !mapLoadError && (
          <div className="cx-card-glass absolute bottom-12 left-4 z-10 flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold">Lokasi rider live</span>
          </div>
        )}
      </div>

      {/* Sheet */}
      <div className="relative z-20 -mt-7 flex-1 rounded-t-[30px] bg-[hsl(var(--cx-canvas))] pb-10 shadow-[0_-10px_30px_-12px_hsl(var(--cx-shadow)/0.25)]">
        <div className="mx-auto mb-4 mt-3 h-1.5 w-12 rounded-full bg-[hsl(var(--cx-line))]" />

        <div className="mx-auto w-full max-w-md space-y-4 px-5">
          {/* Status + ETA */}
          <div className="cx-card cx-rise flex items-center gap-4 rounded-[26px] p-5">
            <img src={cxArt.scooter} alt="" className={cn('h-14 w-14 shrink-0 object-contain cx-art', onTheWay && !arrived && 'cx-float')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold leading-snug">{statusText}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Estimasi tiba {eta ? `${eta} menit` : '15 menit'}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="cx-card cx-rise rounded-[26px] px-5 py-5">
            <div className="flex items-start">
              {steps.map((s, i) => (
                <div key={s.label} className="flex flex-1 items-start">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 transition',
                      s.done ? 'border-transparent bg-gradient-to-br from-zeger to-zeger-dark text-white shadow-md' : 'border-[hsl(var(--cx-line))] bg-white text-muted-foreground',
                      s.active && 'cx-pulse-ring',
                    )}>
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className={cn('mt-2 text-[11px] font-bold leading-tight', s.done ? 'text-foreground' : 'text-muted-foreground')}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <span className={cn('mt-[18px] h-1 flex-1 rounded-full', steps[i + 1].done ? 'bg-zeger' : 'bg-[hsl(var(--cx-line))]')} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rider */}
          <div className="cx-card cx-rise space-y-4 rounded-[26px] p-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 ring-2 ring-zeger/15">
                <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{rider.full_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rider.rating || 4.5}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    Rider Zeger
                  </span>
                </div>
              </div>
            </div>

            {distance !== null && eta !== null && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[20px] bg-[hsl(var(--cx-rail))] p-3.5">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Jarak</p>
                  <p className="cx-num mt-1 text-lg font-extrabold">{distance.toFixed(1)} km</p>
                </div>
                <div className="rounded-[20px] bg-[hsl(var(--cx-rail))] p-3.5">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Estimasi</p>
                  <p className="cx-num mt-1 text-lg font-extrabold">~{eta} menit</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-[20px] bg-[hsl(var(--cx-rail))] p-3.5 text-xs leading-snug">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zeger" />
              <span className="flex-1">{deliveryAddress}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => rider.phone && (window.location.href = `tel:${rider.phone}`)} className="cx-btn cx-btn-ghost py-3 text-xs">
                <Phone className="h-4 w-4" /> Telepon
              </button>
              <button onClick={handleChatRider} className="cx-btn cx-btn-primary py-3 text-xs">
                <MessageCircle className="h-4 w-4" /> Chat rider
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
