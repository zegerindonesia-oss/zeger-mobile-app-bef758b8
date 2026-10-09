import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Clock, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Branch {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  distance?: number | null;
}

interface CustomerOutletListProps {
  onNavigate: (view: string) => void;
  onSelectOutlet?: (outletId: string) => void;
  channel?: 'branch' | 'street';
}

export function CustomerOutletList({ onNavigate, onSelectOutlet, channel = 'branch' }: CustomerOutletListProps) {
  const [outlets, setOutlets] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchUserLocation();
    fetchOutlets();
  }, [channel]);

  const fetchUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Tidak dapat mengakses lokasi Anda');
        }
      );
    }
  };

  const fetchOutlets = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .in('branch_type', ['hub', 'small'])
        .eq('customer_channel', channel)
        .eq('is_active', true);

      if (error) throw error;
      setOutlets(data || []);
    } catch (error) {
      console.error('Error fetching outlets:', error);
      toast.error('Gagal memuat outlet');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const isOutletOpen = (): boolean => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 7 && hour < 21; // 07:00 - 21:00 WIB
  };

  const getFilteredOutlets = () => {
    if (!userLocation) return outlets;
    
    return outlets
      .map(outlet => {
        if (!outlet.latitude || !outlet.longitude) return { ...outlet, distance: null };
        
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          outlet.latitude,
          outlet.longitude
        );
        
        return { ...outlet, distance };
      })
      .filter(outlet => !outlet.distance || outlet.distance <= 10)
      .sort((a, b) => {
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return a.distance - b.distance;
      });
  };

  const handleSelectOutlet = (outletId: string) => {
    if (onSelectOutlet) {
      onSelectOutlet(outletId);
    }
    onNavigate('menu');
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Memuat outlet...</p>
        </div>
      </div>
    );
  }

  const filteredOutlets = getFilteredOutlets();
  const isOpen = isOutletOpen();

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Outlet Terdekat</h2>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className={isOpen ? 'text-green-600' : 'text-red-600'}>
            {isOpen ? 'Buka' : 'Tutup'}
          </span>
        </div>
      </div>

      <div className="bg-muted/50 p-3 rounded-lg text-sm">
        <p className="text-muted-foreground">
          Jam operasional: 07:00 - 21:00 WIB
        </p>
        {userLocation && (
          <p className="text-muted-foreground mt-1">
            Menampilkan outlet dalam radius 10km
          </p>
        )}
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {filteredOutlets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Tidak ada outlet dalam radius 10km
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOutlets.map((outlet) => (
              <Card key={outlet.id} className="hover:border-primary transition-colors">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{outlet.name}</h3>
                        {outlet.address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {outlet.address}
                          </p>
                        )}
                      </div>
                      {outlet.distance && (
                        <div className="flex items-center gap-1 text-sm text-primary ml-4">
                          <Navigation className="h-4 w-4" />
                          <span>{outlet.distance.toFixed(1)} km</span>
                        </div>
                      )}
                    </div>

                    {outlet.phone && (
                      <p className="text-sm text-muted-foreground">
                        📞 {outlet.phone}
                      </p>
                    )}

                    <Button 
                      className="w-full"
                      onClick={() => handleSelectOutlet(outlet.id)}
                      disabled={!isOpen}
                    >
                      {isOpen ? 'Pilih Outlet' : 'Outlet Tutup'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
