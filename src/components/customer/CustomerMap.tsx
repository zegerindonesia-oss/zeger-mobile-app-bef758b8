import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Phone, Star, Package, Navigation, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface Rider {
  id: string;
  full_name: string;
  distance_km: number;
  eta_minutes: number;
  rating: number;
  phone: string;
  total_stock: number;
  lat: number | null;
  lng: number | null;
  last_updated: string | null;
  is_online: boolean;
  photo_url?: string | null;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyALr8P3I3bAO8UBYXVA0BI1biG5sUuiIpg';

const CustomerMap = () => {
  const [nearbyRiders, setNearbyRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    getUserLocation();
    
    // Cleanup map on unmount
    return () => {
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];
    };
  }, []);

  // Initialize Google Maps when location is available
  useEffect(() => {
    if (!userLocation || !mapContainer.current) return;
    if (map.current) return; // Map already initialized

    console.log('🗺️ Initializing Google Maps with user location:', userLocation);
    
    // Load Google Maps script
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
        center: { lat: userLocation.lat, lng: userLocation.lng },
        zoom: 13,
        mapTypeControl: false,
        fullscreenControl: true,
      });

      // Add customer marker (blue pin)
      const customerMarker = new google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map.current,
        title: 'Lokasi Anda',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 4,
        },
      });

      const customerInfo = new google.maps.InfoWindow({
        content: '<div style="padding: 8px;"><strong>Lokasi Anda</strong></div>',
      });
      customerMarker.addListener('click', () => {
        customerInfo.open(map.current!, customerMarker);
      });

      // Add rider markers
      console.log('📍 Adding markers for riders:', nearbyRiders.length);
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });

      nearbyRiders.forEach(rider => {
        if (rider.lat && rider.lng) {
          const riderMarker = new google.maps.Marker({
            position: { lat: rider.lat, lng: rider.lng },
            map: map.current!,
            title: rider.full_name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: rider.is_online ? '#22c55e' : '#9ca3af',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; min-width: 200px;">
                <strong style="font-size: 16px;">${rider.full_name}</strong><br/>
                <span style="color: ${rider.is_online ? '#22c55e' : '#9ca3af'};">
                  ${rider.is_online ? '🟢 Online' : '⚪ Offline'}
                </span><br/>
                <span style="font-size: 14px;">
                  ${rider.distance_km < 999 ? `📍 ${rider.distance_km.toFixed(1)} km` : '📍 Lokasi tidak tersedia'}
                </span>
              </div>
            `,
          });

          riderMarker.addListener('click', () => {
            infoWindow.open(map.current!, riderMarker);
          });

          markers.current.push(riderMarker);
          bounds.extend({ lat: rider.lat, lng: rider.lng });
        }
      });

      // Fit bounds to show all markers
      if (nearbyRiders.length > 0) {
        map.current.fitBounds(bounds, 50);
      }

      console.log('✅ Google Maps loaded successfully');
      setMapError(null);
    };

    loadGoogleMaps();
  }, [userLocation, nearbyRiders]);

  const getUserLocation = () => {
    console.log('📍 Requesting user location...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('✅ Got user location:', location);
          setUserLocation(location);
          fetchNearbyRiders(location.lat, location.lng);
        },
        (error) => {
          console.error('❌ Error getting location:', error);
          // Use Jakarta as fallback location
          const fallbackLocation = { lat: -6.2088, lng: 106.8456 };
          console.log('📍 Using fallback location (Jakarta):', fallbackLocation);
          setUserLocation(fallbackLocation);
          fetchNearbyRiders(fallbackLocation.lat, fallbackLocation.lng);
          setMapError('Lokasi tidak dapat diakses. Menggunakan lokasi default (Jakarta).');
        }
      );
    } else {
      console.error('❌ Geolocation not supported');
      // Use Jakarta as fallback location
      const fallbackLocation = { lat: -6.2088, lng: 106.8456 };
      setUserLocation(fallbackLocation);
      fetchNearbyRiders(fallbackLocation.lat, fallbackLocation.lng);
      setMapError('Browser tidak mendukung geolokasi. Menggunakan lokasi default (Jakarta).');
    }
  };

  const fetchNearbyRiders = async (lat: number, lng: number) => {
    console.log('🔍 Fetching nearby riders for location:', { lat, lng });
    try {
      const { data, error } = await supabase.functions.invoke('get-nearby-riders', {
        body: {
          customer_lat: lat,
          customer_lng: lng,
          radius_km: 50 // Large radius to show all riders
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }
      
      console.log('✅ Fetched riders:', data.riders?.length || 0, 'riders found');
      setNearbyRiders(data.riders || []);
    } catch (error) {
      console.error('❌ Error fetching nearby riders:', error);
    } finally {
      setLoading(false);
    }
  };

  const callRider = (riderId: string) => {
    const rider = nearbyRiders.find(r => r.id === riderId);
    if (rider?.phone) {
      window.location.href = `tel:${rider.phone}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl font-bold">Zeger On The Wheels</CardTitle>
        <CardDescription>Pilih rider terdekat untuk pengiriman Anda</CardDescription>
      </CardHeader>

      {/* Interactive Map */}
      {mapError && (
        <Card className="mb-4 border-yellow-500 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-800">{mapError}</p>
          </CardContent>
        </Card>
      )}
      <Card className="mb-6 overflow-hidden shadow-lg">
        <CardContent className="p-0">
          <div ref={mapContainer} className="h-80 w-full" />
        </CardContent>
      </Card>

      {/* Riders List */}
      {nearbyRiders.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Tidak ada rider yang tersedia saat ini
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nearbyRiders.map((rider) => (
            <Card 
              key={rider.id} 
              className={`overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg ${
                !rider.is_online ? 'opacity-60' : ''
              }`}
            >
              <CardHeader className="pb-3 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                        <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {rider.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-md ${
                        rider.is_online ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">{rider.full_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-semibold">{rider.rating}</span>
                        </div>
                        <Badge variant={rider.is_online ? "default" : "secondary"} className="text-xs">
                          {rider.is_online ? '🟢 Online' : '⚪ Offline'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1 shadow-sm">
                    <Package className="h-3 w-3" />
                    <span className="font-bold">{rider.total_stock}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm bg-blue-50 p-2 rounded-lg">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold">
                      {rider.distance_km < 999 ? `${rider.distance_km} km` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded-lg">
                    <Navigation className="h-4 w-4 text-green-600" />
                    <span className="font-semibold">
                      {rider.eta_minutes > 0 ? `~${rider.eta_minutes} min` : 'N/A'}
                    </span>
                  </div>
                </div>
                {!rider.lat || !rider.lng ? (
                  <p className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                    📍 Lokasi tidak tersedia
                  </p>
                ) : null}
                <div className="flex gap-2 pt-2">
                  {/* Kunjungi Rider - Open Google Maps Direction */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 shadow-sm hover:shadow-md transition-shadow rounded-full"
                    onClick={() => {
                      if (rider.lat && rider.lng) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${rider.lat},${rider.lng}`, '_blank');
                      }
                    }}
                    disabled={!rider.is_online || !rider.lat || !rider.lng}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Kunjungi Rider
                  </Button>
                  {/* Panggil Rider - Create Order Request */}
                  <Button 
                    size="sm" 
                    className="flex-1 shadow-md hover:shadow-lg transition-shadow bg-red-500 hover:bg-red-600 rounded-full"
                    onClick={() => {
                      // TODO: Implement order creation and rider notification
                      window.location.href = `/customer-app?tab=menu&rider=${rider.id}`;
                    }}
                    disabled={!rider.is_online || !rider.lat || !rider.lng}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Panggil Rider
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerMap;
