import { useEffect, useMemo, useState } from 'react';
import { Cake, ChevronLeft, Coffee, Gift, Package, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cxArt, formatRupiah } from '@/lib/customer-art';

interface Props { customerUser: any; onBack: () => void }
interface Benefit { title: string; subtitle?: string; qty?: number }
interface Plan {
  id: string; name: string; description: string | null; price: number; quota: number;
  period_days: number; image_url: string | null; tier: string; is_best: boolean; benefits: Benefit[];
}
interface Sub { id: string; plan_id: string; status: string; ends_at: string; remaining_quota: number; plan?: Plan }

const iconFor = (t: string) => {
  const s = (t || '').toLowerCase();
  if (s.includes('birthday') || s.includes('ulang')) return Cake;
  if (s.includes('diskon') || s.includes('%')) return Percent;
  if (s.includes('buy') || s.includes('gratis') || s.includes('free')) return Coffee;
  return Gift;
};

export function CustomerSubscription({ customerUser, onBack }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mySub, setMySub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('price', { ascending: false }),
      customerUser?.id
        ? supabase.from('customer_subscriptions').select('*, plan:plan_id(*)').eq('user_id', customerUser.id).eq('status', 'active')
            .gte('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const list = ((p as any[]) || []).map((x) => ({ ...x, benefits: Array.isArray(x.benefits) ? x.benefits : [] })) as Plan[];
    setPlans(list);
    setSelected((prev) => prev || (list.find((x) => x.is_best) || list[0])?.id || null);
    setMySub(s && s.length ? (s[0] as any) : null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customerUser?.id]);

  const plan = useMemo(() => plans.find((p) => p.id === selected) || null, [plans, selected]);
  const renewDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (plan?.period_days || 30));
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
  }, [plan]);

  const benefits: Benefit[] = plan?.benefits?.length
    ? plan.benefits
    : plan
      ? [{ title: `${plan.quota} Voucher`, subtitle: plan.description || `Berlaku ${plan.period_days} hari`, qty: plan.quota }]
      : [];

  const subscribe = async () => {
    if (!plan || !customerUser?.id) return;
    setBusy(true);
    const ends = new Date();
    ends.setDate(ends.getDate() + plan.period_days);
    const { error } = await supabase.from('customer_subscriptions').insert({
      user_id: customerUser.id, plan_id: plan.id, status: 'active', ends_at: ends.toISOString(), remaining_quota: plan.quota,
    });
    setBusy(false);
    if (error) { toast({ title: 'Gagal berlangganan', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Selamat, kamu member MyZeger Plan!', description: plan.name });
    load();
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-56">
      <header className="cx-stage-dark relative overflow-hidden rounded-b-[34px] px-4 pb-10 pt-4 text-white">
        <div className="flex items-center justify-between">
          <button onClick={onBack} aria-label="Kembali" className="cx-icon-btn h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-lg font-black italic">
            <span className="align-top text-xs opacity-80">my</span>Zeger
            <span className="ml-1 rounded-lg bg-white px-1.5 text-base not-italic text-zeger">Plan</span>
          </p>
          <span className="w-10" />
        </div>
        <div className="mt-4 flex flex-col items-center text-center">
          <img src={cxArt.crown} alt="" aria-hidden className="cx-art cx-float h-24 w-24 object-contain" width={640} height={640} />
          <h1 className="mt-3 px-4 text-lg font-extrabold leading-snug">
            Nikmati beragam keuntungan hanya dengan sekali bayar tiap bulan
          </h1>
        </div>
      </header>

      {mySub && (
        <section className="px-4 pt-4">
          <div className="cx-card cx-sheen rounded-[26px] bg-gradient-to-br from-zeger to-zeger-dark p-4 text-zeger-foreground">
            <p className="text-[11px] uppercase tracking-wide opacity-85">Paket aktif</p>
            <p className="text-lg font-extrabold">{mySub.plan?.name || 'MyZeger Plan'}</p>
            <p className="mt-0.5 text-xs opacity-90">
              Sisa {mySub.remaining_quota} voucher · berlaku s/d {new Date(mySub.ends_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </section>
      )}

      {loading ? (
        <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="cx-shimmer h-[86px] rounded-[22px]" />)}</div>
      ) : plans.length === 0 ? (
        <div className="cx-card mx-4 mt-6 flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-extrabold">Paket langganan segera hadir</p>
          <p className="mt-1 text-xs text-muted-foreground">Tim Zeger sedang menyiapkan paket terbaik untukmu.</p>
        </div>
      ) : (
        <>
          <div className="cx-seg mx-4 mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0,1fr))` }}>
            {plans.slice(0, 3).map((p) => (
              <button key={p.id} onClick={() => setSelected(p.id)} data-active={selected === p.id} className="cx-seg-item relative py-3 text-sm">
                {p.name}
                {p.is_best && (
                  <span className="absolute -top-2 right-1.5 rounded-full bg-zeger-gold px-2 py-0.5 text-[10px] font-extrabold text-[hsl(30_60%_18%)] shadow-sm">
                    Best
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3 px-4">
            {benefits.map((b, i) => {
              const Icon = iconFor(b.title);
              return (
                <article key={i} className="cx-ticket flex items-stretch overflow-hidden">
                  <div className="flex flex-1 items-center gap-3 p-3.5">
                    <span className="cx-stage flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-zeger">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold leading-tight">{b.title}</p>
                      {b.subtitle && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{b.subtitle}</p>}
                    </div>
                  </div>
                  <div className="cx-dash relative flex w-[84px] shrink-0 flex-col items-center justify-center">
                    <span className="cx-notch -left-2.5 -top-2.5" />
                    <span className="cx-notch -bottom-2.5 -left-2.5" />
                    <p className="cx-num text-xl font-extrabold">{b.qty ?? 1}</p>
                    <p className="text-[11px] text-muted-foreground">Voucher</p>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="px-5 pt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            Voucher terbit otomatis setiap periode dan bisa dipakai di seluruh outlet, booth, maupun rider Zeger.
          </p>
        </>
      )}

      {plan && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-[hsl(var(--cx-line))] bg-white/93 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <p className="cx-num text-2xl font-extrabold">
            {formatRupiah(plan.price)} <span className="text-sm font-semibold text-muted-foreground">/ {plan.period_days} hari</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Diperpanjang otomatis seharga {formatRupiah(plan.price)} pada {renewDate}
          </p>
          <button onClick={subscribe} disabled={!!mySub || busy} className="cx-btn cx-btn-primary mt-3 w-full py-3.5 text-base">
            {mySub ? 'Kamu sudah berlangganan' : busy ? 'Memproses…' : 'Langganan Sekarang'}
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerSubscription;
