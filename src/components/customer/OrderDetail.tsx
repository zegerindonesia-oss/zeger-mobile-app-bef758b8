import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, MapPin, Clock, Package,
  User, CheckCircle, XCircle, AlertCircle,
  Navigation, Loader2, Store, Bike, Receipt
} from "lucide-react";
import { format } from "date-fns";
import { artworkFor, formatRupiah, onArtError } from "@/lib/customer-art";
import { describeCustomizations } from "@/lib/customer-pricing";
import { cn } from "@/lib/utils";

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

type Tone = 'wait' | 'move' | 'done' | 'stop';

const statusConfig: Record<string, { label: string; tone: Tone; icon: any }> = {
  pending: { label: 'Menunggu Konfirmasi', tone: 'wait', icon: Clock },
  accepted: { label: 'Dikonfirmasi', tone: 'move', icon: CheckCircle },
  confirmed: { label: 'Dikonfirmasi', tone: 'move', icon: CheckCircle },
  in_progress: { label: 'Dalam Pengiriman', tone: 'move', icon: Navigation },
  preparing: { label: 'Sedang Diproses', tone: 'move', icon: Package },
  on_delivery: { label: 'Dalam Pengiriman', tone: 'move', icon: Navigation },
  delivered: { label: 'Pesanan Selesai', tone: 'done', icon: CheckCircle },
  completed: { label: 'Selesai', tone: 'done', icon: CheckCircle },
  cancelled: { label: 'Dibatalkan', tone: 'stop', icon: XCircle },
  rejected: { label: 'Ditolak', tone: 'stop', icon: AlertCircle },
};

const toneClass: Record<Tone, string> = {
  wait: 'bg-amber-50 text-amber-700',
  move: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
  stop: 'bg-rose-50 text-rose-700',
};

