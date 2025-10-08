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
      setShowIncomingModal(false);
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
              <Card className="relative z-20">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium">No</th>
                          <th className="px-4 py-3 text-left text-xs font-medium">No Trx</th>
                          <th className="px-4 py-3 text-left text-xs font-medium">Tanggal</th>
                          <th className="px-4 py-3 text-left text-xs font-medium">Nama</th>
                          <th className="px-4 py-3 text-left text-xs font-medium">Lokasi</th>
                          <th className="px-4 py-3 text-center text-xs font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filterOrders(status).map((order, index) => (
                          <tr key={order.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 text-sm">{index + 1}</td>
                            <td className="px-4 py-3 text-sm font-mono">{order.id.slice(0, 8)}</td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              {new Date(order.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium">{order.customer_users.name}</div>
                              <div className="text-xs text-muted-foreground">{order.customer_users.phone}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {order.latitude && order.longitude ? (
                                <a
                                  href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                >
                                  <MapPin className="h-4 w-4" />
                                  <span className="text-xs">Lihat</span>
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {order.status === 'completed' ? (
                                <div className="flex justify-center">
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(order.id, 'completed')}
                                  disabled={processingOrder === order.id}
                                  className="h-8 w-8 p-0"
                                >
                                  {processingOrder === order.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </>
  );
}
