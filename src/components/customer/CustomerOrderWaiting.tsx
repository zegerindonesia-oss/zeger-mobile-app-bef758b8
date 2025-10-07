import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Phone, MapPin, Clock, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Rider {
  id: string;
  full_name: string;
  phone: string;
  photo_url?: string;
  distance_km: number;
  eta_minutes: number;
}

interface CustomerOrderWaitingProps {
  orderId: string;
  rider: Rider;
  onAccepted: () => void;
  onRejected: (reason: string) => void;
  onCancel: () => void;
}

export default function CustomerOrderWaiting({
  orderId,
  rider,
  onAccepted,
  onRejected,
  onCancel
}: CustomerOrderWaitingProps) {
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(60);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    // Subscribe to order status changes
    const channel = supabase
      .channel('order_status_waiting')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        console.log('Order status changed:', payload);
        const newStatus = payload.new.status;
        
        if (newStatus === 'accepted' || newStatus === 'in_progress') {
          toast({
            title: '✅ Pesanan Diterima!',
            description: `${rider.full_name} menerima pesanan Anda`,
          });
          onAccepted();
        } else if (newStatus === 'rejected') {
          const reason = payload.new.rejection_reason || 'Rider menolak pesanan';
          setRejectionReason(reason);
          setShowRejectionDialog(true);
          setTimeout(() => {
            setShowRejectionDialog(false);
            onRejected(reason);
          }, 5000);
        }
      })
      .subscribe();

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast({
            title: '⏱️ Waktu Habis',
            description: 'Rider tidak merespons dalam waktu yang ditentukan',
            variant: 'destructive'
          });
          onRejected('Tidak ada respons dari rider');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId, onAccepted, onRejected]);

  const handleCallRider = () => {
    if (rider.phone) {
      window.location.href = `tel:${rider.phone}`;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🏍️</span>
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold">Menunggu Konfirmasi</h2>
            <p className="text-muted-foreground">
              Mohon tunggu, rider akan segera merespons pesanan Anda
            </p>
          </div>

          {/* Countdown */}
          <div className="flex justify-center">
            <div className="bg-primary text-primary-foreground rounded-full w-20 h-20 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold">{countdown}</div>
                <div className="text-xs">detik</div>
              </div>
            </div>
          </div>

          {/* Rider Info */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 ring-2 ring-primary/10">
                <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{rider.full_name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{rider.phone}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{rider.distance_km.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="font-medium">~{rider.eta_minutes} menit</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleCallRider}
            >
              <Phone className="h-4 w-4 mr-2" />
              Hubungi Rider
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="w-full"
              onClick={onCancel}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Batalkan Pesanan
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-center text-xs text-muted-foreground">
          Pesanan akan otomatis dibatalkan jika tidak ada respons dalam {countdown} detik
        </p>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Pesanan Ditolak
            </DialogTitle>
            <DialogDescription>
              Mohon maaf, rider tidak dapat menerima pesanan Anda
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-destructive/10 p-4 rounded-lg">
              <p className="text-sm font-medium mb-1">Alasan Penolakan:</p>
              <p className="text-sm text-destructive">{rejectionReason}</p>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-10 w-10">
                <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{rider.full_name}</p>
                <p className="text-xs">{rider.phone}</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowRejectionDialog(false);
                onRejected(rejectionReason);
              }}
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
