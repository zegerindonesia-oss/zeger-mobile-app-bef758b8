import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Clock, Navigation, Star, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Import Google Maps API key from config
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

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
  onCompleted
}: CustomerOrderTrackingProps) {
  const { toast } = useToast();
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('in_progress');
  const [mapLoadError, setMapLoadError] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const polyline = useRef<google.maps.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const loadGoogleMaps = () => {
      if ((window as any).google?.maps) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      
      script.onerror = () => {
        console.error('❌ Failed to load Google Maps script');
        console.error('API Key:', GOOGLE_MAPS_API_KEY);
        console.error('Current URL:', window.location.href);
        console.error('Check:');
        console.error('1. Maps JavaScript API enabled in Google Cloud');
        console.error('2. Billing account active');
        console.error('3. HTTP Referrer restrictions: *.lovableproject.com/*');
        
        setMapLoadError(true);
        
        toast({
          title: "Maps Gagal Dimuat",
          description: "Periksa koneksi internet atau coba buka di Google Maps",
          variant: "destructive"
        });
      };
      
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapContainer.current || !(window as any).google?.maps) return;

      // Create map
      map.current = new google.maps.Map(mapContainer.current, {
        center: { lat: customerLat, lng: customerLng },
        zoom: 14,
        mapTypeControl: false,
        fullscreenControl: false,
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
          fillColor: '#EF4444', // Zeger red
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: rider.full_name,
      });

      // Polyline for route (Zeger red)
      polyline.current = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: '#EF4444', // Zeger red
        strokeOpacity: 1.0,
        strokeWeight: 3,
        map: map.current,
      });
    };

    loadGoogleMaps();
  }, []);

  // Phase 5: Subscribe to rider location updates and order status
  useEffect(() => {
    if (!rider.id) return;

    console.log('🔄 Starting real-time tracking for order:', orderId);

    // Subscribe to rider location updates
    const locationChannel = supabase
      .channel('rider_location_tracking')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rider_locations',
        filter: `rider_id=eq.${rider.id}`
      }, (payload) => {
        const newLat = payload.new.latitude;
        const newLng = payload.new.longitude;

        console.log('📍 Rider location updated:', { newLat, newLng });

        setRiderLocation({ lat: newLat, lng: newLng });

        // Update marker position
        if (riderMarker.current) {
          riderMarker.current.setPosition({ lat: newLat, lng: newLng });
        }

        // Update polyline
        if (polyline.current) {
          polyline.current.setPath([
            { lat: newLat, lng: newLng },
            { lat: customerLat, lng: customerLng }
          ]);
        }

        // Center map to show both markers
        if (map.current) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: newLat, lng: newLng });
          bounds.extend({ lat: customerLat, lng: customerLng });
          map.current.fitBounds(bounds, 100);
        }

        // Calculate distance and ETA
        calculateDistanceAndETA(newLat, newLng);
      })
      .subscribe();

    // Subscribe to order status changes
    const statusChannel = supabase
      .channel('order_status_tracking')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        const newStatus = payload.new.status;
        console.log('📦 Order status changed:', newStatus);
        setOrderStatus(newStatus);

        if (newStatus === 'completed' || newStatus === 'delivered') {
          toast({
            title: "Pesanan Selesai!",
            description: "Pesanan Anda telah sampai. Terima kasih!",
          });
          setTimeout(() => {
            onCompleted();
          }, 2000);
        }
      })
      .subscribe();

    // Subscribe to order_status_history for detailed status updates
    const historyChannel = supabase
      .channel('order_history_tracking')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_status_history',
        filter: `order_id=eq.${orderId}`
      }, (payload) => {
        const newHistory = payload.new;
        console.log('📝 New status history:', newHistory.status);
        
        // Update order status based on history
        setOrderStatus(newHistory.status);
      })
      .subscribe();

    // Fetch initial rider location
    const fetchInitialLocation = async () => {
      const { data } = await supabase
        .from('rider_locations')
        .select('latitude, longitude')
        .eq('rider_id', rider.id)
        .single();

      if (data) {
        setRiderLocation({ lat: data.latitude, lng: data.longitude });
        calculateDistanceAndETA(data.latitude, data.longitude);
        
        // Update marker and map
        if (riderMarker.current) {
          riderMarker.current.setPosition({ lat: data.latitude, lng: data.longitude });
        }
        if (polyline.current) {
          polyline.current.setPath([
            { lat: data.latitude, lng: data.longitude },
            { lat: customerLat, lng: customerLng }
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
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (customerLat - riderLat) * Math.PI / 180;
    const dLon = (customerLng - riderLng) * Math.PI / 180;
    const lat1 = riderLat * Math.PI / 180;
    const lat2 = customerLat * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    setDistance(dist);
    
    // Calculate ETA (assuming average speed of 20 km/h)
    const estimatedTime = (dist / 20) * 60;
    setEta(Math.ceil(estimatedTime));
  };

  const handleCallRider = () => {
    if (rider.phone) {
      // Format phone number: remove leading 0, add 62, remove non-digits
      let phoneNumber = rider.phone.replace(/^0/, '62');
      phoneNumber = phoneNumber.replace(/\D/g, '');
      
      // Open WhatsApp
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    }
  };

  const getStatusText = () => {
    switch (orderStatus) {
      case 'accepted':
      case 'in_progress':
        return 'Rider sedang menuju lokasi Anda';
      case 'arrived':
      case 'delivered':
        return 'Pesanan telah sampai!';
      case 'completed':
        return 'Pesanan selesai';
      default:
        return 'Memproses pesanan';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
      {/* Map Container with Rounded Bottom */}
      <div className="relative h-48 overflow-hidden rounded-b-3xl">
        {mapLoadError ? (
          <div className="flex items-center justify-center h-full min-h-[400px] bg-muted rounded-lg">
            <div className="text-center space-y-4 p-6">
              <MapPin className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">Peta Tidak Dapat Dimuat</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Gunakan Google Maps sebagai alternatif
                </p>
              </div>
              <Button
                onClick={() => window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}`,
                  '_blank'
                )}
                className="bg-red-500 hover:bg-red-600"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Buka di Google Maps
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div ref={mapContainer} className="w-full h-full" />

            {/* Overlay Header with Gradient */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => window.history.back()}
                >
                  <span className="text-white">←</span>
                </Button>
                <h1 className="flex-1 text-xl font-semibold text-center text-white">Track Order</h1>
                <div className="w-10"></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Info Card - Rounded Top */}
      <div className="bg-[#f8f6f6] -mt-8 relative rounded-t-3xl flex-1">
        {/* Home Indicator */}
        <div className="flex justify-center pt-4 mb-4">
          <div className="w-16 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-6">
          {/* Estimated Time */}
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-gray-500 mr-4" />
            <div>
              <p className="text-sm text-gray-500">Estimated Delivery Time</p>
              <p className="text-lg font-bold text-gray-900">{eta ? `${eta} minutes` : '15 minutes'}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4"></div>
          {/* Status Timeline */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-center flex-1">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-xs mt-1 text-center">Dikonfirmasi</span>
            </div>
            <div className="flex-1 h-1 bg-primary" />
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full ${orderStatus === 'in_progress' || orderStatus === 'arrived' ? 'bg-primary animate-pulse' : 'bg-gray-300'} flex items-center justify-center text-white`}>
                <Navigation className="h-5 w-5" />
              </div>
              <span className="text-xs mt-1 text-center">Dalam Perjalanan</span>
            </div>
            <div className={`flex-1 h-1 ${orderStatus === 'arrived' || orderStatus === 'delivered' || orderStatus === 'completed' ? 'bg-primary' : 'bg-gray-300'}`} />
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full ${orderStatus === 'delivered' || orderStatus === 'completed' ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center text-white`}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-xs mt-1 text-center">Pesanan Sampai</span>
            </div>
          </div>

          {/* Rider Profile Card */}
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{rider.full_name}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {rider.rating || 4.5}
                  </Badge>
                  <Badge variant="default" className="bg-green-500">🟢 Sedang OTW</Badge>
                </div>
              </div>
            </div>

            {/* Distance & ETA */}
            {distance !== null && eta !== null && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-background p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs">Jarak</span>
                  </div>
                  <p className="text-xl font-bold">{distance.toFixed(1)} km</p>
                </div>
                <div className="bg-background p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Estimasi</span>
                  </div>
                  <p className="text-xl font-bold">~{eta} menit</p>
                </div>
              </div>
            )}

            {/* Delivery Address */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
              <MapPin className="h-4 w-4 mt-0.5" />
              <span className="flex-1">{deliveryAddress}</span>
            </div>

              {/* Contact Rider Button */}
              <Button
                size="lg"
                className="w-full bg-[#EA2831] hover:bg-red-600"
                onClick={handleCallRider}
              >
                <Phone className="h-4 w-4 mr-2" />
                Contact Rider
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
