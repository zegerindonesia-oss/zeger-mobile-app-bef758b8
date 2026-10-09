import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAppConfig } from "@/hooks/useCustomerAppConfig";
import {
  ChevronLeft, Store, ShoppingBag, Bike, Ticket, ChevronRight, Clock, Check, Info, Wallet, Banknote, QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cxArt, artworkFor, onArtError, formatRupiah } from "@/lib/customer-art";
import { cartSubtotal, unitPrice, describeCustomizations, pointsFor } from "@/lib/customer-pricing";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  category?: string;
  customizations?: any;
}

interface CustomerUser {
  id: string;
  points: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface ClaimedVoucher {
  id: string;
  voucher_id: string;
  voucher: {
    id: string;
    code: string;
    description: string | null;
    discount_type: string;
    discount_value: number;
    min_order: number | null;
    valid_until: string | null;
  } | null;
}

interface CustomerCheckoutProps {
  cart: CartItem[];
  outletId: string;
  outletName: string;
  outletAddress: string;
  outletDistance?: string;
  customerUser: CustomerUser;
  onConfirm: (orderData: any) => void;
  onBack: () => void;
  onChangeOutlet?: () => void;
  initialOrderType?: "outlet_pickup" | "outlet_delivery";
}

const PAYMENTS = [
  { id: "e_wallet", label: "E-Wallet / QRIS", hint: "Bayar lewat QRIS di aplikasi", icon: QrCode },
  { id: "transfer", label: "Transfer Bank", hint: "Konfirmasi otomatis", icon: Wallet },
  { id: "cash", label: "Tunai di Outlet", hint: "Bayar saat pesanan diambil", icon: Banknote },
] as const;

const PICKUP_TIMES = [
  { value: "now", label: "Sekarang" },
  { value: "15", label: "15 menit" },
  { value: "30", label: "30 menit" },
  { value: "60", label: "1 jam" },
];

export default function CustomerCheckout({
  cart, outletId, outletName, outletAddress, outletDistance, customerUser,
  onConfirm, onBack, onChangeOutlet, initialOrderType = "outlet_pickup",
}: CustomerCheckoutProps) {
  const { toast } = useToast();
  const cfg = useCustomerAppConfig();
  const [orderType, setOrderType] = useState<"outlet_pickup" | "outlet_delivery">(initialOrderType);
  const [deliveryAddress, setDeliveryAddress] = useState(customerUser.address || "");
  const [pickupTime, setPickupTime] = useState("now");
  const [paymentMethod, setPaymentMethod] = useState<string>("e_wallet");
  const [usePoints, setUsePoints] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vouchers, setVouchers] = useState<ClaimedVoucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<ClaimedVoucher | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);

  useEffect(() => { setOrderType(initialOrderType); }, [initialOrderType]);

  const subtotal = useMemo(() => cartSubtotal(cart as any), [cart]);

  // Claimed, unused, still-valid vouchers for this member
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!customerUser?.id) return;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const { data } = await supabase
        .from('customer_user_vouchers')
        .select('id, voucher_id, voucher:customer_vouchers(id, code, description, discount_type, discount_value, min_order, valid_until)')
        .eq('user_id', customerUser.id)
        .eq('is_used', false);
      if (!alive) return;
      const usable = ((data as any[]) || []).filter((v) => v.voucher && (!v.voucher.valid_until || v.voucher.valid_until >= today));
      setVouchers(usable as ClaimedVoucher[]);
    })();
    return () => { alive = false; };
  }, [customerUser?.id]);

  const deliveryFee = orderType === "outlet_delivery" ? cfg.order.delivery_fee : 0;
  const takeAwayCharge = orderType === "outlet_pickup" ? cfg.order.takeaway_charge : 0;
  const deliveryDiscount = orderType === "outlet_delivery"
    ? Math.floor(deliveryFee * (cfg.order.delivery_discount_percent / 100))
    : 0;
  const shippingDue = Math.max(0, deliveryFee - deliveryDiscount);

  const voucherDiscount = useMemo(
    () => voucherDiscountFor(selectedVoucher?.voucher, { subtotal, shippingDue }),
    [selectedVoucher, subtotal, shippingDue],
  );

  const afterVoucher = Math.max(0, subtotal - voucherDiscount);
  const maxPointsCanUse = Math.max(0, Math.min(customerUser.points || 0, Math.floor(afterVoucher / 500)));
  const pointsDiscount = usePoints ? maxPointsCanUse * 500 : 0;
  const total = Math.max(0, subtotal + deliveryFee + takeAwayCharge - deliveryDiscount - voucherDiscount - pointsDiscount);
  const earnedPoints = pointsFor(total);

  useEffect(() => {
    if (usePoints && maxPointsCanUse === 0) setUsePoints(false);
  }, [usePoints, maxPointsCanUse]);

  const handleConfirmOrder = () => {
    if (orderType === "outlet_delivery" && !deliveryAddress.trim()) {
      toast({ title: "Alamat belum diisi", description: "Masukkan alamat pengiriman dulu ya.", variant: "destructive" });
      return;
    }
    setLoading(true);
    onConfirm({
      outletId,
      orderType,
      deliveryAddress: orderType === "outlet_delivery" ? deliveryAddress : undefined,
      deliveryLat: customerUser.latitude,
      deliveryLng: customerUser.longitude,
      pickupTime,
      paymentMethod,
      subtotal,
      totalPrice: total,
      deliveryFee,
      takeAwayCharge,
      discount: deliveryDiscount + pointsDiscount + voucherDiscount,
      voucherDiscount,
      userVoucherId: voucherDiscount > 0 ? selectedVoucher?.id : undefined,
      voucherCode: voucherDiscount > 0 ? selectedVoucher?.voucher?.code : undefined,
      pointsUsed: usePoints ? maxPointsCanUse : 0,
      pointsEarned: earnedPoints,
    });
  };

  const disabled = loading || (orderType === 'outlet_delivery' && !deliveryAddress.trim());

  return (
    <div className="cx-app min-h-screen pb-48">
      <header className="cx-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Pembayaran</h1>
      </header>

      <main className="px-4 pt-4 space-y-4">
        {/* Mode */}
        <div className="cx-seg grid grid-cols-2 gap-1">
          <button
            type="button"
            data-active={orderType === 'outlet_pickup'}
            onClick={() => setOrderType('outlet_pickup')}
            className="cx-seg-item flex items-center justify-center gap-2 py-2.5 text-sm"
          >
            <ShoppingBag className="h-4 w-4" /> Ambil Sendiri
          </button>
          <button
            type="button"
            data-active={orderType === 'outlet_delivery'}
            onClick={() => setOrderType('outlet_delivery')}
            className="cx-seg-item flex items-center justify-center gap-2 py-2.5 text-sm"
          >
            <Bike className="h-4 w-4" /> Diantar
          </button>
        </div>

        {/* Outlet */}
        <div className="cx-card rounded-3xl p-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-zeger-soft flex items-center justify-center shrink-0">
              <Store className="h-5 w-5 text-zeger" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {orderType === 'outlet_pickup' ? 'Ambil di' : 'Dikirim dari'}
              </p>
              <p className="font-bold text-sm truncate">{outletName || 'Pilih outlet'}</p>
              {outletAddress && <p className="text-xs text-muted-foreground line-clamp-2">{outletAddress}</p>}
            </div>
            {onChangeOutlet && (
              <button onClick={onChangeOutlet} className="cx-btn cx-btn-ghost px-4 py-2 text-xs shrink-0">Ubah</button>
            )}
          </div>

          {orderType === 'outlet_delivery' ? (
            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="cx-address">Alamat Pengiriman</label>
              <textarea
                id="cx-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={2}
                placeholder="Nama jalan, nomor rumah, patokan..."
                className="mt-1.5 w-full rounded-2xl border border-[hsl(var(--cx-line))] bg-white px-4 py-3 text-sm outline-none focus:border-zeger/50 focus:ring-4 focus:ring-zeger/10 resize-none"
              />
              <div className="mt-3 cx-ride-track rounded-2xl bg-zeger-soft/60 h-16 flex items-center px-4">
                <img src={cxArt.scooter} alt="" className="cx-ride h-12 w-12 object-contain" />
                <p className="ml-2 text-xs font-semibold text-zeger-dark">Rider Zeger siap antar pesananmu.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Waktu Pengambilan
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {PICKUP_TIMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    data-active={pickupTime === t.value}
                    onClick={() => setPickupTime(t.value)}
                    className="cx-chip px-4 py-2 text-xs"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="cx-card rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Pesananmu</h2>
            <button onClick={onBack} className="cx-btn cx-btn-ghost px-4 py-2 text-xs">Tambah Menu</button>
          </div>
          <div className="space-y-3">
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="flex items-center gap-3">
                <div className="cx-stage h-14 w-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={item.image_url || artworkFor(item)}
                    alt={item.name}
                    onError={onArtError(artworkFor(item))}
                    className={cn('h-full w-full object-cover', !item.image_url && 'cx-art object-contain p-1')}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{item.quantity}× {item.name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{describeCustomizations(item.customizations)}</p>
                </div>
                <p className="cx-num text-sm font-bold">{formatRupiah(unitPrice(item as any) * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Voucher */}
        <button
          type="button"
          onClick={() => setShowVouchers((s) => !s)}
          className="cx-card rounded-3xl p-4 w-full flex items-center gap-3 text-left"
        >
          <div className="h-11 w-11 rounded-2xl bg-zeger-soft flex items-center justify-center shrink-0">
            <Ticket className="h-5 w-5 text-zeger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{selectedVoucher ? selectedVoucher.voucher?.code : 'Pakai Voucher'}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {selectedVoucher
                ? (voucherDiscount > 0 ? `Hemat ${formatRupiah(voucherDiscount)}` : `Min. belanja ${formatRupiah(selectedVoucher.voucher?.min_order || 0)}`)
                : `${vouchers.length} voucher siap dipakai`}
            </p>
          </div>
          <ChevronRight className={cn('h-5 w-5 text-muted-foreground transition-transform', showVouchers && 'rotate-90')} />
        </button>

        {showVouchers && (
          <div className="space-y-2 cx-rise">
            {vouchers.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">Belum ada voucher. Klaim dulu di tab Voucher.</p>
            )}
            {vouchers.map((uv) => {
              const v = uv.voucher!;
              const eligible = (v.min_order || 0) <= subtotal;
              const active = selectedVoucher?.id === uv.id;
              return (
                <button
                  key={uv.id}
                  type="button"
                  disabled={!eligible}
                  onClick={() => setSelectedVoucher(active ? null : uv)}
                  data-active={active}
                  className={cn('cx-opt w-full px-4 py-3 flex items-center gap-3 text-left', !eligible && 'opacity-50')}
                >
                  <Ticket className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{v.code}</p>
                    <p className="text-[11px] opacity-80 truncate">
                      {v.description || (v.discount_type === 'percentage' ? `Diskon ${v.discount_value}%` : `Potongan ${formatRupiah(v.discount_value)}`)}
                      {(v.min_order || 0) > 0 ? ` • Min. ${formatRupiah(v.min_order || 0)}` : ''}
                    </p>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Points */}
        <div className="cx-card rounded-3xl p-4 flex items-center gap-3">
          <img src={cxArt.coin} alt="" className="cx-coin cx-coin-spin h-10 w-10 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Tukar Zeger Point</p>
            <p className="text-[11px] text-muted-foreground">
              Saldo {customerUser.points || 0} poin • bisa dipakai {maxPointsCanUse} poin ({formatRupiah(maxPointsCanUse * 500)})
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={usePoints}
            disabled={maxPointsCanUse === 0}
            onClick={() => setUsePoints((v) => !v)}
            className={cn(
              'relative h-7 w-12 rounded-full transition-all shrink-0 disabled:opacity-40',
              usePoints ? 'bg-zeger shadow-[inset_0_1px_3px_hsl(355_70%_30%/0.5)]' : 'bg-[hsl(var(--cx-rail))]'
            )}
          >
            <span className={cn(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all',
              usePoints ? 'left-[1.4rem]' : 'left-0.5'
            )} />
          </button>
        </div>

        {/* Payment method */}
        <div className="cx-card rounded-3xl p-4">
          <h2 className="text-base font-bold mb-3">Metode Pembayaran</h2>
          <div className="space-y-2">
            {PAYMENTS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-active={paymentMethod === p.id}
                onClick={() => setPaymentMethod(p.id)}
                className="cx-opt w-full px-4 py-3 flex items-center gap-3 text-left"
              >
                <p.icon className="h-[18px] w-[18px] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{p.label}</p>
                  <p className="text-[11px] opacity-80">{p.hint}</p>
                </div>
                {paymentMethod === p.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="cx-card rounded-3xl p-5">
          <button type="button" onClick={() => setShowBreakdown((s) => !s)} className="w-full flex items-center justify-between">
            <h2 className="text-base font-bold">Ringkasan Pembayaran</h2>
            <span className="text-xs text-zeger font-semibold">{showBreakdown ? 'Sembunyikan' : 'Rincian'}</span>
          </button>
          {showBreakdown && (
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Subtotal" value={formatRupiah(subtotal)} />
              {takeAwayCharge > 0 && <Row label="Biaya kemasan" value={formatRupiah(takeAwayCharge)} />}
              {deliveryFee > 0 && <Row label="Ongkos kirim" value={formatRupiah(deliveryFee)} />}
              {deliveryDiscount > 0 && <Row label={`Diskon ongkir ${cfg.order.delivery_discount_percent}%`} value={`-${formatRupiah(deliveryDiscount)}`} accent />}
              {voucherDiscount > 0 && <Row label={`Voucher ${selectedVoucher?.voucher?.code}`} value={`-${formatRupiah(voucherDiscount)}`} accent />}
              {pointsDiscount > 0 && <Row label={`Zeger Point (${maxPointsCanUse})`} value={`-${formatRupiah(pointsDiscount)}`} accent />}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-dashed border-[hsl(var(--cx-line))] flex items-end justify-between">
            <span className="text-sm font-bold">Total Bayar</span>
            <span className="cx-num text-2xl font-extrabold text-zeger">{formatRupiah(total)}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-zeger-cream px-3 py-2">
            <Info className="h-3.5 w-3.5 text-zeger-dark shrink-0" />
            <p className="text-[11px] text-zeger-dark font-medium">
              Kamu akan mendapat <span className="font-extrabold">{earnedPoints} poin</span> setelah pesanan selesai.
            </p>
          </div>
        </div>
      </main>

      {/* CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-[hsl(var(--cx-canvas))] via-[hsl(var(--cx-canvas))] to-transparent">
        <div className="mx-auto max-w-md">
          <button
            onClick={handleConfirmOrder}
            disabled={disabled}
            className="cx-btn cx-btn-primary w-full px-5 py-4 flex items-center justify-between"
          >
            <span className="text-sm">{loading ? 'Memproses...' : 'Buat Pesanan'}</span>
            <span className="cx-num text-base font-extrabold">{formatRupiah(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('cx-num font-semibold', accent && 'text-zeger')}>{value}</span>
    </div>
  );
}
