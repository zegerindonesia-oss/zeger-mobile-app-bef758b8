import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, Clock, Gift, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/image-url';
import { artworkFor, cxArt, onArtError } from '@/lib/customer-art';
import zegerPromo from '@/assets/flow/zeger-promo.png.asset.json';

interface Props { customerUser: any; onNavigate: (view: string) => void }

interface Reward { id: string; reward_name: string; description: string | null; points_required: number; image_url: string | null }
interface Promo { id: string; title: string; description: string | null; image_url: string; link_url: string | null; valid_until: string | null; placement: string | null }

export function CustomerPromoReward({ customerUser, onNavigate }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const points = customerUser?.points || 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const [{ data: rw }, { data: pb }] = await Promise.all([
        supabase.from('loyalty_rewards').select('id, reward_name, description, points_required, image_url').eq('is_active', true).order('points_required'),
        supabase.from('promo_banners').select('id, title, description, image_url, link_url, valid_until, placement').eq('is_active', true).order('display_order'),
      ]);
      if (!alive) return;
      setRewards((rw as Reward[]) || []);
      setPromos(((pb as Promo[]) || []).filter((p) => !p.valid_until || p.valid_until >= today));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const nextReward = useMemo(() => rewards.find((r) => r.points_required > points), [rewards, points]);
  const progress = nextReward ? Math.min(100, Math.round((points / nextReward.points_required) * 100)) : 100;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      <header className="cx-bar sticky top-0 z-20 px-4 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold">Promo & Reward</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Kumpulkan poin, tukar jadi hadiah</p>
      </header>

      {/* Points progress */}
      <section className="px-4 pt-4">
        <div className="cx-card cx-stage-dark overflow-hidden rounded-[26px] p-5 text-white">
          <div className="flex items-center gap-3">
            <img src={cxArt.coin} alt="" aria-hidden className="cx-coin cx-float h-12 w-12 object-contain" width={640} height={640} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide opacity-80">Zeger Poin kamu</p>
              <p className="cx-num text-3xl font-extrabold leading-tight">{points.toLocaleString('id-ID')}</p>
            </div>
            <button onClick={() => onNavigate('loyalty')} className="cx-btn cx-btn-gold px-4 py-2 text-xs">Tukar</button>
          </div>
          {nextReward && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-gradient-to-r from-zeger-gold to-[hsl(45_96%_72%)] transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[11px] opacity-90">
                Kurang {Math.max(0, nextReward.points_required - points)} poin lagi untuk <span className="font-bold">{nextReward.reward_name}</span>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Rewards */}
      <section className="pt-7">
        <div className="flex items-center justify-between px-4">
          <h2 className="flex items-center gap-1.5 text-lg font-extrabold">
            Reward <Sparkles className="h-[18px] w-[18px] text-zeger-gold" />
          </h2>
          <button onClick={() => onNavigate('loyalty')} className="flex items-center text-xs font-bold text-zeger">
            Lihat semua <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex gap-3 px-4 pt-3">{[0, 1, 2].map((i) => <div key={i} className="cx-shimmer h-[182px] w-[146px] shrink-0 rounded-[22px]" />)}</div>
        ) : rewards.length === 0 ? (
          <div className="cx-card mx-4 mt-3 flex flex-col items-center rounded-[26px] px-6 py-10 text-center">
            <Gift className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-extrabold">Reward segera hadir</p>
            <p className="mt-1 text-xs text-muted-foreground">Terus kumpulkan poin dari setiap pembelian ya!</p>
          </div>
        ) : (
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rewards.map((r) => {
              const unlocked = points >= r.points_required;
              return (
                <button
                  key={r.id}
                  onClick={() => onNavigate('loyalty')}
                  className="cx-card w-[146px] shrink-0 snap-start overflow-hidden rounded-[22px] text-center transition-transform active:scale-[0.96]"
                >
                  <span className="cx-stage flex aspect-square items-center justify-center">
                    <img
                      src={normalizeImageUrl(r.image_url) || artworkFor({ name: r.reward_name })}
                      onError={onArtError(artworkFor({ name: r.reward_name }))}
                      alt={r.reward_name}
                      loading="lazy"
                      className={cn('cx-art h-[82%] w-[82%] object-contain p-1', !unlocked && 'opacity-60 grayscale-[0.4]')}
                    />
                  </span>
                  <span className="block p-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                        unlocked ? 'bg-zeger-cream text-[hsl(30_60%_26%)]' : 'bg-[hsl(var(--cx-rail))] text-muted-foreground',
                      )}
                    >
                      {unlocked ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {r.points_required} poin
                    </span>
                    <span className="mt-1.5 line-clamp-2 block min-h-[2.1rem] text-xs font-bold leading-snug">{r.reward_name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Double point banner */}
      <section className="px-4 pt-3">
        <div className="cx-card cx-sheen relative overflow-hidden rounded-[26px] bg-gradient-to-br from-zeger to-zeger-dark p-5 text-zeger-foreground">
          <h3 className="text-lg font-extrabold">Manjakan dirimu</h3>
          <p className="mt-1 max-w-[70%] text-xs leading-relaxed opacity-90">
            Setiap Rp10.000 belanja = 1 Zeger Poin, berlaku di semua outlet, booth, dan rider.
          </p>
          <p className="cx-num mt-3 text-3xl font-extrabold">1 Poin = Rp500</p>
          <img src={cxArt.gift} alt="" aria-hidden className="cx-art cx-float absolute -bottom-3 right-1 h-[104px] w-[104px] object-contain" width={640} height={640} />
        </div>
      </section>

      {/* Promos */}
      <section className="px-4 pt-7">
        <h2 className="text-lg font-extrabold">Promo Berjalan</h2>
        {loading ? (
          <div className="mt-3 space-y-3">{[0, 1].map((i) => <div key={i} className="cx-shimmer h-[200px] rounded-[26px]" />)}</div>
        ) : promos.length === 0 ? (
          <div className="cx-card mt-3 flex flex-col items-center rounded-[26px] px-6 py-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-extrabold">Belum ada promo aktif</p>
            <p className="mt-1 text-xs text-muted-foreground">Promo baru diatur tim Zeger dari Back Office.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3.5">
            {promos.map((p) => {
              const left = p.valid_until ? Math.ceil((new Date(`${p.valid_until}T23:59:59+07:00`).getTime() - Date.now()) / 86400000) : null;
              return (
                <article key={p.id} className="cx-card overflow-hidden rounded-[26px]">
                  <div className="relative">
                    <img
                      src={normalizeImageUrl(p.image_url) || zegerPromo.url}
                      onError={onArtError(zegerPromo.url)}
                      alt={p.title}
                      loading="lazy"
                      className="h-44 w-full object-cover"
                    />
                    {left !== null && left <= 7 && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-zeger px-2.5 py-1 text-[11px] font-bold text-zeger-foreground shadow-lg">
                        <Clock className="h-3 w-3" /> {left > 0 ? `${left} hari lagi` : 'Berakhir hari ini'}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-extrabold leading-snug">{p.title}</h3>
                    {p.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.description}</p>}
                    {p.link_url && (
                      <button
                        onClick={() => window.open(p.link_url!, '_blank', 'noopener')}
                        className="cx-btn cx-btn-ghost mt-3 px-4 py-1.5 text-xs"
                      >
                        Lihat detail
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default CustomerPromoReward;
