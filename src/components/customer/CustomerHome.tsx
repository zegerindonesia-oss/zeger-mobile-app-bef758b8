import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, ChevronRight, Store, MapPinned, Bike, Share2, Crown, Gift,
  MessageCircle, ShieldCheck, BadgeCheck, Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { normalizeImageUrl } from '@/lib/image-url';
import { artworkFor, cxArt, formatRupiah, onArtError } from '@/lib/customer-art';
import zegerPromo from '@/assets/flow/zeger-promo.png.asset.json';
import { cn } from '@/lib/utils';

export type CustomerChannel = 'branch' | 'street' | 'wheels';
export type CustomerOrderMode = 'pickup' | 'delivery';

interface CustomerHomeProps {
  customerUser: any;
  onNavigate: (view: any) => void;
  recentProducts?: any[];
  onAddToCart?: (product: any) => void;
  onChooseChannel?: (channel: CustomerChannel, mode: CustomerOrderMode) => void;
}

interface Banner { id: string; title: string; image_url: string; link_url: string | null }

const CHANNELS: { id: CustomerChannel; title: string; short: string; desc: string; icon: typeof Store }[] = [
  { id: 'branch', title: 'Zeger Branch', short: 'Branch', desc: 'Kedai Zeger terdekat', icon: Store },
  { id: 'street', title: 'On The Street', short: 'Street', desc: 'Booth & gerai jalanan', icon: MapPinned },
  { id: 'wheels', title: 'On The Wheels', short: 'Wheels', desc: 'Rider keliling dekatmu', icon: Bike },
];

