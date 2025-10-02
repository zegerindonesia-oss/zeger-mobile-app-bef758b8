import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Package, 
  Clock, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  XCircle,
  Loader2,
  User,
  DollarSign,
  Eye,
  Navigation
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MobileIncomingOrder } from './MobileIncomingOrder';

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
  rider_id: string | null;
  status: string;
  order_type: string;
  payment_method: string;
  total_price: number;
  delivery_address: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_arrival: string | null;
  rejection_reason: string | null;
  created_at: string;
  customer_users: {
    name: string;
    phone: string;
  };
  customer_order_items: OrderItem[];
}

export function MobileOrdersOnline() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<CustomerOrder | null>(null);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchOrders();
    getCurrentLocation();
    
    // Subscribe to realtime updates for all order changes
    const allOrdersChannel = supabase
      .channel('customer_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `rider_id=eq.${userProfile?.id}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    // Subscribe specifically for new incoming orders (INSERT events)
    const incomingOrdersChannel = supabase
      .channel('incoming_orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_orders',
          filter: `rider_id=eq.${userProfile?.id}`
        },
        async (payload) => {
          console.log('New order incoming:', payload);
          
          // Fetch full order details
          const { data, error } = await supabase
            .from('customer_orders')
            .select(`
              *,
              customer_users!customer_orders_user_id_fkey (name, phone),
              customer_order_items (
                id,
                product_id,
                quantity,
                price,
                products (name, code)
              )
            `)
            .eq('id', payload.new.id)
            .eq('status', 'pending')
            .single();

          if (!error && data) {
            setIncomingOrder(data as CustomerOrder);
            setShowIncomingModal(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(allOrdersChannel);
      supabase.removeChannel(incomingOrdersChannel);
    };
  }, [userProfile?.id]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setRiderLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customer_users!customer_orders_user_id_fkey (name, phone),
          customer_order_items (
            id,
            product_id,
            quantity,
            price,
            products (name, code)
          )
        `)
        .eq('rider_id', userProfile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Gagal memuat pesanan');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      setProcessingOrder(orderId);
      
      const { error } = await supabase.functions.invoke('rider-respond-order', {
        body: {
          order_id: orderId,
          rider_profile_id: userProfile?.id,
          action: 'accept'
        }
      });

      if (error) throw error;

      toast.success('Pesanan diterima!');
      
      // Vibrate device if supported
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Open Google Maps for navigation
      const order = orders.find(o => o.id === orderId);
      if (order && order.latitude && order.longitude) {
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
        window.open(mapsUrl, '_blank');
      }
      
      fetchOrders();
      setShowIncomingOrder(false);
    } catch (error) {
      console.error('Error accepting order:', error);
      toast.error('Gagal menerima pesanan');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleRejectOrder = async (orderId: string, reason: string) => {
    try {
      setProcessingOrder(orderId);
      
      const { error } = await supabase.functions.invoke('rider-respond-order', {
        body: {
          order_id: orderId,
          rider_profile_id: userProfile?.id,
          action: 'reject',
          rejection_reason: reason
        }
      });

      if (error) throw error;

      toast.success('Pesanan ditolak');
      fetchOrders();
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error('Gagal menolak pesanan');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      setProcessingOrder(orderId);
      
      const { error } = await supabase
        .from('customer_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Insert status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: newStatus
        });

      toast.success('Status pesanan diperbarui');
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal memperbarui status');
    } finally {
      setProcessingOrder(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: 'Menunggu' },
      accepted: { variant: 'default', label: 'Diterima' },
      in_progress: { variant: 'default', label: 'Dalam Pengiriman' },
      completed: { variant: 'default', label: 'Selesai' },
      rejected: { variant: 'destructive', label: 'Ditolak' },
      cancelled: { variant: 'destructive', label: 'Dibatalkan' }
    };

    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const filterOrders = (status: string) => {
    if (status === 'all') return orders;
    return orders.filter(order => order.status === status);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <MobileIncomingOrder
        order={incomingOrder}
        isOpen={showIncomingModal}
        onClose={() => setShowIncomingModal(false)}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
        riderLocation={riderLocation}
      />

      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Order Online</h2>
          <p className="text-muted-foreground">Kelola pesanan dari Zeger App</p>
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="pending">Menunggu</TabsTrigger>
          <TabsTrigger value="in_progress">Proses</TabsTrigger>
          <TabsTrigger value="completed">Selesai</TabsTrigger>
          <TabsTrigger value="rejected">Batal</TabsTrigger>
        </TabsList>

        {['all', 'pending', 'in_progress', 'completed', 'rejected'].map(status => (
          <TabsContent key={status} value={status} className="space-y-4 mt-4">
            {filterOrders(status).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Tidak ada pesanan</p>
                </CardContent>
              </Card>
            ) : (
              filterOrders(status).map(order => (
                <Card key={order.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          Order #{order.id.slice(0, 8)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Customer Info */}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{order.customer_users.name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_users.phone}</p>
                      </div>
                    </div>

                    {/* Delivery Address */}
                    {order.delivery_address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <p className="text-sm flex-1">{order.delivery_address}</p>
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-2">
                      {order.customer_order_items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.products.name}</span>
                          <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Total</span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(order.total_price)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      {/* View Detail Button - Available for all statuses */}
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/customer-app?tab=order-detail&id=${order.id}`)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Detail
                      </Button>
                      
                      {order.status === 'pending' && (
                        <>
                          <Button
                            onClick={() => handleAcceptOrder(order.id)}
                            disabled={processingOrder === order.id}
                            className="flex-1"
                          >
                            {processingOrder === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Terima
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleRejectOrder(order.id, 'Stok tidak tersedia')}
                            disabled={processingOrder === order.id}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Tolak
                          </Button>
                        </>
                      )}
                      
                       {order.status === 'accepted' && (
                        <>
                          <Button
                            onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                            disabled={processingOrder === order.id}
                            className="flex-1"
                          >
                            Mulai Pengiriman
                          </Button>
                          {order.latitude && order.longitude && (
                            <Button
                              variant="outline"
                              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank')}
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              Rute
                            </Button>
                          )}
                        </>
                      )}
                      
                      {order.status === 'in_progress' && (
                        <>
                          <Button
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                            disabled={processingOrder === order.id}
                            className="flex-1"
                          >
                            Tiba di Lokasi
                          </Button>
                          {order.latitude && order.longitude && (
                            <Button
                              variant="outline"
                              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank')}
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              Rute
                            </Button>
                          )}
                        </>
                      )}

                      {order.customer_users.phone && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(`tel:${order.customer_users.phone}`)}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </>
  );
}
