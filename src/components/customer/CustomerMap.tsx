import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Phone, Star, Package, Navigation, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
}

// Temporary: User should add their Mapbox token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiemVnZXJhcHAiLCJhIjoiY20zeTh6Y2VhMGF5cTJsc2J5bmZ1b3RtMCJ9.FUQ8xRvXaKHLJLdXZegerA';

const CustomerMap = () => {
  const [nearbyRiders, setNearbyRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    getUserLocation();
    
    // Cleanup map on unmount
    return () => {
      markers.current.forEach(marker => marker.remove());
      if (map.current) map.current.remove();
    };
  }, []);

  // Initialize map when location and riders are available
  useEffect(() => {
    if (!userLocation || !mapContainer.current || nearbyRiders.length === 0) return;
    if (map.current) return; // Map already initialized

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [userLocation.lng, userLocation.lat],
      zoom: 12
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add customer marker (blue)
    const customerEl = document.createElement('div');
    customerEl.className = 'w-8 h-8 bg-primary rounded-full border-4 border-white shadow-lg';
    new mapboxgl.Marker(customerEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML('<strong>Lokasi Anda</strong>'))
      .addTo(map.current);

    // Add rider markers
    nearbyRiders.forEach(rider => {
      if (rider.lat && rider.lng) {
        const riderEl = document.createElement('div');
        riderEl.className = rider.is_online 
          ? 'w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg'
          : 'w-6 h-6 bg-gray-400 rounded-full border-2 border-white shadow-lg';
        
        const marker = new mapboxgl.Marker(riderEl)
          .setLngLat([rider.lng, rider.lat])
          .setPopup(new mapboxgl.Popup().setHTML(
            `<strong>${rider.full_name}</strong><br/>
             ${rider.is_online ? '🟢 Online' : '⚪ Offline'}<br/>
             ${rider.distance_km < 999 ? `📍 ${rider.distance_km} km` : '📍 Lokasi tidak tersedia'}`
          ))
          .addTo(map.current!);
        
        markers.current.push(marker);
      }
    });

    // Fit bounds to show all markers
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([userLocation.lng, userLocation.lat]);
    nearbyRiders.forEach(rider => {
      if (rider.lat && rider.lng) {
        bounds.extend([rider.lng, rider.lat]);
      }
    });
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
  }, [userLocation, nearbyRiders]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          fetchNearbyRiders(location.lat, location.lng);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLoading(false);
        }
      );
    }
  };

  const fetchNearbyRiders = async (lat: number, lng: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-nearby-riders', {
        body: {
          customer_lat: lat,
          customer_lng: lng,
          radius_km: 50 // Large radius to show all riders
        }
      });

      if (error) throw error;
      
      setNearbyRiders(data.riders || []);
    } catch (error) {
      console.error('Error fetching nearby riders:', error);
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
      <Card className="mb-6">
        <CardContent className="p-0">
          <div ref={mapContainer} className="h-80 w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Riders List */}
      {nearbyRiders.length === 0 ? (
        <Card>
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
              className={`overflow-hidden hover:shadow-lg transition-shadow ${
                !rider.is_online ? 'opacity-60' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                        <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        rider.is_online ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{rider.full_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{rider.rating}</span>
                        </div>
                        <Badge variant={rider.is_online ? "default" : "secondary"} className="text-xs">
                          {rider.is_online ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {rider.total_stock}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {rider.distance_km < 999 ? `${rider.distance_km} km` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {rider.eta_minutes > 0 ? `~${rider.eta_minutes} min` : 'N/A'}
                    </span>
                  </div>
                </div>
                {!rider.lat || !rider.lng ? (
                  <p className="text-xs text-muted-foreground">📍 Lokasi tidak tersedia</p>
                ) : null}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => callRider(rider.id)}
                    disabled={!rider.is_online || !rider.phone}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    disabled={!rider.is_online || !rider.lat || !rider.lng}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate
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