export function CustomerHome({ customerUser, onNavigate, recentProducts = [], onChooseChannel }: CustomerHomeProps) {
  const config = useCustomerAppConfig();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [slide, setSlide] = useState(0);
  const [channel, setChannel] = useState<CustomerChannel>('branch');
  const [unread, setUnread] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const { data } = await supabase
        .from('promo_banners')
        .select('id, title, image_url, link_url, valid_from, valid_until')
        .eq('is_active', true)
        .eq('placement', 'carousel')
        .order('display_order');
      if (!alive) return;
      const list = (data || []).filter((b: any) =>
        (!b.valid_until || b.valid_until >= today) && (!b.valid_from || b.valid_from <= today),
      ) as Banner[];
      setBanners(list.length ? list : [{ id: 'default', title: 'Zeger Coffee', image_url: zegerPromo.url, link_url: null }]);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    if (!customerUser?.id) return;
    let alive = true;
    supabase
      .from('customer_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', customerUser.id)
      .is('read_at', null)
      .then(({ count }) => { if (alive) setUnread(count || 0); });
    return () => { alive = false; };
  }, [customerUser?.id]);

  const firstName = (customerUser?.name || customerUser?.full_name || 'Sobat Zeger').split(' ').slice(0, 2).join(' ');
  const points = customerUser?.points || 0;
  const waNumber = (config.care.whatsapp_number || '628133180488').replace(/\D/g, '');
  const waDisplay = useMemo(() => {
    const local = waNumber.replace(/^62/, '0');
    return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
  }, [waNumber]);

  const favourites = useMemo(() => recentProducts.slice(0, 8), [recentProducts]);
  const startOrder = (mode: CustomerOrderMode) => {
    if (channel === 'wheels') { onNavigate('map'); return; }
    onChooseChannel?.(channel, mode);
  };

  const swipe = (dir: 1 | -1) => setSlide((s) => (s + dir + banners.length) % banners.length);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      {/* ---------- Hero banner (managed in Back Office → Promo Banner) ---------- */}
      <header className="relative">
        <div
          className="relative h-[290px] overflow-hidden rounded-b-[32px] bg-zeger-dark"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null || banners.length < 2) return;
            const d = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(d) > 45) swipe(d < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          {/* Brand backdrop — always rendered so a missing banner image still looks finished */}
          <div className="absolute inset-0 bg-gradient-to-br from-zeger-dark via-zeger to-zeger-dark" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute inset-x-0 bottom-[86px] flex flex-col items-center px-8 text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">Zeger Coffee</p>
            <p className="mt-1 text-xl font-extrabold leading-tight text-white drop-shadow-sm">
              {banners[slide]?.title || 'Ngopi enak, poinnya ikut'}
            </p>
          </div>

          {banners.map((b, i) => (
            <BannerSlide
              key={b.id}
              banner={b}
              active={i === slide}
              onOpen={() => b.link_url && window.open(b.link_url, '_blank', 'noopener')}
            />
          ))}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(var(--cx-shadow)/0.45)] via-transparent to-[hsl(var(--cx-shadow)/0.55)]" />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-safe">
            <div className="cx-card-glass rounded-full px-3.5 py-1.5">
              <p className="text-[11px] font-bold tracking-[0.18em] text-zeger">ZEGER COFFEE</p>
            </div>
            {config.features.notifications && (
              <button
                onClick={() => onNavigate('notifications')}
                aria-label="Notifikasi"
                className="cx-icon-btn relative h-11 w-11"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zeger px-1 text-[10px] font-bold text-zeger-foreground ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )}
          </div>

          {banners.length > 1 && (
            <div className="absolute inset-x-0 bottom-[70px] flex justify-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  aria-label={`Banner ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={cn('h-1.5 rounded-full transition-all duration-300', i === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/55')}
                />
              ))}
            </div>
          )}
        </div>

        {/* ---------- Floating points card ---------- */}
        {config.features.loyalty && (
          <div className="cx-card cx-rise relative -mt-12 mx-4 overflow-hidden rounded-[26px]">
            <div className="flex items-center justify-between gap-3 p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zeger-cream to-white shadow-[inset_0_1px_0_white,0_6px_14px_-8px_hsl(var(--cx-shadow)/0.5)]">
                  <img src={cxArt.coin} alt="" aria-hidden className="cx-coin h-10 w-10 object-contain" loading="lazy" width={640} height={640} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Zeger Poin</p>
                  <p className="cx-num truncate text-2xl font-extrabold leading-tight">{points.toLocaleString('id-ID')}</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <img
                    key={i}
                    src={cxArt.coin}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    width={640}
                    height={640}
                    className="cx-coin h-7 w-7 object-contain"
                    style={{ transform: `translateY(${i % 2 ? 5 : -4}px) rotate(${i * 10 - 10}deg)` }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => onNavigate('loyalty')}
              className="flex w-full items-center justify-between border-t border-dashed border-[hsl(var(--cx-line))] px-4 py-3 text-left text-sm font-bold transition-colors active:bg-zeger-soft"
            >
              Tukarkan poinmu dengan hadiah menarik
              <ChevronRight className="h-[18px] w-[18px] text-zeger" />
            </button>
          </div>
        )}
      </header>

      {/* ---------- Subscription teaser ---------- */}
      {config.features.subscription && (
        <button
          onClick={() => onNavigate('subscription')}
          className="cx-card mx-4 mt-3.5 flex w-[calc(100%-2rem)] items-center gap-3 overflow-hidden rounded-[22px] p-2.5 pr-3 transition-transform active:scale-[0.985]"
        >
          <span className="cx-stage flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
            <img src={cxArt.crown} alt="" aria-hidden className="cx-art cx-float h-9 w-9 object-contain" loading="lazy" width={640} height={640} />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-sm font-extrabold">MyZeger Plan</span>
            <span className="block text-xs text-muted-foreground">Berlangganan, jauh lebih untung tiap bulan</span>
          </span>
          <span className="cx-btn cx-btn-ghost px-4 py-1.5 text-xs">Lihat</span>
        </button>
      )}

      {/* ---------- Channel + order mode ---------- */}
      {config.sections.order_types && (
        <section className="px-4 pt-6">
          <h2 className="text-xl font-extrabold">Hi {firstName}, pesan sekarang?</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Pilih layanan Zeger yang paling dekat denganmu</p>

          <div className="cx-seg mt-3 grid grid-cols-3 gap-1">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                data-active={channel === c.id}
                className="cx-seg-item flex flex-col items-center gap-1 px-1 py-2.5 text-[11px]"
              >
                <c.icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
                {c.short}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {CHANNELS.find((c) => c.id === channel)?.desc}
          </p>

          {channel === 'wheels' ? (
            <button
              onClick={() => onNavigate('map')}
              className="cx-card cx-ride-track mt-3 flex w-full items-center gap-3 overflow-hidden rounded-[26px] p-4 text-left transition-transform active:scale-[0.985]"
            >
              <span className="flex-1">
                <span className="block text-xl font-extrabold text-zeger">Cari Rider</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  Lihat rider Zeger terdekat di peta, datangi langsung atau panggil lewat WhatsApp
                </span>
              </span>
              <img src={cxArt.scooter} alt="" aria-hidden className="cx-art cx-ride h-20 w-24 shrink-0 object-contain" loading="lazy" width={896} height={752} />
            </button>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => startOrder('pickup')}
                className="cx-card cx-stage relative flex min-h-[154px] flex-col overflow-hidden rounded-[26px] p-4 text-left transition-transform active:scale-[0.97]"
              >
                <span className="relative z-10 block text-lg font-extrabold">Pick Up</span>
                <span className="relative z-10 mt-0.5 block text-xs text-muted-foreground">
                  Ambil di {channel === 'street' ? 'booth' : 'store'} tanpa antre
                </span>
                <img
                  src={cxArt.bag}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  width={640}
                  height={640}
                  className="cx-art cx-float absolute -bottom-2 right-0 h-[86px] w-[86px] object-contain"
                />
              </button>
              <button
                onClick={() => startOrder('delivery')}
                className="cx-card cx-ride-track relative flex min-h-[154px] flex-col overflow-hidden rounded-[26px] bg-gradient-to-br from-zeger-soft to-white p-4 text-left transition-transform active:scale-[0.97]"
              >
                <span className="relative z-10 block text-lg font-extrabold text-zeger">Delivery</span>
                <span className="relative z-10 mt-0.5 block text-xs text-muted-foreground">Diantar rider ke lokasimu</span>
                <img
                  src={cxArt.scooter}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  width={896}
                  height={752}
                  className="cx-art cx-ride absolute bottom-3 right-0 h-[76px] w-[100px] object-contain"
                />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---------- Favourites ---------- */}
      {favourites.length > 0 && (
        <section className="pt-7">
          <div className="flex items-center justify-between px-4">
            <h2 className="flex items-center gap-1.5 text-xl font-extrabold">
              Favorit Zeger <Sparkles className="h-[18px] w-[18px] text-zeger-gold" />
            </h2>
            <button onClick={() => startOrder('pickup')} className="flex items-center text-xs font-bold text-zeger">
              Semua menu <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {favourites.map((p: any) => (
              <button
                key={p.id}
                onClick={() => startOrder('pickup')}
                className="cx-card w-[138px] shrink-0 snap-start overflow-hidden rounded-[22px] text-left transition-transform active:scale-[0.96]"
              >
                <span className="cx-stage block aspect-square overflow-hidden">
                  <img
                    src={normalizeImageUrl(p.image_url) || artworkFor(p)}
                    onError={onArtError(artworkFor(p))}
                    alt={p.name}
                    loading="lazy"
                    className="cx-art h-full w-full object-contain p-2.5"
                  />
                </span>
                <span className="block p-2.5">
                  <span className="line-clamp-2 block min-h-[2.1rem] text-xs font-bold leading-snug">{p.name}</span>
                  <span className="cx-num mt-1 block text-sm font-extrabold text-zeger">{formatRupiah(p.price)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 h-2 bg-[hsl(var(--cx-rail))]" />

      {/* ---------- Highlights ---------- */}
      <section className="px-4 pt-6">
        <h2 className="text-xl font-extrabold">Yang Menarik di Zeger</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {config.features.referral && (
            <Feature art={cxArt.coin} fallbackIcon={Share2} title="Share The Sip" desc="Ajak teman, dapat poin" onClick={() => onNavigate('referral')} />
          )}
          {config.features.subscription && (
            <Feature art={cxArt.crown} fallbackIcon={Crown} title="MyZeger Plan" desc="Langganan hemat" onClick={() => onNavigate('subscription')} />
          )}
          {config.features.vouchers && (
            <Feature art={cxArt.gift} fallbackIcon={Gift} title="Zeger Gift" desc="Voucher & hadiah" onClick={() => onNavigate('vouchers')} />
          )}
        </div>
      </section>

      <div className="mt-6 h-2 bg-[hsl(var(--cx-rail))]" />

      {/* ---------- Zeger Care ---------- */}
      {config.features.care && (
        <section className="px-4 pt-6">
          <h2 className="text-xl font-extrabold">Perlu Bantuan?</h2>
          <button
            onClick={() => onNavigate('care')}
            className="cx-card mt-3 flex w-full items-center gap-3.5 rounded-[22px] p-4 text-left transition-transform active:scale-[0.985]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zeger-soft text-zeger">
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-xs text-muted-foreground">Zeger Care (chat only)</span>
              <span className="cx-num block text-lg font-extrabold text-zeger">{waDisplay}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </section>
      )}

      {/* ---------- Trust ---------- */}
      <section className="mx-4 mt-6 divide-y divide-dashed divide-[hsl(var(--cx-line))] border-y border-dashed border-[hsl(var(--cx-line))]">
        <div className="flex items-center gap-3.5 py-4 text-xs leading-relaxed text-muted-foreground">
          <BadgeCheck className="h-7 w-7 shrink-0 text-zeger" />
          Zeger Coffee sudah tersertifikasi halal oleh MUI
        </div>
        <div className="flex items-start gap-3.5 py-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="h-7 w-7 shrink-0 text-zeger" />
          <div>
            Dirjen Perlindungan Konsumen dan Tata Tertib Niaga, Kementerian Perdagangan Republik Indonesia.
            <p className="mt-1 font-bold text-foreground">WhatsApp Dirjen PKTN: 0853-1111-1010</p>
          </div>
        </div>
      </section>
      <div className="h-24" />
    </div>
  );
}

function Feature({
  art, fallbackIcon: Icon, title, desc, onClick,
}: { art: string; fallbackIcon: typeof Gift; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="cx-card flex flex-col items-center rounded-[22px] p-3 text-center transition-transform active:scale-[0.95]">
      <span className="cx-stage flex h-16 w-16 items-center justify-center rounded-full">
        {art ? (
          <img src={art} alt="" aria-hidden className="cx-art cx-float-slow h-11 w-11 object-contain" loading="lazy" width={640} height={640} />
        ) : (
          <Icon className="h-8 w-8 text-zeger" />
        )}
      </span>
      <span className="mt-2 block text-xs font-extrabold leading-tight">{title}</span>
      <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{desc}</span>
    </button>
  );
}

export default CustomerHome;
