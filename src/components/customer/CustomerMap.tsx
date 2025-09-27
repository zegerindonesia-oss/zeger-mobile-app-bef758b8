import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Star, Clock, Navigation, Phone } from 'lucide-react';

interface Rider {
  id: string;
  name: string;
  distance: string;
  eta: string;
  rating: number;
  phone: string;
}

export function CustomerMap() {
  // Mock data for nearby riders
  const [nearbyRiders] = useState<Rider[]>([
    {
      id: '1',
      name: 'Ahmad Rider',
      distance: '0.5 km',
      eta: '10 menit',
      rating: 4.8,
      phone: '081234567890'
    },
    {
      id: '2',
      name: 'Budi Delivery',
      distance: '1.2 km',
      eta: '15 menit',
      rating: 4.9,
      phone: '081234567891'
    },
    {
      id: '3',
      name: 'Cici Express',
      distance: '2.1 km',
      eta: '20 menit',
      rating: 4.7,
      phone: '081234567892'
    }
  ]);

  const callRider = (riderId: string) => {
    const rider = nearbyRiders.find(r => r.id === riderId);
    if (rider) {
      window.open(`tel:${rider.phone}`, '_self');
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <h2 className="text-xl font-bold">Pilih Rider Terdekat</h2>
        <p className="text-muted-foreground">Rider sedang online di sekitar Anda</p>
      </div>

      {/* Map placeholder - in real app this would be an actual map */}
      <Card className="h-48 bg-gradient-to-b from-blue-50 to-green-50">
        <CardContent className="p-4 h-full flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Peta akan ditampilkan di sini</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {nearbyRiders.map((rider) => (
          <Card key={rider.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{rider.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{rider.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{rider.distance}</span>
                      <Clock className="h-3 w-3" />
                      <span>{rider.eta}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs">{rider.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => callRider(rider.id)}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => callRider(rider.id)}
                  >
                    <Navigation className="h-4 w-4 mr-1" />
                    Panggil
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}