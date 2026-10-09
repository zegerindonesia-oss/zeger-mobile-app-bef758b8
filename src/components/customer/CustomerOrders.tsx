import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Clock, Package, CheckCircle2, XCircle, MapPin, RefreshCw, Phone, ChevronRight,
  Store, Bike, Receipt, Navigation,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { artworkFor, cxArt, formatRupiah, onArtError } from '@/lib/customer-art';
import { describeCustomizations } from '@/lib/customer-pricing';
import { normalizeImageUrl } from '@/lib/image-url';
import { cn } from '@/lib/utils';
import CustomerOrderTracking from './CustomerOrderTracking';

export interface ReorderItem {
  product_id: string;
  quantity: number;
  custom_options: any;
}

interface CustomerOrdersProps {
  customerUser: any;
  onReorder?: (items: ReorderItem[]) => void;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  custom_options: any;
  product: { name: string; image_url?: string; category?: string } | null;
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
  rider_profile_id: string | null;
  latitude: number | null;
  longitude: number | null;
  order_items: OrderItem[];
  rider?: { id: string; full_name: string; phone: string; photo_url?: string } | null;
}

type Tone = 'wait' | 'move' | 'done' | 'stop';

const STATUS: Record<string, { label: string; tone: Tone; icon: typeof Clock }> = {
  pending: { label: 'Menunggu konfirmasi', tone: 'wait', icon: Clock },
  accepted: { label: 'Diterima rider', tone: 'move', icon: CheckCircle2 },
  confirmed: { label: 'Dikonfirmasi', tone: 'move', icon: CheckCircle2 },
  preparing: { label: 'Sedang dibuat', tone: 'move', icon: Package },
  in_progress: { label: 'Dalam perjalanan', tone: 'move', icon: Navigation },
  on_the_way: { label: 'Dalam perjalanan', tone: 'move', icon: Navigation },
  on_delivery: { label: 'Dalam pengiriman', tone: 'move', icon: Navigation },
  ready: { label: 'Siap diambil', tone: 'move', icon: Store },
  delivered: { label: 'Selesai', tone: 'done', icon: CheckCircle2 },
  completed: { label: 'Selesai', tone: 'done', icon: CheckCircle2 },
  cancelled: { label: 'Dibatalkan', tone: 'stop', icon: XCircle },
  rejected: { label: 'Ditolak', tone: 'stop', icon: XCircle },
};

const TONE_CLASS: Record<Tone, string> = {
  wait: 'bg-amber-100 text-amber-800',
  move: 'bg-zeger-soft text-zeger',
  done: 'bg-emerald-100 text-emerald-700',
  stop: 'bg-rose-100 text-rose-700',
};

const ACTIVE = ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'in_progress', 'on_the_way', 'on_delivery'];
const CLOSED = ['delivered', 'completed', 'cancelled', 'rejected'];

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Tunai', tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer bank',
  card: 'Kartu', ewallet: 'E-wallet', va: 'Virtual account',
};

const waLink = (phone?: string | null) => {
  if (!phone) return null;
  let n = String(phone).replace(/\D/g, '');
  if (n.startsWith('0')) n = `62${n.slice(1)}`;
  else if (!n.startsWith('62')) n = `62${n}`;
  return `https://wa.me/${n}`;
};

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  }).format(d).replace('.', ':');
};

