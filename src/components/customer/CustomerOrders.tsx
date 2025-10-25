import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Package, 
  CheckCircle, 
  XCircle,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Phone,
  Eye
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';

interface CustomerOrdersProps {
  customerUser: any;
}

interface Order {
  id: string;
  status: string;
  total_price: number;
  payment_method: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  order_type: string;
  order_items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  custom_options: any;
  product: {
    name: string;
    image_url?: string;
  };
}

const statusConfig = {
  pending: {
    label: 'Menunggu Konfirmasi',
    color: 'bg-yellow-100 text-yellow-700',
    icon: Clock
  },
  accepted: {
    label: 'Diterima Rider',
    color: 'bg-blue-100 text-blue-700',
    icon: Package
  },
  confirmed: {
    label: 'Dikonfirmasi',
    color: 'bg-blue-100 text-blue-700',
    icon: CheckCircle
  },
  in_progress: {
    label: 'Dalam Pengiriman',
    color: 'bg-indigo-100 text-indigo-700',
    icon: MapPin
  },
  preparing: {
    label: 'Diproses',
    color: 'bg-purple-100 text-purple-700',
    icon: Package
  },
  on_the_way: {
    label: 'Dalam Perjalanan',
    color: 'bg-orange-100 text-orange-700',
    icon: MapPin
  },
  on_delivery: {
    label: 'Dalam Pengiriman',
    color: 'bg-indigo-100 text-indigo-700',
    icon: MapPin
  },
  delivered: {
    label: 'Selesai',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle
  },
  completed: {
    label: 'Selesai',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle
  },
  cancelled: {
    label: 'Dibatalkan',
    color: 'bg-red-100 text-red-700',
    icon: XCircle
  },
  rejected: {
    label: 'Ditolak',
    color: 'bg-gray-100 text-gray-700',
    icon: XCircle
  }
};

export function CustomerOrders({ customerUser }: CustomerOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchOrders();
    
    // Set up real-time subscription for order updates
    const channel = supabase
      .channel('customer_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `user_id=eq.${customerUser?.id}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerUser]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          order_items:customer_order_items(
            *,
            product:products(name, image_url)
          )
        `)
        .eq('user_id', customerUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const reorder = async (order: Order) => {
    // Implementation for reordering
    console.log('Reordering:', order);
    // Navigate to cart with items pre-filled
  };

  const contactRider = () => {
    // Implementation for contacting rider
    console.log('Contacting rider');
  };

  const getActiveOrders = () => {
    return orders.filter(order => 
      ['pending', 'accepted', 'in_progress'].includes(order.status)
    );
  };

  const getCompletedOrders = () => {
    return orders.filter(order => 
      ['delivered', 'completed', 'cancelled', 'rejected'].includes(order.status)
    );
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const status = statusConfig[order.status as keyof typeof statusConfig] || {
      label: order.status,
      color: 'bg-gray-100 text-gray-700',
      icon: Clock
    };
    const StatusIcon = status.icon;

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {/* Order Type Badge */}
              {order.order_type === 'on_the_wheels' ? (
                <Badge className="mb-2 bg-[#EA2831] hover:bg-red-700 text-white border-0">
                  🏍️ Zeger On The Wheels
                </Badge>
              ) : (
                <Badge className="mb-2 bg-green-600 hover:bg-green-700 text-white border-0">
                  🏪 Zeger Branch
                </Badge>
              )}
              <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(order.created_at).toLocaleString('id-ID')}
              </p>
            </div>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Order Items */}
          <div className="space-y-2">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.product?.image_url ? (
                    <img 
                      src={item.product.image_url} 
                      alt={item.product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <ShoppingBag className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.product?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity}x @ Rp {item.price.toLocaleString()}
                  </p>
                  {item.custom_options && Object.keys(item.custom_options).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Customization: {JSON.stringify(item.custom_options)}
                    </p>
                  )}
                </div>
                <div className="text-sm font-medium">
                  Rp {(item.price * item.quantity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Order Details */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Pesanan:</span>
              <span className="font-semibold">Rp {order.total_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pembayaran:</span>
              <span className="capitalize">{order.payment_method}</span>
            </div>
            {order.delivery_address && (
              <div className="flex items-start space-x-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{order.delivery_address}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setSearchParams({ tab: 'order-detail', id: order.id })}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-1" />
              Lihat Detail
            </Button>
            
            {['delivered'].includes(order.status) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => reorder(order)}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Pesan Lagi
              </Button>
            )}
            
            {['accepted', 'on_the_way'].includes(order.status) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={contactRider}
                className="flex-1"
              >
                <Phone className="h-4 w-4 mr-1" />
                Hubungi Rider
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Memuat pesanan..." />;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="text-center space-y-2">
        <Package className="h-8 w-8 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Pesanan Saya</h2>
        <p className="text-muted-foreground">Lacak status pesanan Anda</p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Aktif ({getActiveOrders().length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Riwayat ({getCompletedOrders().length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {getActiveOrders().length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Tidak ada pesanan aktif"
              description="Pesanan yang sedang diproses akan muncul di sini"
            />
          ) : (
            getActiveOrders().map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          {getCompletedOrders().length === 0 ? (
            <EmptyState
              icon={Package}
              title="Belum ada riwayat pesanan"
              description="Pesanan yang selesai akan tersimpan di sini"
            />
          ) : (
            getCompletedOrders().map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}