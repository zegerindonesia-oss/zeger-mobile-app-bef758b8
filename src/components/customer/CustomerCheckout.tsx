import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAppConfig } from "@/hooks/useCustomerAppConfig";
import {
  ChevronLeft, Store, ShoppingBag, Bike, Ticket, ChevronRight, Clock, Check, Info, Plus, Wallet, Banknote, QrCode,
} from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validGuestIdentity, normalizeCustomerPhone } from '@/lib/customer-entry';
import { cn } from "@/lib/utils";
import AddressPinMap from "./AddressPinMap";
import { cxArt, artworkFor, onArtError, formatRupiah } from "@/lib/customer-art";
import { cartSubtotal, unitPrice, describeCustomizations, pointsFor } from "@/lib/customer-pricing";
import { voucherBlockedReason, voucherDiscountFor, voucherHeadline, voucherKind } from "@/lib/customer-voucher";

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
  suggestions?: any[];
  onQuickAdd?: (product: any) => void;
  onAddMore?: () => void;
  onOpenSubscription?: () => void;
  guestMode?: boolean;
  dineInTable?: string;
  submitting?: boolean;
}

const SNACK_RE = /(snack|food|makan|pastry|bakery|roti|cake|kue|cookie|croissant|toast|dessert)/i;

const PAYMENTS = [
  { id: "e_wallet", label: "E-Wallet / QRIS", hint: "Scan dari m-banking / e-wallet apa pun", icon: QrCode },
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
  suggestions = [], onQuickAdd, onAddMore, onOpenSubscription,
  guestMode = false, dineInTable, submitting = false,
}: CustomerCheckoutProps) {
  const { toast } = useToast();
  const cfg = useCustomerAppConfig();
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [orderType, setOrderType] = useState<"outlet_pickup" | "outlet_delivery">(initialOrderType);
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    if (customerUser.address) return customerUser.address;
    try { return JSON.parse(localStorage.getItem("cx_delivery_address_v1") || "null")?.address || ""; } catch { return ""; }
  });
  const [pickupTime, setPickupTime] = useState("now");
  const paymentMethod: string = "e_wallet";
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

  type Rate = { courier_code: string; service_code: string; name: string; price: number; eta?: string };
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateMsg, setRateMsg] = useState<string>("");
  const [courier, setCourier] = useState<Rate | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    customerUser.latitude && customerUser.longitude ? { lat: customerUser.latitude, lng: customerUser.longitude } : null,
  );
  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setPin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast({ title: "Lokasi tidak aktif", description: "Geser pin di peta ke rumahmu." }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  useEffect(() => {
    if (orderType !== "outlet_delivery") return;
    if (!pin) { setRateMsg("Tentukan titik lokasi di peta untuk cek ongkir."); setRates([]); setCourier(null); return; }
    let alive = true;
    setRates([]); setCourier(null);
    setRateMsg("Mengecek ongkir GoSend & GrabExpress...");
    const t = setTimeout(() => {
      supabase.functions.invoke("biteship-rates", {
        body: { outlet_id: outletId, dest_lat: pin.lat, dest_lng: pin.lng, value: Math.round(subtotal) },
      }).then(({ data, error }) => {
        if (!alive) return;
        const list: Rate[] = (data as any)?.rates || [];
        setRates(list);
        setCourier(list[0] || null);
        setRateMsg(error || !list.length ? ((data as any)?.error || "Kurir belum tersedia untuk lokasi ini.") : "");
      });
    }, 500);
    return () => { alive = false; clearTimeout(t); };
  }, [orderType, outletId, pin?.lat, pin?.lng, subtotal]);

  const deliveryFee = orderType === "outlet_delivery" ? (courier?.price ?? 0) : 0;
  const takeAwayCharge = dineInTable ? 0 : orderType === "outlet_pickup" ? cfg.order.takeaway_charge : 0;
  const deliveryDiscount = orderType === "outlet_delivery"
    ? Math.floor(deliveryFee * (cfg.order.delivery_discount_percent / 100))
    : 0;
  const shippingDue = Math.max(0, deliveryFee - deliveryDiscount);

  const voucherDiscount = useMemo(
    () => voucherDiscountFor(selectedVoucher?.voucher, { subtotal, shippingDue }),
    [selectedVoucher, subtotal, shippingDue],
  );

  const payableBeforePoints = Math.max(0, subtotal + takeAwayCharge + shippingDue - voucherDiscount);
  const maxPointsCanUse = Math.max(0, Math.min(customerUser.points || 0, Math.floor(payableBeforePoints / 500)));
  const pointsDiscount = usePoints ? maxPointsCanUse * 500 : 0;
  const total = Math.max(0, subtotal + deliveryFee + takeAwayCharge - deliveryDiscount - voucherDiscount - pointsDiscount);
  const earnedPoints = pointsFor(total);

  useEffect(() => {
    if (usePoints && maxPointsCanUse === 0) setUsePoints(false);
  }, [usePoints, maxPointsCanUse]);

  const handleConfirmOrder = async () => {
    if (guestMode && !validGuestIdentity(guestName, guestPhone)) { toast({ title: "Lengkapi nama dan nomor HP", variant: "destructive" }); return; }
    if (orderType === "outlet_delivery" && !deliveryAddress.trim()) {
      toast({ title: "Alamat belum diisi", description: "Masukkan alamat pengiriman dulu ya.", variant: "destructive" });
      return;
    }
    if (orderType === "outlet_delivery" && (!pin || !courier)) {
      toast({ title: "Pilih kurir dulu", description: "Tentukan titik lokasi lalu pilih GoSend atau GrabExpress.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try { await onConfirm({
      guestName: guestName.trim(),
      guestPhone: normalizeCustomerPhone(guestPhone),
      outletId,
      orderType,
      deliveryAddress: orderType === "outlet_delivery" ? deliveryAddress : undefined,
      deliveryLat: orderType === "outlet_delivery" ? pin?.lat : customerUser.latitude,
      deliveryLng: orderType === "outlet_delivery" ? pin?.lng : customerUser.longitude,
      pickupTime,
      paymentMethod,
      subtotal,
      totalPrice: total,
      deliveryFee,
      courier: orderType === "outlet_delivery" && courier ? courier : undefined,
      takeAwayCharge,
      discount: deliveryDiscount + pointsDiscount + voucherDiscount,
      voucherDiscount,
      userVoucherId: voucherDiscount > 0 ? selectedVoucher?.id : undefined,
      voucherCode: voucherDiscount > 0 ? selectedVoucher?.voucher?.code : undefined,
      pointsUsed: usePoints ? maxPointsCanUse : 0,
      pointsEarned: earnedPoints,
    }); } finally { setLoading(false); }
  };

  // Best usable voucher (highest saving) for the one-tap "Pakai" card.
  const bestVoucher = useMemo(() => {
    let best: { uv: ClaimedVoucher; value: number } | null = null;
    vouchers.forEach((uv) => {
      if (!uv.voucher || voucherBlockedReason(uv.voucher, { subtotal, shippingDue })) return;
      const value = voucherDiscountFor(uv.voucher, { subtotal, shippingDue });
      if (value > 0 && (!best || value > best.value)) best = { uv, value };
    });
    return best as { uv: ClaimedVoucher; value: number } | null;
  }, [vouchers, subtotal, shippingDue]);

  // Cross-sell: snacks/food first, then other menus, never items already in cart.
  const crossSell = useMemo(() => {
    const inCart = new Set(cart.map((c) => c.id));
    const pool = suggestions.filter((p) => !inCart.has(p.id) && Number(p.price) > 0);
    const isSnack = (p: any) => SNACK_RE.test(`${p.category || ''} ${p.sub_category || ''} ${p.name}`);
    return [...pool.filter(isSnack), ...pool.filter((p) => !isSnack(p))].slice(0, 8);
  }, [suggestions, cart]);

  const disabled = loading || submitting || (orderType === 'outlet_delivery' && (!deliveryAddress.trim() || !courier));

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
        {!dineInTable && <div className="cx-seg grid grid-cols-2 gap-1">
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

        }
        {guestMode && <section className="space-y-3">
          <h2 className="text-base font-semibold">Nama pemesan · Meja {dineInTable}</h2>
          <label htmlFor="guest-name" className="block text-sm">Nama</label>
          <Input id="guest-name" autoComplete="name" value={guestName} maxLength={80} onChange={e => setGuestName(e.target.value)} placeholder="Nama kamu" />
          <label htmlFor="guest-phone" className="block text-sm">Nomor HP</label>
          <Input id="guest-phone" type="tel" autoComplete="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        </section>}

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
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Titik Lokasi Pengiriman</p>
                <button type="button" onClick={useMyLocation} className="cx-btn cx-btn-ghost px-3 py-1.5 text-[11px]">Pakai lokasi saya</button>
              </div>
              <AddressPinMap value={pin} fallback={{ lat: -7.2575, lng: 112.7521 }} onChange={setPin} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Ketuk peta atau geser pin merah ke lokasi rumahmu.</p>
              <label className="mt-3 block text-xs font-semibold text-muted-foreground" htmlFor="cx-address">Detail Alamat</label>
              <textarea
                id="cx-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={2}
                placeholder="Nama jalan, nomor rumah, patokan..."
                className="mt-1.5 w-full rounded-2xl border border-[hsl(var(--cx-line))] bg-white px-4 py-3 text-sm outline-none focus:border-zeger/50 focus:ring-4 focus:ring-zeger/10 resize-none"
              />
              <p className="mt-4 text-xs font-semibold text-muted-foreground mb-2">Kurir Instan</p>
              {rates.length > 0 ? (
                <div className="space-y-2">
                  {rates.map((r) => {
                    const active = courier?.courier_code === r.courier_code && courier?.service_code === r.service_code;
                    return (
                      <button
                        key={r.courier_code + r.service_code}
                        type="button"
                        onClick={() => setCourier(r)}
                        className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98] ${active ? 'border-zeger bg-zeger-soft/60 ring-4 ring-zeger/10' : 'border-[hsl(var(--cx-line))] bg-card'}`}
                      >
                        <div>
                          <p className="text-sm font-bold">{r.name}</p>
                          {r.eta && <p className="text-[11px] text-muted-foreground">Estimasi {r.eta}</p>}
                        </div>
                        <span className="text-sm font-extrabold text-zeger-dark">{formatRupiah(r.price)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="cx-ride-track rounded-2xl bg-zeger-soft/60 h-16 flex items-center px-4">
                  <img src={cxArt.scooter} alt="" className="cx-ride h-12 w-12 object-contain" />
                  <p className="ml-2 text-xs font-semibold text-zeger-dark">{rateMsg || "Kurir siap antar pesananmu."}</p>
                </div>
              )}
            </div>
          ) : !dineInTable ? (
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
          ) : null}
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

        {/* Cross-sell */}
        {onQuickAdd && crossSell.length > 0 && (
          <section className="-mx-4 bg-zeger-cream/60 py-4">
            <h2 className="px-4 text-base font-extrabold">Lebih nikmat kalau ditambah ini</h2>
            <p className="px-4 text-[11px] text-muted-foreground">Pasangan pas untuk pesananmu</p>
            <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
              {crossSell.map((p) => (
                <div key={p.id} className="cx-card flex w-[230px] shrink-0 snap-start items-center gap-3 rounded-2xl p-2.5">
                  <img src={p.image_url || artworkFor(p)} onError={onArtError(artworkFor(p))} alt={p.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-bold leading-snug">{p.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="cx-num text-xs font-extrabold">{formatRupiah(p.price)}</span>
                      <button
                        type="button"
                        aria-label={`Tambah ${p.name}`}
                        onClick={() => { onQuickAdd(p); toast({ title: `${p.name} ditambahkan` }); }}
                        className="cx-btn cx-btn-primary flex h-7 w-7 items-center justify-center"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {onAddMore && (
          <div className="cx-card rounded-3xl p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold">Ada tambahan lagi?</p>
              <p className="text-[11px] text-muted-foreground">Kamu masih bisa tambahin menu lain, ya.</p>
            </div>
            <button type="button" onClick={onAddMore} className="cx-btn cx-btn-ghost px-4 py-2 text-xs">Tambah</button>
          </div>
        )}

        {/* Subscription upsell */}
        {cfg.features.subscription && onOpenSubscription && (
          <button type="button" onClick={onOpenSubscription} className="cx-card w-full overflow-hidden rounded-3xl bg-gradient-to-br from-zeger-soft to-white p-4 text-left">
            <div className="flex items-center gap-3">
              <img src={cxArt.crown} alt="" aria-hidden className="h-12 w-12 shrink-0 object-contain" />
              <div className="flex-1">
                <p className="text-sm font-extrabold">Berlangganan, Lebih Untung</p>
                <p className="text-[11px] text-muted-foreground">MyZeger Plan: free cup, buy 1 get 1 & diskon tiap hari</p>
              </div>
              <ChevronRight className="h-5 w-5 text-zeger" />
            </div>
          </button>
        )}

        {/* Best voucher */}
        {bestVoucher && selectedVoucher?.id !== bestVoucher.uv.id && (
          <div className="flex items-center gap-3 rounded-3xl border-2 border-zeger/40 bg-zeger-soft/50 p-4">
            <Ticket className="h-6 w-6 shrink-0 text-zeger" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">1 voucher terbaik untukmu</p>
              <p className="text-[11px] font-semibold text-zeger">Dapat diskon {formatRupiah(bestVoucher.value)}</p>
            </div>
            <button type="button" onClick={() => setSelectedVoucher(bestVoucher.uv)} className="cx-btn cx-btn-ghost px-4 py-2 text-xs">Pakai</button>
          </div>
        )}

        {/* Voucher */}
        {!guestMode && <button
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
                ? (voucherDiscount > 0
                  ? `Hemat ${formatRupiah(voucherDiscount)}`
                  : voucherBlockedReason(selectedVoucher.voucher!, { subtotal, shippingDue }) || 'Belum bisa dipakai')
                : `${vouchers.length} voucher siap dipakai`}
            </p>
          </div>
          <ChevronRight className={cn('h-5 w-5 text-muted-foreground transition-transform', showVouchers && 'rotate-90')} />
        </button>}

        {showVouchers && (
          <div className="space-y-2 cx-rise">
            {vouchers.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">Belum ada voucher. Klaim dulu di tab Voucher.</p>
            )}
            {vouchers.map((uv) => {
              const v = uv.voucher!;
              const blocked = voucherBlockedReason(v, { subtotal, shippingDue });
              const value = voucherDiscountFor(v, { subtotal, shippingDue });
              const active = selectedVoucher?.id === uv.id;
              return (
                <button
                  key={uv.id}
                  type="button"
                  disabled={!!blocked}
                  onClick={() => setSelectedVoucher(active ? null : uv)}
                  data-active={active}
                  className={cn('cx-opt w-full px-4 py-3 flex items-center gap-3 text-left', blocked && 'opacity-50')}
                >
                  {voucherKind(v) === 'shipping' ? <Bike className="h-4 w-4 shrink-0" /> : <Ticket className="h-4 w-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{v.code}</p>
                    <p className="text-[11px] opacity-80 truncate">
                      {voucherHeadline(v)}
                      {(v.min_order || 0) > 0 ? ` • Min. ${formatRupiah(v.min_order || 0)}` : ''}
                    </p>
                  </div>
                  {blocked ? (
                    <span className="shrink-0 text-[10px] font-bold opacity-70">{blocked}</span>
                  ) : (
                    <span className="cx-num shrink-0 text-[11px] font-extrabold">-{formatRupiah(value)}</span>
                  )}
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Points */}
        {!guestMode && <div className="cx-card rounded-3xl p-4 flex items-center gap-3">
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

        }
        {/* Payment method */}
        <div className="cx-card rounded-3xl p-4">
          <h2 className="text-base font-bold mb-3">Metode Pembayaran</h2>
          <div className="space-y-2">
            {guestMode ? <p className="text-sm font-medium">Bayar di kasir · Belum dibayar</p> : PAYMENTS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-active={paymentMethod === p.id}
                
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
            {!guestMode && ['GoPay', 'ShopeePay', 'OVO', 'Kartu Kredit'].map((n) => (
              <div key={n} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[hsl(var(--cx-line))] px-4 py-3 opacity-60">
                <span className="text-sm font-medium">{n}</span>
                <span className="text-[11px] text-muted-foreground">Segera hadir</span>
              </div>
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
              {guestMode ? 'Verifikasi nomor HP untuk akses poin member. ' : 'Kamu akan mendapat '}{!guestMode && <><span className="font-extrabold">{earnedPoints} poin</span> setelah pesanan selesai.</>}
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
            <span className="text-sm">{loading || submitting ? 'Memproses...' : guestMode ? 'Kirim Pesanan · Bayar di Kasir' : 'Lanjut Bayar QRIS'}</span>
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