export function CustomerOrders({ customerUser, onReorder }: CustomerOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (!customerUser?.id) return;
    fetchOrders();

    const channel = supabase
      .channel('customer_orders_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `user_id=eq.${customerUser.id}` },
        (payload) => {
          const updated: any = payload.new;
          if (updated?.status === 'delivered' || updated?.status === 'completed') {
            new Audio('/sounds/zeger-notification.mp3').play().catch(() => {});
            toast({ title: 'Pesanan selesai', description: 'Selamat menikmati Zeger kamu!', duration: 5000 });
          }
          fetchOrders();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerUser?.id]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          order_items:customer_order_items(
            *,
            product:products(name, image_url, category)
          ),
          rider:profiles!rider_profile_id(id, full_name, phone, photo_url)
        `)
        .eq('user_id', customerUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = useMemo(() => orders.filter(o => ACTIVE.includes(o.status)), [orders]);
  const pastOrders = useMemo(() => orders.filter(o => CLOSED.includes(o.status)), [orders]);

  const contactRider = (rider: any) => {
    const link = waLink(rider?.phone);
    if (!link) {
      toast({ title: 'Nomor tidak tersedia', description: 'Nomor rider belum terdaftar.', variant: 'destructive' });
      return;
    }
    window.open(link, '_blank');
  };

  const handleReorder = (order: Order) => {
    const items = (order.order_items || [])
      .filter(i => i.product_id)
      .map(i => ({ product_id: i.product_id, quantity: i.quantity || 1, custom_options: i.custom_options }));
    if (!items.length) {
      toast({ title: 'Tidak bisa diulang', description: 'Menu pesanan ini sudah tidak tersedia.', variant: 'destructive' });
      return;
    }
    if (onReorder) onReorder(items);
    else toast({ title: 'Segera hadir', description: 'Fitur pesan lagi sedang disiapkan.' });
  };

  /* ---------------- tracking deep-link ---------------- */
  const currentTab = searchParams.get('tab');
  const trackingOrderId = searchParams.get('orderId');

  if (currentTab === 'tracking' && trackingOrderId && !loading) {
    const t = orders.find(o => o.id === trackingOrderId);
    if (t && t.rider && t.latitude && t.longitude) {
      return (
        <CustomerOrderTracking
          orderId={t.id}
          rider={{ id: t.rider.id, full_name: t.rider.full_name, phone: t.rider.phone, photo_url: t.rider.photo_url }}
          customerLat={t.latitude}
          customerLng={t.longitude}
          deliveryAddress={t.delivery_address}
          onCompleted={() => { setSearchParams({ tab: 'orders' }); fetchOrders(); }}
        />
      );
    }
  }

  /* ---------------- card ---------------- */
  const OrderCard = ({ order }: { order: Order }) => {
    const meta = STATUS[order.status] || { label: order.status, tone: 'wait' as Tone, icon: Clock };
    const StatusIcon = meta.icon;
    const wheels = order.order_type === 'on_the_wheels';
    const canTrack = wheels && order.rider_profile_id && ['accepted', 'in_progress', 'on_the_way', 'on_delivery'].includes(order.status);
    const canCallRider = !!order.rider && ACTIVE.includes(order.status);
    const closed = CLOSED.includes(order.status);
    const items = order.order_items || [];

    return (
      <article className="cx-card cx-rise overflow-hidden rounded-[24px]">
        {/* header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <span className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            wheels ? 'bg-zeger-soft text-zeger' : 'bg-emerald-50 text-emerald-600',
          )}>
            {wheels ? <Bike className="h-5 w-5" /> : <Store className="h-5 w-5" />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">
              {wheels ? 'Zeger On The Wheels' : 'Zeger Branch'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              #{order.id.slice(0, 8).toUpperCase()} • {formatWhen(order.created_at)}
            </p>
          </div>

          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold', TONE_CLASS[meta.tone])}>
            <StatusIcon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>

        {/* items */}
        <div className="space-y-2.5 px-4">
          {items.slice(0, 3).map((item) => {
            const art = artworkFor({ name: item.product?.name, category: item.product?.category });
            const detail = describeCustomizations(item.custom_options);
            return (
              <div key={item.id} className="flex items-center gap-3">
                <div className="cx-stage flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                  <img
                    src={normalizeImageUrl(item.product?.image_url) || art}
                    onError={onArtError(art)}
                    alt=""
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.product?.name || 'Menu Zeger'}</p>
                  {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
                  <p className="text-[11px] text-muted-foreground">{item.quantity}× {formatRupiah(item.price)}</p>
                </div>
                <p className="cx-num shrink-0 text-sm font-bold">{formatRupiah(item.price * item.quantity)}</p>
              </div>
            );
          })}
          {items.length > 3 && (
            <p className="text-[11px] font-semibold text-muted-foreground">+{items.length - 3} menu lainnya</p>
          )}
        </div>

        {/* totals */}
        <div className="mt-3 space-y-1.5 border-t border-dashed border-[hsl(var(--cx-line))] px-4 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="cx-num text-base font-extrabold text-zeger">{formatRupiah(order.total_price)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Pembayaran</span>
            <span className="font-semibold text-foreground">
              {PAYMENT_LABEL[String(order.payment_method || '').toLowerCase()] || order.payment_method || '-'}
            </span>
          </div>
          {order.delivery_address && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">{order.delivery_address}</span>
            </p>
          )}
        </div>

        {/* actions */}
        <div className="flex flex-wrap gap-2 p-4 pt-3">
          <button
            onClick={() => setSearchParams({ tab: 'order-detail', id: order.id })}
            className="cx-btn cx-btn-ghost flex-1 justify-between px-4 py-2.5 text-xs"
          >
            <span className="inline-flex items-center gap-1.5"><Receipt className="h-4 w-4" />Lihat detail</span>
            <ChevronRight className="h-4 w-4" />
          </button>

          {canTrack && (
            <button
              onClick={() => setSearchParams({ tab: 'tracking', orderId: order.id })}
              className="cx-btn cx-btn-primary w-full px-4 py-2.5 text-xs"
            >
              <Navigation className="h-4 w-4" /> Lacak rider
            </button>
          )}

          {canCallRider && (
            <button onClick={() => contactRider(order.rider)} className="cx-btn cx-btn-ghost flex-1 px-4 py-2.5 text-xs">
              <Phone className="h-4 w-4" /> Hubungi rider
            </button>
          )}

          {closed && !['cancelled', 'rejected'].includes(order.status) && (
            <button onClick={() => handleReorder(order)} className="cx-btn cx-btn-primary flex-1 px-4 py-2.5 text-xs">
              <RefreshCw className="h-4 w-4" /> Pesan lagi
            </button>
          )}
        </div>
      </article>
    );
  };

  const list = tab === 'active' ? activeOrders : pastOrders;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      <header className="sticky top-0 z-20 cx-bar px-5 pb-3 pt-5">
        <h1 className="cx-display text-xl font-extrabold">Pesanan Saya</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Pantau pesanan berjalan dan riwayat belanjamu</p>

        <div className="cx-seg mt-3 grid grid-cols-2 gap-1">
          <button className="cx-seg-item py-2 text-xs" data-active={tab === 'active'} onClick={() => setTab('active')}>
            Aktif {activeOrders.length > 0 && `(${activeOrders.length})`}
          </button>
          <button className="cx-seg-item py-2 text-xs" data-active={tab === 'history'} onClick={() => setTab('history')}>
            Riwayat {pastOrders.length > 0 && `(${pastOrders.length})`}
          </button>
        </div>
      </header>

      <div className="space-y-3 px-5 pt-4">
        {loading ? (
          [0, 1, 2].map(i => <div key={i} className="cx-shimmer h-44 rounded-[24px]" />)
        ) : list.length === 0 ? (
          <div className="cx-card flex flex-col items-center gap-3 rounded-[26px] px-6 py-10 text-center">
            <img src={tab === 'active' ? cxArt.scooter : cxArt.bag} alt="" className="cx-art cx-float h-24 w-24" />
            <p className="text-base font-extrabold">
              {tab === 'active' ? 'Belum ada pesanan berjalan' : 'Riwayat masih kosong'}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {tab === 'active'
                ? 'Pesanan yang sedang diproses akan muncul di sini lengkap dengan posisi rider.'
                : 'Setiap pesanan selesai tersimpan di sini supaya gampang dipesan ulang.'}
            </p>
          </div>
        ) : (
          list.map(order => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}
