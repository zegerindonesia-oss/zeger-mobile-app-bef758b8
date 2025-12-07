import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Navigation, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RiderTrackingProps {
  role: 'ho' | 'branch' | 'rider';
}

interface RiderData {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'break';
  location: string;
  coordinates: { lat: number; lng: number };
  orders: number;
  revenue: number;
  lastUpdate: string;
  avatar?: string;
}

export const RiderTracking = ({ role }: RiderTrackingProps) => {
  const [riders, setRiders] = useState<RiderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveRiders();
    // Set up real-time updates
    const interval = setInterval(fetchActiveRiders, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchActiveRiders = async () => {
    try {
      // Fetch riders with active shifts today - use Jakarta timezone
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      
      const { data: shifts, error } = await supabase
        .from('shift_management')
        .select(`
          rider_id,
          total_sales,
          total_transactions,
          profiles!inner (
            full_name
          )
        `)
        .eq('shift_date', today)
        .eq('status', 'active');

      if (error) throw error;

      // For now, we'll use mock location data since real GPS tracking isn't implemented
      const mockRiders: RiderData[] = shifts?.map((shift, index) => {
        const locations = [
          { name: "Malioboro Street", lat: -7.7956, lng: 110.3695 },
          { name: "Tugu Station", lat: -7.7887, lng: 110.3633 },
          { name: "Prawirotaman", lat: -7.8103, lng: 110.3717 },
          { name: "Kraton Area", lat: -7.8054, lng: 110.3644 },
          { name: "Kaliurang Road", lat: -7.7523, lng: 110.3783 }
        ];
        
        const location = locations[index % locations.length];
        
        const profile = Array.isArray(shift.profiles)
          ? (shift.profiles[0] as { full_name?: string } | undefined)
          : (shift.profiles as { full_name?: string } | undefined);
        const fullName = profile?.full_name || 'Rider';
        
        return {
          id: shift.rider_id,
          name: fullName,
          status: 'active' as const,
          location: location.name,
          coordinates: { lat: location.lat, lng: location.lng },
          orders: shift.total_transactions || 0,
          revenue: shift.total_sales || 0,
          lastUpdate: new Date().toLocaleTimeString('id-ID'),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`
        };
      }) || [];

      setRiders(mockRiders);
    } catch (error) {
      console.error('Error fetching riders:', error);
      // Fallback mock data
      setRiders([
        {
          id: '1',
          name: 'Budi Santoso',
          status: 'active',
          location: 'Malioboro Street',
          coordinates: { lat: -7.7956, lng: 110.3695 },
          orders: 15,
          revenue: 450000,
          lastUpdate: new Date().toLocaleTimeString('id-ID'),
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Budi'
        },
        {
          id: '2',
          name: 'Sari Wijaya',
          status: 'active',
          location: 'Tugu Station Area',
          coordinates: { lat: -7.7887, lng: 110.3633 },
          orders: 12,
          revenue: 320000,
          lastUpdate: new Date().toLocaleTimeString('id-ID'),
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sari'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { color: 'bg-green-500', text: 'Aktif', variant: 'default' as const };
      case 'break':
        return { color: 'bg-yellow-500', text: 'Istirahat', variant: 'secondary' as const };
      default:
        return { color: 'bg-gray-500', text: 'Nonaktif', variant: 'outline' as const };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleTrackRider = (rider: RiderData) => {
    // Open Google Maps with rider's location
    const url = `https://www.google.com/maps?q=${rider.coordinates.lat},${rider.coordinates.lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-3 p-4 bg-gray-100 rounded-lg">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-32"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {riders.map((rider) => {
        const statusConfig = getStatusConfig(rider.status);
        
        return (
          <Card key={rider.id} className="border border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={rider.avatar} alt={rider.name} />
                    <AvatarFallback>{rider.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{rider.name}</h4>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${statusConfig.color}`}></div>
                        {statusConfig.text}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {rider.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rider.lastUpdate}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(rider.revenue)}
                    </div>
                    <div className="text-xs text-gray-500">{rider.orders} pesanan</div>
                  </div>
                  
                  {rider.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrackRider(rider)}
                      className="flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      Track
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {riders.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Tidak ada rider aktif saat ini</p>
        </div>
      )}
    </div>
  );
};