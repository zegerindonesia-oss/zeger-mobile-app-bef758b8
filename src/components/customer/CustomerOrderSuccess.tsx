import { Check, Clock, MapPin, Navigation, Receipt, Share2, Store } from 'lucide-react';
import { cxArt } from '@/lib/customer-art';

interface CustomerOrderSuccessProps {
  orderId: string;
  orderNumber: string;
  orderType: 'outlet_pickup' | 'outlet_delivery';
  outletName?: string;
  outletAddress?: string;
  deliveryAddress?: string;
  estimatedTime: string;
  onNavigate: (view: string, orderId?: string) => void;
}

export default function CustomerOrderSuccess({
  orderId,
  orderNumber,
  orderType,
  outletName,
  outletAddress,
  deliveryAddress,
  estimatedTime,
  onNavigate,
}: CustomerOrderSuccessProps) {
  const isDelivery = orderType === 'outlet_delivery';

  const share = async () => {
    const text = `Pesanan Zeger ${orderNumber} lagi disiapkan ☕`;
    try {
      if (navigator.share) await navigator.share({ title: 'Zeger Coffee', text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* dibatalkan pengguna */
    }
  };

  return (
    <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))]">
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-8">
        {/* Hero */}
        <div className="cx-stage cx-rise relative overflow-hidden rounded-[32px] bg-gradient-to-br from-zeger-dark to-zeger px-6 pb-8 pt-9 text-center text-white">
          <div className="pointer-events-none absolute -left-10 top-8 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-zeger-gold/25 blur-3xl" />

          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/18 backdrop-blur-sm cx-pulse-ring">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zeger shadow-lg">
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
          </div>

          <h1 className="relative text-2xl font-extrabold tracking-tight">Pesanan berhasil!</h1>
          <p className="relative mt-1.5 text-sm text-white/85">
            {isDelivery
              ? 'Pesananmu sedang disiapkan dan akan segera diantar.'
              : 'Pesananmu sedang disiapkan, tinggal diambil di outlet.'}
          </p>

          <div className="relative mt-5 cx-ride-track mx-auto w-full max-w-[16rem]">
            <img
              src={isDelivery ? cxArt.scooter : cxArt.bag}
              alt=""
              className={`cx-art mx-auto h-28 w-auto ${isDelivery ? 'cx-ride' : 'cx-float'}`}
            />
          </div>

          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white/18 px-4 py-2 backdrop-blur-sm">
            <Receipt className="h-4 w-4" />
            <span className="cx-num text-sm font-bold tracking-wide">{orderNumber}</span>
          </div>
        </div>

        {/* Detail */}
        <div className="cx-card cx-rise mt-4 space-y-3.5 rounded-[26px] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zeger-soft text-zeger">
              <Clock className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estimasi</p>
              <p className="text-sm font-bold">{estimatedTime}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zeger-soft text-zeger">
              {isDelivery ? <Navigation className="h-4.5 w-4.5" /> : <Store className="h-4.5 w-4.5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isDelivery ? 'Diantar ke' : 'Ambil di'}
              </p>
              <p className="text-sm font-bold">{isDelivery ? deliveryAddress || 'Alamat tersimpan' : outletName || 'Outlet Zeger'}</p>
              {!isDelivery && outletAddress && (
                <p className="mt-0.5 flex items-start gap-1 text-xs leading-snug text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {outletAddress}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          <button onClick={() => onNavigate('order-tracking', orderId)} className="cx-btn cx-btn-primary w-full py-4 text-sm">
            Lacak pesanan
          </button>
          <button onClick={() => onNavigate('orders')} className="cx-btn cx-btn-ghost w-full py-3.5 text-sm">
            Lihat semua pesanan
          </button>
        </div>

        {/* Next */}
        <div className="mt-7">
          <h2 className="mb-3 pl-1 text-sm font-extrabold">Selanjutnya</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNavigate('menu')} className="cx-card cx-rise flex flex-col items-center gap-2 rounded-[22px] p-4 text-center transition active:scale-95">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zeger-soft text-zeger">
                <Store className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold leading-snug">Jelajahi menu lain</span>
            </button>
            <button onClick={() => onNavigate('vouchers')} className="cx-card cx-rise flex flex-col items-center gap-2 rounded-[22px] p-4 text-center transition active:scale-95">
              <img src={cxArt.gift} alt="" className="h-11 w-11 object-contain cx-art" />
              <span className="text-xs font-bold leading-snug">Klaim voucher baru</span>
            </button>
            <button onClick={() => onNavigate('loyalty')} className="cx-card cx-rise flex flex-col items-center gap-2 rounded-[22px] p-4 text-center transition active:scale-95">
              <img src={cxArt.coin} alt="" className="h-11 w-11 object-contain cx-coin cx-coin-spin" />
              <span className="text-xs font-bold leading-snug">Cek poin kamu</span>
            </button>
            <button onClick={share} className="cx-card cx-rise flex flex-col items-center gap-2 rounded-[22px] p-4 text-center transition active:scale-95">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zeger-soft text-zeger">
                <Share2 className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold leading-snug">Bagikan pesanan</span>
            </button>
          </div>
        </div>

        <button onClick={() => onNavigate('home')} className="mx-auto mt-6 block text-xs font-bold text-muted-foreground underline-offset-4 hover:underline">
          Kembali ke beranda
        </button>
      </div>
    </div>
  );
}
