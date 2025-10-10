import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  MapPin, 
  Phone, 
  Clock,
  Navigation,
  Package,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { playAlertBeep } from '@/lib/audio';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  products: {
    name: string;
    code: string;
  };
}

interface CustomerOrder {
  id: string;
  user_id: string;
  order_type: string;
  payment_method: string;
  total_price: number;
  delivery_address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  customer_users: {
    name: string;
    phone: string;
  };
  customer_order_items: OrderItem[];
}

interface MobileIncomingOrderProps {
  order: CustomerOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string, reason: string) => void;
  riderLocation: { lat: number; lng: number } | null;
}

export function MobileIncomingOrder({
  order,
  isOpen,
  onClose,
  onAccept,
  onReject,
  riderLocation
}: MobileIncomingOrderProps) {
  const [countdown, setCountdown] = useState(60);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && order) {
      setCountdown(60);
      playAlertBeep({ times: 5, freq: 1200, durationMs: 600, volume: 0.9, intervalMs: 800 });
      calculateDistanceAndETA();
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoReject();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, order]);

  const calculateDistanceAndETA = () => {
    if (!order || !order.latitude || !order.longitude || !riderLocation) return;

    // Calculate distance using Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = toRad(order.latitude - riderLocation.lat);
    const dLon = toRad(order.longitude - riderLocation.lng);
    const lat1 = toRad(riderLocation.lat);
    const lat2 = toRad(order.latitude);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;

    setDistance(dist);
    
    // Calculate ETA (assuming average speed of 30 km/h)
    const estimatedTime = (dist / 30) * 60; // in minutes
    setEta(Math.ceil(estimatedTime));
  };

  const toRad = (value: number) => {
    return value * Math.PI / 180;
  };

  const handleAutoReject = () => {
    if (order) {
      onReject(order.id, 'Tidak ada respon dalam 60 detik');
      onClose();
    }
  };

  const handleAccept = () => {
    if (order) {
      onAccept(order.id);
      onClose();
    }
  };

  const handleReject = () => {
    if (!order) return;
    
    const finalReason = rejectReason === 'other' ? customReason : rejectReason;
    if (!finalReason) return;
    
    onReject(order.id, finalReason);
    setShowRejectModal(false);
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!order) return null;

  return (
    <>
      <Dialog open={isOpen && !showRejectModal} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
          {/* Header with Countdown */}
          <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell className="h-6 w-6 animate-pulse" />
                <DialogTitle className="text-xl font-bold">
                  Ada Pesanan Baru!
                </DialogTitle>
              </div>
              <Badge variant="secondary" className="text-lg font-bold">
                {countdown}s
              </Badge>
            </div>
            <p className="text-sm opacity-90">
              Segera respons atau otomatis ditolak
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* Customer Info */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Informasi Customer
              </h3>
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <p className="font-medium">{order.customer_users.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{order.customer_users.phone}</span>
                </div>
                {order.delivery_address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span className="flex-1">{order.delivery_address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Distance & ETA */}
            {distance !== null && eta !== null && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Navigation className="h-4 w-4" />
                    <span className="text-xs">Jarak</span>
                  </div>
                  <p className="text-lg font-bold">{distance.toFixed(1)} km</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Estimasi</span>
                  </div>
                  <p className="text-lg font-bold">~{eta} menit</p>
                </div>
              </div>
            )}

            {/* Order Type */}
            <div>
              <Badge variant="outline" className="mb-2">
                {order.order_type === 'outlet_pickup' ? 'Ambil di Outlet' : 'On The Wheels'}
              </Badge>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <h3 className="font-semibold">Item Pesanan</h3>
              <div className="space-y-2">
                {order.customer_order_items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm bg-muted p-2 rounded">
                    <span>{item.quantity}x {item.products.name}</span>
                    <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-semibold">Total Pesanan</span>
              </div>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(order.total_price)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setShowRejectModal(true)}
                className="w-full"
              >
                ❌ TOLAK
              </Button>
              <Button
                size="lg"
                onClick={handleAccept}
                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              >
                ✅ TERIMA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Alasan Penolakan
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih alasan penolakan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock_unavailable">Stok tidak tersedia</SelectItem>
                <SelectItem value="on_break">Sedang istirahat</SelectItem>
                <SelectItem value="too_far">Terlalu jauh</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>

            {rejectReason === 'other' && (
              <Textarea
                placeholder="Tulis alasan penolakan..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(false)}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason || (rejectReason === 'other' && !customReason)}
                className="flex-1"
              >
                Tolak Pesanan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
