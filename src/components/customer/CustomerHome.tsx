import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, ChevronRight, Store, MapPinned, Bike, Share2, Crown, Gift,
  MessageCircle, ShieldCheck, BadgeCheck, User, Search, ShoppingBag, ArrowRight, Plus,
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

  const [mode, setMode] = useState<CustomerOrderMode>('pickup');
  const banner = banners[slide];

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      {/* 1. Brand header */}
      <header className="flex items-center justify-between px-5 pb-3 pt-safe">
        <div className="pt-4">
          <p className="text-[26px] font-extrabold leading-none tracking-tight text-zeger">ZEGER</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Coffee · Hi {firstName}</p>
        </div>
        <div className="flex gap-2 pt-4">
          {config.features.notifications && (
            <button onClick={() => onNavigate('notifications')} aria-label="Notifikasi" className="cx-icon-btn relative h-11 w-11">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zeger px-1 text-[10px] font-bold text-zeger-foreground">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )}
          <button onClick={() => onNavigate('profile')} aria-label="Profil" className="cx-icon-btn h-11 w-11">
            <User className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* 2. How do you want it? Pick Up / Delivery + search */}
      {config.sections.order_types && (
        <div className="cx-card mx-4 flex items-center gap-2 rounded-[22px] p-1.5">
          <div className="cx-seg grid flex-1 grid-cols-2 gap-1">
            {(['pickup', 'delivery'] as const).map((m) => (
              <button
                key={m}
                data-active={mode === m}
                onClick={() => setMode(m)}
                className="cx-seg-item flex items-center justify-center gap-1.5 py-2.5 text-[13px]"
              >
                {m === 'pickup' ? <ShoppingBag className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
                {m === 'pickup' ? 'Pick Up' : 'Delivery'}
              </button>
            ))}
          </div>
          <button onClick={() => startOrder(mode)} aria-label="Cari menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted-foreground active:bg-zeger-soft">
            <Search className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* 3. Promo banner with one clear action */}
      <section className="px-4 pt-4">
        <div
          className="relative h-[200px] overflow-hidden rounded-[26px] bg-gradient-to-br from-zeger-dark via-zeger to-zeger-dark"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null || banners.length < 2) return;
            const d = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(d) > 45) swipe(d < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          {banners.map((b, i) => (
            <BannerSlide key={b.id} banner={b} active={i === slide} onOpen={() => b.link_url && window.open(b.link_url, '_blank', 'noopener')} />
          ))}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[hsl(var(--cx-shadow)/0.6)] via-[hsl(var(--cx-shadow)/0.15)] to-transparent" />
          <div className="absolute inset-y-0 left-0 flex w-3/5 flex-col justify-center p-5">
            <p className="line-clamp-3 text-[22px] font-extrabold leading-[1.1] text-zeger-foreground">
              {banner?.title || 'Ngopi enak, poinnya ikut'}
            </p>
            <button
              onClick={() => startOrder(mode)}
              className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-background px-4 py-2 text-[13px] font-bold text-zeger shadow-md active:scale-95"
            >
              Pesan Sekarang <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {banners.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {banners.map((b, i) => (
                <button key={b.id} aria-label={`Banner ${i + 1}`} onClick={() => setSlide(i)}
                  className={cn('h-1.5 rounded-full transition-all', i === slide ? 'w-5 bg-background' : 'w-1.5 bg-background/55')} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Where to order — icon tiles */}
      {config.sections.order_types && (
        <section className="px-4 pt-5">
          <h2 className="text-[17px] font-bold">Pesan dari mana?</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setChannel(c.id);
                  if (c.id === 'wheels') onNavigate('map'); else onChooseChannel?.(c.id, mode);
                }}
                className="cx-card flex flex-col items-center gap-1.5 rounded-[20px] px-2 py-3 text-center active:scale-95"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zeger-soft text-zeger">
                  <c.icon className="h-5 w-5" />
                </span>
                <span className="text-[12px] font-bold leading-tight">{c.title}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{c.desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 5. Popular picks */}
      {favourites.length > 0 && (
        <section className="px-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold">Menu Favorit</h2>
            <button onClick={() => startOrder(mode)} className="flex items-center gap-1 text-[13px] font-semibold text-zeger">
              Lihat semua <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {favourites.slice(0, 6).map((p: any) => (
              <button key={p.id} onClick={() => startOrder(mode)} className="cx-card overflow-hidden rounded-[20px] text-left active:scale-[0.97]">
                <span className="block aspect-square overflow-hidden bg-background">
                  <img src={normalizeImageUrl(p.image_url) || artworkFor(p)} onError={onArtError(artworkFor(p))} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                </span>
                <span className="block p-2">
                  <span className="line-clamp-2 block min-h-[2rem] text-[12px] font-semibold leading-tight">{p.name}</span>
                  <span className="mt-1 flex items-center justify-between">
                    <span className="cx-num text-[12px] font-bold text-zeger">{formatRupiah(p.price)}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zeger text-zeger-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 6. Rewards strip */}
      {config.features.loyalty && (
        <section className="px-4 pt-6">
          <div className="cx-card flex items-center gap-3 rounded-[22px] p-3.5">
            <img src={cxArt.coin} alt="" aria-hidden className="cx-coin h-12 w-12 shrink-0 object-contain" loading="lazy" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-zeger">Zeger Poin</p>
              <p className="text-[12px] text-muted-foreground">
                <span className="cx-num font-bold text-foreground">{points.toLocaleString('id-ID')}</span> poin · tukar dengan hadiah
              </p>
            </div>
            <button onClick={() => onNavigate('loyalty')} className="cx-btn cx-btn-primary shrink-0 px-4 py-2 text-[13px]">Tukar</button>
          </div>
        </section>
      )}

      {/* 7. Extras */}
      <section className="px-4 pt-6">
        <h2 className="text-[17px] font-bold">Lainnya</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {config.features.subscription && (
            <Feature art={cxArt.crown} fallbackIcon={Crown} title="MyZeger Plan" desc="Langganan hemat" onClick={() => onNavigate('subscription')} />
          )}
          {config.features.referral && (
            <Feature art={cxArt.coin} fallbackIcon={Share2} title="Share The Sip" desc="Ajak teman" onClick={() => onNavigate('referral')} />
          )}
          {config.features.vouchers && (
            <Feature art={cxArt.gift} fallbackIcon={Gift} title="Zeger Gift" desc="Voucher" onClick={() => onNavigate('vouchers')} />
          )}
        </div>
      </section>

      {config.features.care && (
        <section className="px-4 pt-4">
          <button onClick={() => onNavigate('care')} className="cx-card flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left active:scale-[0.985]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zeger-soft text-zeger">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold">Perlu bantuan? Chat Zeger Care</span>
              <span className="cx-num block text-[12px] text-muted-foreground">{waDisplay}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </section>
      )}

      <section className="mx-4 mt-5 space-y-3 text-[11px] leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-zeger" /> Tersertifikasi halal MUI</p>
        <p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-zeger" /> Pengaduan konsumen: Dirjen PKTN Kemendag, WhatsApp 0853-1111-1010</p>
      </section>
      <div className="h-20" />
    </div>
  );
}

function BannerSlide({ banner, active, onOpen }: { banner: Banner; active: boolean; onOpen: () => void }) {
  const primary = normalizeImageUrl(banner.image_url) || zegerPromo.url;
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setSrc(primary); setFailed(false); }, [primary]);

  if (failed) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => (src === zegerPromo.url ? setFailed(true) : setSrc(zegerPromo.url))}
      onClick={onOpen}
      className={cn(
        'absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-out',
        active ? 'scale-100 opacity-100' : 'scale-105 opacity-0',
        banner.link_url && 'cursor-pointer',
      )}
    />
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
