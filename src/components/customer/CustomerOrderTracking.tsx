import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Clock, Navigation, Star, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const GOOGLE_MAPS_API_KEY = 'AIzaSyALr8P3I3bAO8UBYXVA0BI1biG5sUuiIpg';

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
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('in_progress');
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

      // Initial rider marker (green)
      riderMarker.current = new google.maps.Marker({
        position: { lat: customerLat, lng: customerLng },
        map: map.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: rider.full_name,
      });

      // Polyline for route
      polyline.current = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: '#22c55e',
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
          onCompleted();
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
      window.location.href = `tel:${rider.phone}`;
    }
  };

  const getStatusText = () => {
    switch (orderStatus) {
      case 'accepted':
      case 'in_progress':
        return 'Rider sedang menuju lokasi Anda';
      case 'arrived':
        return 'Rider telah tiba di lokasi';
      case 'completed':
        return 'Pesanan selesai';
      default:
        return 'Memproses pesanan';
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full min-h-[400px]" />

        {/* Status Overlay */}
        <div className="absolute top-4 left-4 right-4">
          <Card className="shadow-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-2 rounded-full">
                  <Navigation className="h-5 w-5 text-green-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold">🏍️ Zeger On The Wheels</h3>
                  <p className="text-sm text-muted-foreground">{getStatusText()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Info Card */}
      <Card className="rounded-t-3xl shadow-2xl border-t-4 border-primary">
        <CardContent className="p-6 space-y-4">
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-4">
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
            <div className={`flex-1 h-1 ${orderStatus === 'arrived' || orderStatus === 'completed' ? 'bg-primary' : 'bg-gray-300'}`} />
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full ${orderStatus === 'completed' ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center text-white`}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-xs mt-1 text-center">Selesai</span>
            </div>
          </div>

          {/* Rider Info */}
          <div className="bg-muted p-4 rounded-lg">
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

            {/* Call Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleCallRider}
            >
              <Phone className="h-4 w-4 mr-2" />
              Hubungi Rider
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