const toneDot: Record<Tone, string> = {
  wait: 'bg-amber-400',
  move: 'bg-sky-500',
  done: 'bg-emerald-500',
  stop: 'bg-rose-500',
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

    const channel = supabase
      .channel('order-details')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
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
      setOrder(data as any);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Gagal memuat detail pesanan');
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
      const { error: updateError } = await supabase
        .from('customer_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({ order_id: orderId, status: newStatus, notes: `Status updated to ${newStatus}` });

      if (historyError) throw historyError;

      toast.success('Status pesanan berhasil diperbarui');
      fetchOrderDetail();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal memperbarui status pesanan');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;
    await handleUpdateStatus('cancelled');
  };

  const handleCallRider = () => {
    if (order?.rider?.phone) window.location.href = `tel:${order.rider.phone}`;
  };

  const handleNavigate = () => {
    if (order?.latitude && order?.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
    }
  };

  const goBack = onBack || (() => navigate(-1));

  if (loading) {
    return (
      <div className="cx-app flex min-h-screen items-center justify-center bg-[hsl(var(--cx-canvas))]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-zeger" />
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Memuat pesanan…</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="cx-app flex min-h-screen items-center justify-center bg-[hsl(var(--cx-canvas))] p-6">
        <div className="cx-card w-full max-w-sm rounded-[26px] p-8 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold">Pesanan tidak ditemukan</p>
          <button onClick={goBack} className="cx-btn cx-btn-primary mx-auto mt-5 px-6 py-3 text-xs">Kembali</button>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[order.status] || { label: order.status, tone: 'wait' as Tone, icon: Clock };
  const StatusIcon = statusInfo.icon;
  const isWheels = order.order_type === 'on_the_wheels';
  const subtotal = order.order_items?.reduce((sum, i) => sum + i.price * i.quantity, 0) || 0;
  const extras = Math.max(0, (order.total_price || 0) - subtotal);

  return (
    <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))] pb-28">
      {/* Header */}
      <header className="cx-bar sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
        <button onClick={goBack} aria-label="Kembali" className="cx-icon-btn h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold">Detail Pesanan</h1>
          <p className="cx-num truncate text-[11px] text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold', toneClass[statusInfo.tone])}>
          <StatusIcon className="h-3.5 w-3.5" /> {statusInfo.label}
        </span>
      </header>

      <div className="mx-auto w-full max-w-md space-y-4 px-5 pt-4">
        {/* Channel + schedule */}
        <section className="cx-card cx-rise rounded-[26px] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zeger to-zeger-dark text-white shadow-md">
              {isWheels ? <Bike className="h-5 w-5" /> : <Store className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{isWheels ? 'Zeger On The Wheels' : 'Zeger Branch'}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-[18px] bg-[hsl(var(--cx-rail))] p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">Tipe pesanan</p>
              <p className="mt-0.5 text-xs font-bold">{order.order_type === 'delivery' || order.order_type === 'outlet_delivery' ? 'Diantar' : isWheels ? 'Rider' : 'Ambil sendiri'}</p>
            </div>
            <div className="rounded-[18px] bg-[hsl(var(--cx-rail))] p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">Pembayaran</p>
              <p className="mt-0.5 text-xs font-bold uppercase">{order.payment_method || '-'}</p>
            </div>
            {order.estimated_arrival && (
              <div className="col-span-2 rounded-[18px] bg-[hsl(var(--cx-rail))] p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Estimasi tiba</p>
                <p className="mt-0.5 text-xs font-bold">{format(new Date(order.estimated_arrival), 'HH:mm')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Items */}
        <section className="cx-card cx-rise rounded-[26px] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
            <Package className="h-4 w-4 text-zeger" /> Item pesanan
          </h2>
          <div className="space-y-3">
            {order.order_items?.map((item) => {
              const art = artworkFor({ name: item.product?.name });
              const custom = describeCustomizations(item.custom_options);
              return (
                <div key={item.id} className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[16px] bg-[hsl(var(--cx-rail))]">
                    <img
                      src={item.product?.image_url || art}
                      onError={onArtError(art)}
                      alt={item.product?.name || 'Item'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.product?.name || 'Produk'}</p>
                    {custom && <p className="truncate text-[11px] text-muted-foreground">{custom}</p>}
                    <p className="cx-num mt-0.5 text-[11px] text-muted-foreground">{item.quantity}x · {formatRupiah(item.price)}</p>
                  </div>
                  <p className="cx-num shrink-0 text-sm font-bold">{formatRupiah(item.price * item.quantity)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-dashed border-[hsl(var(--cx-line))] pt-4 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="cx-num">{formatRupiah(subtotal)}</span>
            </div>
            {extras > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Ongkir & biaya lain</span>
                <span className="cx-num">{formatRupiah(extras)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 text-sm font-extrabold">
              <span>Total</span>
              <span className="cx-num text-zeger">{formatRupiah(order.total_price)}</span>
            </div>
          </div>
        </section>

        {/* Delivery / customer */}
        <section className="cx-card cx-rise space-y-3 rounded-[26px] p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <User className="h-4 w-4 text-zeger" /> Penerima
          </h2>
          <div className="rounded-[18px] bg-[hsl(var(--cx-rail))] p-3.5">
            <p className="text-sm font-bold">{order.customer_users?.name || '-'}</p>
            <p className="text-[11px] text-muted-foreground">{order.customer_users?.phone || '-'}</p>
          </div>
          {order.delivery_address && (
            <div className="flex items-start gap-2 rounded-[18px] bg-[hsl(var(--cx-rail))] p-3.5 text-xs leading-snug">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zeger" />
              <span className="flex-1">{order.delivery_address}</span>
            </div>
          )}
        </section>

        {/* Rider */}
        {order.rider_id && order.rider && (
          <section className="cx-card cx-rise space-y-3 rounded-[26px] p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <Bike className="h-4 w-4 text-zeger" /> Rider
            </h2>
            <div className="flex items-center gap-3 rounded-[18px] bg-[hsl(var(--cx-rail))] p-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-extrabold text-zeger shadow-sm">
                {(order.rider.name || 'R').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{order.rider.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{order.rider.phone}</p>
              </div>
            </div>
            {userRole === 'customer' && (
              <button onClick={handleCallRider} className="cx-btn cx-btn-ghost w-full py-3 text-xs">
                <Phone className="h-4 w-4" /> Hubungi rider
              </button>
            )}
          </section>
        )}

        {/* Timeline */}
        {statusHistory.length > 0 && (
          <section className="cx-card cx-rise rounded-[26px] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold">
              <Clock className="h-4 w-4 text-zeger" /> Riwayat status
            </h2>
            <div className="space-y-0">
              {statusHistory.map((history, index) => {
                const info = statusConfig[history.status] || { label: history.status, tone: 'wait' as Tone, icon: Clock };
                const last = index === statusHistory.length - 1;
                return (
                  <div key={history.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn('mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white', toneDot[info.tone])} />
                      {!last && <span className="my-1 w-0.5 flex-1 bg-[hsl(var(--cx-line))]" />}
                    </div>
                    <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-5')}>
                      <p className="text-xs font-bold">{info.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(history.created_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                      {history.notes && <p className="mt-0.5 text-[11px] text-muted-foreground">{history.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="space-y-2.5 pt-1">
          {userRole === 'customer' && order.status === 'pending' && (
            <button onClick={handleCancelOrder} disabled={updating} className="cx-btn cx-btn-ghost w-full py-3.5 text-xs text-destructive">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Batalkan pesanan
            </button>
          )}

          {userRole === 'rider' && order.status === 'pending' && (
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => handleUpdateStatus('confirmed')} disabled={updating} className="cx-btn cx-btn-primary py-3.5 text-xs">
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terima pesanan'}
              </button>
              <button onClick={() => handleUpdateStatus('rejected')} disabled={updating} className="cx-btn cx-btn-ghost py-3.5 text-xs text-destructive">
                Tolak pesanan
              </button>
            </div>
          )}

          {userRole === 'rider' && order.status === 'confirmed' && (
            <button onClick={() => handleUpdateStatus('preparing')} disabled={updating} className="cx-btn cx-btn-primary w-full py-3.5 text-xs">Mulai proses</button>
          )}
          {userRole === 'rider' && order.status === 'preparing' && (
            <button onClick={() => handleUpdateStatus('on_delivery')} disabled={updating} className="cx-btn cx-btn-primary w-full py-3.5 text-xs">Mulai pengiriman</button>
          )}
          {userRole === 'rider' && order.status === 'on_delivery' && (
            <button onClick={() => handleUpdateStatus('delivered')} disabled={updating} className="cx-btn cx-btn-primary w-full py-3.5 text-xs">Selesai diantar</button>
          )}
          {userRole === 'rider' && order.latitude && order.longitude && (
            <button onClick={handleNavigate} className="cx-btn cx-btn-ghost w-full py-3.5 text-xs">
              <Navigation className="h-4 w-4" /> Navigasi ke customer
            </button>
          )}

          {userRole === 'branch' && order.status !== 'cancelled' && order.status !== 'completed' && (
            <button onClick={handleCancelOrder} disabled={updating} className="cx-btn cx-btn-ghost w-full py-3.5 text-xs text-destructive">
              Batalkan pesanan
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
