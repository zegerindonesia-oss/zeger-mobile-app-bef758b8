import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, Phone, MapPin, Clock, Package, 
  DollarSign, User, CheckCircle, XCircle, AlertCircle,
  Navigation, Loader2
} from "lucide-react";
import { format } from "date-fns";

interface OrderDetailProps {
  orderId: string;
  userRole: 'customer' | 'rider' | 'branch';
  onBack?: () => void;
}

interface OrderData {
  id: string;
  status: string;
  total_price: number;
  payment_method: string;
  delivery_address: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
  estimated_arrival: string | null;
  user_id: string;
  rider_id: string | null;
  order_type: string;
  order_items: Array<{
    id: string;
    quantity: number;
    price: number;
    custom_options: any;
    product: {
      name: string;
      image_url: string | null;
    };
  }>;
  customer_users: {
    name: string;
    phone: string;
  };
  rider?: {
    name: string;
    phone: string;
  };
}

const statusConfig = {
  pending: { label: 'Menunggu', color: 'bg-yellow-500', icon: Clock },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-blue-500', icon: CheckCircle },
  preparing: { label: 'Diproses', color: 'bg-purple-500', icon: Package },
  on_delivery: { label: 'Dalam Pengiriman', color: 'bg-indigo-500', icon: Navigation },
  delivered: { label: 'Terkirim', color: 'bg-green-500', icon: CheckCircle },
  completed: { label: 'Selesai', color: 'bg-green-600', icon: CheckCircle },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-500', icon: XCircle },
  rejected: { label: 'Ditolak', color: 'bg-gray-500', icon: AlertCircle }
};

export const OrderDetail = ({ orderId, userRole, onBack }: OrderDetailProps) => {
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrderDetail();
    fetchStatusHistory();

    // Real-time subscription
    const channel = supabase
      .channel('order-details')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `id=eq.${orderId}`
        },
        () => {
          fetchOrderDetail();
          fetchStatusHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const fetchOrderDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          order_items:customer_order_items(
            id,
            quantity,
            price,
            custom_options,
            product:products(name, image_url)
          ),
          customer_users!customer_orders_user_id_fkey(name, phone),
          rider:customer_users!customer_orders_rider_id_fkey(name, phone)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Gagal memuat detail order');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStatusHistory(data || []);
    } catch (error) {
      console.error('Error fetching status history:', error);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      // Update order status
      const { error: updateError } = await supabase
        .from('customer_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Log status change
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: newStatus,
          notes: `Status updated to ${newStatus}`
        });

      if (historyError) throw historyError;

      toast.success('Status order berhasil diupdate');
      fetchOrderDetail();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal update status order');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan order ini?')) return;
    await handleUpdateStatus('cancelled');
  };

  const handleCallRider = () => {
    if (order?.rider?.phone) {
      window.location.href = `tel:${order.rider.phone}`;
    }
  };

  const handleNavigate = () => {
    if (order?.latitude && order?.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Order tidak ditemukan</p>
            <Button onClick={onBack || (() => navigate(-1))} className="mt-4">
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusConfig[order.status as keyof typeof statusConfig]?.icon || Clock;

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack || (() => navigate(-1))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Detail Order</h1>
          <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
        </div>
        <Badge className={statusConfig[order.status as keyof typeof statusConfig]?.color}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig[order.status as keyof typeof statusConfig]?.label}
        </Badge>
      </div>

      {/* Order Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Informasi Order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tipe Order</p>
              <p className="font-medium">{order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment</p>
              <p className="font-medium uppercase">{order.payment_method}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Waktu Order</p>
              <p className="font-medium">{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}</p>
            </div>
            {order.estimated_arrival && (
              <div>
                <p className="text-sm text-muted-foreground">Estimasi Tiba</p>
                <p className="font-medium">{format(new Date(order.estimated_arrival), 'HH:mm')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informasi Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Nama</p>
            <p className="font-medium">{order.customer_users.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="font-medium">{order.customer_users.phone}</p>
          </div>
          {order.delivery_address && (
            <div>
              <p className="text-sm text-muted-foreground">Alamat Pengiriman</p>
              <p className="font-medium">{order.delivery_address}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rider Information */}
      {order.rider_id && order.rider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Informasi Rider
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nama Rider</p>
              <p className="font-medium">{order.rider.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Rider</p>
              <p className="font-medium">{order.rider.phone}</p>
            </div>
            {userRole === 'customer' && (
              <Button onClick={handleCallRider} className="w-full">
                <Phone className="h-4 w-4 mr-2" />
                Hubungi Rider
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
              {item.product.image_url && (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="w-16 h-16 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <p className="font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity}x @ Rp {item.price.toLocaleString('id-ID')}
                </p>
                {item.custom_options && Object.keys(item.custom_options).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Object.entries(item.custom_options).map(([key, value]) => `${key}: ${value}`).join(', ')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-medium">
                  Rp {(item.quantity * item.price).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between items-center pt-2">
            <p className="font-bold text-lg">Total</p>
            <p className="font-bold text-lg text-primary">
              Rp {order.total_price.toLocaleString('id-ID')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      {statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusHistory.map((history, index) => (
                <div key={history.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${statusConfig[history.status as keyof typeof statusConfig]?.color || 'bg-gray-400'}`} />
                    {index < statusHistory.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-300 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">
                      {statusConfig[history.status as keyof typeof statusConfig]?.label || history.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(history.created_at), 'dd MMM yyyy, HH:mm')}
                    </p>
                    {history.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{history.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {userRole === 'customer' && order.status === 'pending' && (
              <Button
                variant="destructive"
                onClick={handleCancelOrder}
                disabled={updating}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Batalkan Order
              </Button>
            )}

            {userRole === 'rider' && order.status === 'pending' && (
              <>
                <Button
                  onClick={() => handleUpdateStatus('confirmed')}
                  disabled={updating}
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terima Order'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleUpdateStatus('rejected')}
                  disabled={updating}
                >
                  Tolak Order
                </Button>
              </>
            )}

            {userRole === 'rider' && order.status === 'confirmed' && (
              <Button
                onClick={() => handleUpdateStatus('preparing')}
                disabled={updating}
              >
                Mulai Proses
              </Button>
            )}

            {userRole === 'rider' && order.status === 'preparing' && (
              <Button
                onClick={() => handleUpdateStatus('on_delivery')}
                disabled={updating}
              >
                Mulai Pengiriman
              </Button>
            )}

            {userRole === 'rider' && order.status === 'on_delivery' && (
              <Button
                onClick={() => handleUpdateStatus('delivered')}
                disabled={updating}
              >
                Selesai Diantar
              </Button>
            )}

            {userRole === 'rider' && order.latitude && order.longitude && (
              <Button
                variant="outline"
                onClick={handleNavigate}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navigate ke Customer
              </Button>
            )}

            {userRole === 'branch' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {/* Implement assign rider */}}
                >
                  Assign Rider
                </Button>
                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <Button
                    variant="destructive"
                    onClick={handleCancelOrder}
                    disabled={updating}
                  >
                    Batalkan Order
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
