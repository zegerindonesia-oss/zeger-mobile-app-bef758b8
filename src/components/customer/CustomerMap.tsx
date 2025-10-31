import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Phone, Star, Package, Navigation, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  is_shift_active: boolean;
  has_gps?: boolean;
  branch_name?: string;
  branch_address?: string;
  photo_url?: string;
}

interface CustomerMapProps {
  customerUser?: any;
  onCallRider?: (orderId: string, rider: Rider) => void;
}

// Import Google Maps API key from config
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

const CustomerMap = ({ customerUser, onCallRider }: CustomerMapProps = {}) => {
  const [nearbyRiders, setNearbyRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingRider, setRequestingRider] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const riderMarkersMap = useRef<Map<string, google.maps.Marker>>(new Map());

  useEffect(() => {
    requestLocationPermission();
    
    // Cleanup map on unmount
    return () => {
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];
      riderMarkersMap.current.clear();
    };
  }, []);

  // Phase 3: Subscribe to realtime rider location updates
  useEffect(() => {
    if (!userLocation || nearbyRiders.length === 0) return;

    console.log('🔄 Subscribing to rider location updates for', nearbyRiders.length, 'riders');

    const channel = supabase
      .channel('rider_locations_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rider_locations'
        },
        (payload) => {
          const riderId = payload.new.rider_id;
          const newLat = payload.new.latitude;
          const newLng = payload.new.longitude;

          console.log('📍 Rider location updated:', { riderId, newLat, newLng });

          // Update rider in state
          setNearbyRiders(prev => prev.map(rider => {
            if (rider.id === riderId) {
              // Calculate new distance
              const R = 6371;
              const dLat = (newLat - userLocation.lat) * Math.PI / 180;
              const dLon = (newLng - userLocation.lng) * Math.PI / 180;
              const lat1 = userLocation.lat * Math.PI / 180;
              const lat2 = newLat * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const distance = R * c;

              return {
                ...rider,
                lat: newLat,
                lng: newLng,
                distance_km: distance,
                eta_minutes: Math.ceil((distance / 20) * 60),
                has_gps: true,
                is_online: true
              };
            }
            return rider;
          }));

          // Update marker on map
          const marker = riderMarkersMap.current.get(riderId);
          if (marker) {
            marker.setPosition({ lat: newLat, lng: newLng });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userLocation, nearbyRiders.length]);

  const requestLocationPermission = async () => {
    console.log('📍 Requesting location permission...');
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      
      if (permission.state === 'denied') {
        setMapError('Izin lokasi ditolak. Silakan aktifkan di pengaturan browser Anda.');
        setLoading(false);
        toast.error('Izin lokasi ditolak');
        return;
      }
      
      getUserLocation();
    } catch (error) {
      console.warn('Permissions API not supported, requesting directly:', error);
      getUserLocation();
    }
  };

  // Initialize Google Maps when location is available
  useEffect(() => {
    if (!userLocation || !mapContainer.current) return;
    if (map.current) return; // Map already initialized

    console.log('🗺️ Initializing Google Maps with user location:', userLocation);
    
    loadGoogleMaps()
      .then(() => {
        initializeMap();
      })
      .catch((error) => {
        console.error('❌ Failed to load Google Maps:', error);
        const errorMsg = error.message || 'Gagal memuat Google Maps';
        setMapError(`${errorMsg}. Pastikan API Key sudah diaktifkan untuk Maps JavaScript API.`);
        toast.error('Gagal memuat peta', {
          description: 'Periksa koneksi internet atau coba lagi nanti'
        });
      });
  }, [userLocation]);

  const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.maps) {
        resolve();
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      let retryCount = 0;
      const maxRetries = 3;
      
      const handleError = () => {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying Google Maps load (${retryCount}/${maxRetries})...`);
          setTimeout(() => {
            document.head.removeChild(script);
            loadGoogleMaps().then(resolve).catch(reject);
          }, 2000);
        } else {
          reject(new Error('Failed to load Google Maps after multiple attempts'));
        }
      };
      
      script.onload = () => {
        console.log('✅ Google Maps script loaded');
        resolve();
      };
      script.onerror = handleError;
      document.head.appendChild(script);
    });
  };

  const initializeMap = () => {
    if (!mapContainer.current || !(window as any).google?.maps || !userLocation) return;

    console.log('🗺️ Creating map instance...');
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
          title: `${rider.full_name}${rider.has_gps ? '' : ' (Lokasi cabang)'}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: rider.is_shift_active ? (rider.is_online ? '#22c55e' : '#f59e0b') : '#9ca3af',
            fillOpacity: rider.is_shift_active ? 1 : 0.5,
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
              ${!rider.has_gps ? '<br/><span style="font-size: 12px; color: #9ca3af;">⚠️ Lokasi GPS tidak tersedia</span>' : ''}
            </div>
          `,
        });

        riderMarker.addListener('click', () => {
          infoWindow.open(map.current!, riderMarker);
        });

        markers.current.push(riderMarker);
        riderMarkersMap.current.set(rider.id, riderMarker);
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

  const getUserLocation = () => {
    console.log('📍 Requesting user location...');
    if (!navigator.geolocation) {
      const errorMsg = "Geolocation tidak didukung di browser Anda";
      setMapError(errorMsg);
      toast.error(errorMsg);
      // Use Jakarta as fallback location
      const fallbackLocation = { lat: -6.2088, lng: 106.8456 };
      setUserLocation(fallbackLocation);
      fetchNearbyRiders(fallbackLocation.lat, fallbackLocation.lng);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log('✅ Got user location:', location);
        setUserLocation(location);
        setMapError(null);
        fetchNearbyRiders(location.lat, location.lng);
      },
      (error) => {
        console.error('❌ Error getting location:', error);
        let errorMessage = "Tidak dapat mengakses lokasi Anda";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Izin lokasi ditolak. Silakan aktifkan di pengaturan browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informasi lokasi tidak tersedia.";
            break;
          case error.TIMEOUT:
            errorMessage = "Permintaan lokasi timeout.";
            break;
        }
        
        setMapError(errorMessage);
        toast.error(errorMessage);
        
        // Fallback to Jakarta
        const fallbackLocation = { lat: -6.2088, lng: 106.8456 };
        setUserLocation(fallbackLocation);
        fetchNearbyRiders(fallbackLocation.lat, fallbackLocation.lng);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const fetchNearbyRiders = async (lat: number, lng: number) => {
    console.log('🔍 Fetching nearby riders for location:', { lat, lng });
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-nearby-riders', {
        body: {
          customer_lat: lat,
          customer_lng: lng,
          radius_km: 50
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        const errorMsg = error.message || 'Gagal memuat data rider';
        setMapError(`${errorMsg}. Silakan coba lagi.`);
        setNearbyRiders([]);
        toast.error(`Error: ${errorMsg}`);
        setLoading(false);
        return;
      }
      
      console.log('✅ Fetched riders:', data.riders?.length || 0, 'riders found');
      
      if (!data.riders || data.riders.length === 0) {
        setMapError('Tidak ada rider tersedia di area ini saat ini. Silakan coba lagi nanti.');
        toast.info('Tidak ada rider tersedia');
      } else {
        setMapError(null);
      }
      
      setNearbyRiders(data.riders || []);
    } catch (error) {
      console.error('❌ Error fetching nearby riders:', error);
      setMapError('Gagal memuat rider terdekat. Pastikan Anda terhubung ke internet.');
      toast.error('Gagal memuat rider terdekat');
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

  // Phase 4: Handle "Panggil Rider" - Create order request
  const handlePanggilRider = async (rider: Rider) => {
    if (!customerUser?.user_id || !userLocation) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    setRequestingRider(rider.id);

    try {
      console.log('📞 Calling rider:', {
        rider: rider.full_name,
        customer_user_id: customerUser.user_id,
        location: userLocation
      });

      const { data, error } = await supabase.functions.invoke('send-order-request', {
        body: {
          customer_user_id: customerUser.user_id,
          rider_profile_id: rider.id,
          customer_lat: userLocation.lat,
          customer_lng: userLocation.lng,
          delivery_address: customerUser.address || 'Alamat pelanggan',
          notes: 'Panggil rider via Zeger On The Wheels'
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Gagal mengirim permintaan');
      }

      console.log('✅ Order created:', data);

      toast.success(`Permintaan berhasil dikirim ke ${rider.full_name}!`, {
        description: `ETA: ${data.eta_minutes || 15} menit`
      });

      // Navigate to tracking page if order created
      if (onCallRider && data?.order_id) {
        onCallRider(data.order_id, rider);
      }
    } catch (error: any) {
      console.error('❌ Error calling rider:', error);
      toast.error('Gagal mengirim permintaan', {
        description: error.message || 'Silakan coba lagi'
      });
    } finally {
      setRequestingRider(null);
    }
  };

  // Phase 6: Handle "Kunjungi Rider" - Open Google Maps directions
  const handleKunjungiRider = (rider: Rider) => {
    if (!rider.lat || !rider.lng) {
      toast.error('Lokasi rider tidak tersedia');
      return;
    }

    // Open Google Maps with directions
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${rider.lat},${rider.lng}`;
    window.open(mapsUrl, '_blank');
    
    toast.success('Membuka Google Maps', {
      description: 'Arahkan ke lokasi rider'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Memuat peta dan mencari rider terdekat...</p>
        </div>
      </div>
    );
  }

  if (mapError && !userLocation) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Tidak Dapat Memuat Peta</h3>
          <p className="text-gray-600 mb-4">{mapError}</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-gray-700 font-semibold mb-2">Tips:</p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Pastikan izin lokasi diaktifkan di browser</li>
              <li>Periksa koneksi internet Anda</li>
              <li>Coba refresh halaman</li>
              <li>Gunakan browser Chrome atau Safari</li>
            </ul>
          </div>
          <Button onClick={requestLocationPermission} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
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
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {mapError}
            </p>
            <Button size="sm" variant="outline" onClick={() => {
              setMapError(null);
              if (userLocation) {
                fetchNearbyRiders(userLocation.lat, userLocation.lng);
              }
            }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
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
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Tidak ada rider tersedia</p>
            <p className="text-sm text-muted-foreground mb-4">
              Belum ada rider yang aktif di area Anda saat ini
            </p>
            <Button onClick={() => userLocation && fetchNearbyRiders(userLocation.lat, userLocation.lng)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nearbyRiders.map((rider) => (
            <Card 
              key={rider.id} 
              className={`overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg ${
                !rider.is_shift_active ? 'opacity-60 border-muted' : ''
              }`}
            >
              <CardHeader className="pb-3 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                        <AvatarImage 
                          src={rider.photo_url || "/avatars/default-rider.jpg"} 
                          alt={rider.full_name}
                          className="object-cover"
                        />
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-semibold">{rider.rating}</span>
                        </div>
                        <Badge 
                          variant={rider.is_shift_active ? (rider.is_online ? "default" : "secondary") : "outline"} 
                          className="text-xs"
                        >
                          {rider.is_shift_active ? (
                            rider.is_online ? '🟢 Online' : '🟡 Shift Aktif'
                          ) : (
                            '⚪ Offline'
                          )}
                        </Badge>
                        {!rider.has_gps && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            Lokasi Cabang
                          </Badge>
                        )}
                        {rider.distance_km > 50 && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Jarak Jauh ({rider.distance_km}km)
                          </Badge>
                        )}
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
                {!rider.has_gps && rider.branch_name && (
                  <p className="text-xs text-muted-foreground bg-gray-50 p-2 rounded flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    GPS tidak aktif. Menampilkan lokasi {rider.branch_name}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  {/* Kunjungi Rider - Open Google Maps Direction */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 shadow-sm hover:shadow-md transition-shadow rounded-full"
                    onClick={() => {
                      if (rider.lat && rider.lng && userLocation) {
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${rider.lat},${rider.lng}&travelmode=driving`, 
                          '_blank'
                        );
                        toast.success(`Membuka Google Maps ke ${rider.full_name}`);
                      }
                    }}
                    disabled={!rider.lat || !rider.lng || !userLocation}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Kunjungi Rider
                  </Button>
                  {/* Panggil Rider - Create Order Request */}
                  <Button 
                    size="sm" 
                    className="flex-1 shadow-md hover:shadow-lg transition-shadow bg-red-500 hover:bg-red-600 rounded-full"
                    onClick={async () => {
                      if (!userLocation || !customerUser) {
                        toast.error('Lokasi atau data customer tidak tersedia');
                        return;
                      }
                      
                      try {
                        setRequestingRider(rider.id);
                        const { data, error } = await supabase.functions.invoke('send-order-request', {
                          body: {
                            customer_user_id: customerUser.user_id,
                            rider_profile_id: rider.id,
                            customer_lat: userLocation.lat,
                            customer_lng: userLocation.lng,
                            delivery_address: customerUser.address || 'Alamat tidak tersedia',
                            notes: 'Customer memanggil rider untuk datang'
                          }
                        });
                        
                        if (error) throw error;
                        
                        toast.success('Permintaan terkirim! Menunggu konfirmasi rider...');
                        
                        // Call callback to parent component
                        onCallRider?.(data.order_id, rider);
                      } catch (err: any) {
                        console.error('Error calling rider:', err);
                        toast.error(err.message || 'Gagal mengirim permintaan');
                      } finally {
                        setRequestingRider(null);
                      }
                    }}
                    disabled={requestingRider === rider.id || !userLocation || !customerUser}
                  >
                    {requestingRider === rider.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4 mr-2" />
                    )}
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
