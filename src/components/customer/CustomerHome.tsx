import { useEffect, useState } from 'react';
import { Bell, ChevronRight, Store, MapPinned, Bike, ShoppingBag, Truck, Share2, Crown, Gift, MessageCircle, ShieldCheck, BadgeCheck, Percent, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { normalizeImageUrl } from '@/lib/image-url';
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

const CHANNELS: { id: CustomerChannel; title: string; desc: string; icon: any }[] = [
  { id: 'branch', title: 'Zeger Branch', desc: 'Kedai Zeger terdekat', icon: Store },
  { id: 'street', title: 'On The Street', desc: 'Booth & gerai jalanan', icon: MapPinned },
  { id: 'wheels', title: 'On The Wheels', desc: 'Rider keliling dekatmu', icon: Bike },
];

export function CustomerHome({ customerUser, onNavigate, onChooseChannel }: CustomerHomeProps) {
  const { config } = useCustomerAppConfig();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [slide, setSlide] = useState(0);
  const [channel, setChannel] = useState<CustomerChannel>('branch');
  const [sheet, setSheet] = useState<CustomerChannel | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const { data } = await supabase
        .from('promo_banners')
        .select('id, title, image_url, link_url, valid_until')
        .eq('is_active', true)
        .eq('placement', 'carousel')
        .order('display_order');
      const list = (data || []).filter((b: any) => !b.valid_until || b.valid_until >= today) as Banner[];
      setBanners(list.length ? list : [{ id: 'default', title: 'Zeger Coffee', image_url: zegerPromo.url, link_url: null }]);
    })();
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    if (!customerUser?.id) return;
    supabase.from('customer_notifications').select('id', { count: 'exact', head: true })
      .eq('customer_user_id', customerUser.id).eq('is_read', false)
      .then(({ count }) => setUnread(count || 0));
  }, [customerUser?.id]);

  const firstName = (customerUser?.name || customerUser?.full_name || 'Sobat Zeger').split(' ').slice(0, 3).join(' ');
  const points = customerUser?.points || 0;
  const waNumber = config.care.whatsapp_number || '6281330886182';
  const waDisplay = waNumber.replace(/^62/, '0').replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');

  const startOrder = (mode: CustomerOrderMode) => {
    if (channel === 'wheels') { onNavigate('map'); return; }
    onChooseChannel?.(channel, mode);
  };

  return (
    <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
      {/* Hero */}
      <div className="relative">
        <div className="relative h-[300px] overflow-hidden rounded-b-[28px] bg-zeger-dark">
          {banners.map((b, i) => (
            <img
              key={b.id}
              src={normalizeImageUrl(b.image_url)}
              alt={b.title}
              onClick={() => b.link_url && window.open(b.link_url, '_blank')}
              className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', i === slide ? 'opacity-100' : 'opacity-0')}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-zeger-dark/40 via-transparent to-zeger-dark/60" />
          {config.features.notifications && (
            <button onClick={() => onNavigate('notifications')} aria-label="Notifikasi"
              className="absolute right-4 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-zeger text-zeger-foreground shadow-lg">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-zeger-gold ring-2 ring-zeger" />}
            </button>
          )}
          <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2">
            {banners.map((_, i) => (
              <span key={i} className={cn('h-2 rounded-full transition-all', i === slide ? 'w-5 bg-zeger-foreground' : 'w-2 bg-zeger-foreground/50')} />
            ))}
          </div>
        </div>

        {/* Points card */}
        {config.features.loyalty && (
          <div className="relative -mt-12 mx-4 rounded-3xl bg-card shadow-[0_10px_30px_-12px_hsl(var(--zeger)/0.35)] border border-border">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 rounded-full border-2 border-zeger/30 bg-zeger-cream px-2 py-1.5 pr-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zeger text-zeger-foreground font-black">Z</span>
                <span className="text-2xl font-bold">{points.toLocaleString('id-ID')} Poin</span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="h-6 w-6 rounded-full bg-zeger-gold/80 shadow-inner" style={{ transform: `translateY(${i % 2 ? -6 : 4}px)` }} />)}
              </div>
            </div>
            <button onClick={() => onNavigate('loyalty')} className="flex w-full items-center justify-between border-t border-dashed border-border px-4 py-3.5 text-left font-semibold">
              Tukarkan poinmu dengan hadiah menarik <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Subscribe teaser */}
      {config.features.subscription && (
        <button onClick={() => onNavigate('subscription')} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center overflow-hidden rounded-full border border-border bg-card shadow-sm">
          <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-r-full bg-zeger">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zeger-foreground text-zeger"><Percent className="h-5 w-5" /></span>
          </span>
          <span className="flex-1 px-3 text-left font-semibold">Berlangganan, lebih untung!</span>
          <span className="mr-3 rounded-full border-2 border-zeger px-4 py-1.5 text-sm font-bold text-zeger">Lihat</span>
        </button>
      )}

      {/* Order */}
      {config.sections.order_types && (
        <section className="px-4 pt-6">
          <h2 className="text-xl font-bold">Hi {firstName}, Pesan Sekarang?</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
            {CHANNELS.map((c) => (
              <button key={c.id} onClick={() => setChannel(c.id)}
                className={cn('flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-xs font-semibold transition-all',
                  channel === c.id ? 'bg-card text-zeger shadow' : 'text-muted-foreground')}>
                <c.icon className="h-5 w-5" />{c.title}
              </button>
            ))}
          </div>

          {channel === 'wheels' ? (
            <button onClick={() => onNavigate('map')}
              className="mt-3 flex w-full items-center gap-4 rounded-3xl border-2 border-zeger/40 bg-gradient-to-br from-zeger-soft to-card p-5 text-left">
              <div className="flex-1">
                <p className="text-2xl font-bold text-zeger">Cari Rider</p>
                <p className="mt-1 text-sm text-muted-foreground">Temukan rider Zeger terdekat, datangi atau panggil lewat WhatsApp</p>
              </div>
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zeger/10 text-zeger"><Bike className="h-10 w-10" /></span>
            </button>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => startOrder('pickup')} className="relative flex min-h-[150px] flex-col rounded-3xl border-2 border-zeger-gold/50 bg-gradient-to-br from-zeger-cream to-card p-4 text-left">
                <p className="text-2xl font-bold text-zeger-dark">Pick Up</p>
                <p className="mt-1 text-sm text-muted-foreground">Ambil di {channel === 'street' ? 'booth' : 'store'} tanpa antri</p>
                <span className="absolute bottom-3 right-3 flex h-14 w-14 items-center justify-center rounded-full bg-zeger-gold/25 text-zeger-dark"><ShoppingBag className="h-7 w-7" /></span>
              </button>
              <button onClick={() => startOrder('delivery')} className="relative flex min-h-[150px] flex-col rounded-3xl border-2 border-zeger/50 bg-gradient-to-br from-zeger-soft to-card p-4 text-left">
                <p className="text-2xl font-bold text-zeger">Delivery</p>
                <p className="mt-1 text-sm text-muted-foreground">Segera diantar ke lokasimu</p>
                <span className="absolute bottom-3 right-3 flex h-14 w-14 items-center justify-center rounded-full bg-zeger/15 text-zeger"><Truck className="h-7 w-7" /></span>
              </button>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 h-2 bg-muted" />

      {/* Highlights */}
      <section className="px-4 pt-6">
        <h2 className="text-xl font-bold">Yang Menarik di Zeger</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {config.features.referral && (
            <Feature icon={Share2} title="Share The Sip" desc="Bagikan kode referral, dapatkan hadiah" onClick={() => onNavigate('referral')} />
          )}
          {config.features.subscription && (
            <Feature icon={Crown} title="MyZeger Plan" desc="Berlangganan, jauh lebih untung" onClick={() => onNavigate('subscription')} />
          )}
          {config.features.vouchers && (
            <Feature icon={Gift} title="Zeger Gift" desc="Rayakan momen spesial bareng Zeger" onClick={() => onNavigate('vouchers')} />
          )}
        </div>
      </section>

      <div className="mt-6 h-2 bg-muted" />

      {config.features.care && (
        <section className="px-4 pt-6">
          <h2 className="text-xl font-bold">Perlu Bantuan?</h2>
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"
            className="mt-3 flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <MessageCircle className="h-10 w-10 text-zeger" />
            <div>
              <p className="text-sm">Zeger Customer Service (chat only)</p>
              <p className="text-xl font-bold text-zeger">{waDisplay}</p>
            </div>
          </a>
        </section>
      )}

      <section className="mx-4 mt-6 divide-y divide-dashed divide-border border-y border-dashed border-border pb-2">
        <div className="flex items-center gap-4 py-4 text-sm text-muted-foreground"><BadgeCheck className="h-8 w-8 shrink-0 text-zeger" />Zeger Coffee sudah tersertifikasi halal oleh MUI</div>
        <div className="flex items-start gap-4 py-4 text-sm text-muted-foreground"><ShieldCheck className="h-8 w-8 shrink-0 text-zeger" />
          <div>Dirjen Perlindungan Konsumen dan Tata Tertib Niaga, Kementerian Perdagangan Republik Indonesia.<p className="mt-1 font-semibold">WhatsApp Dirjen PKTN: 0853-1111-1010</p></div>
        </div>
      </section>
      <div className="h-8" />

      {sheet && (
        <div className="fixed inset-0 z-50 bg-foreground/40" onClick={() => setSheet(null)}>
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <button className="ml-auto block" onClick={() => setSheet(null)}><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ icon: Icon, title, desc, onClick }: { icon: any; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center rounded-3xl border border-border bg-card p-4 text-center shadow-sm transition-transform active:scale-95">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zeger-soft text-zeger"><Icon className="h-9 w-9" /></span>
      <p className="mt-3 font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

export default CustomerHome;
