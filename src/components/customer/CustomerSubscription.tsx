import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Crown, Gift, Percent, Coffee, Cake, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props { customerUser: any; onBack: () => void; }
interface Benefit { title: string; subtitle?: string; qty?: number; }
interface Plan { id: string; name: string; description: string | null; price: number; quota: number; period_days: number; image_url: string | null; tier: string; is_best: boolean; benefits: Benefit[]; }
interface Sub { id: string; plan_id: string; status: string; ends_at: string; remaining_quota: number; plan?: Plan; }

const iconFor = (t: string) => {
  const s = t.toLowerCase();
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

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('price', { ascending: false }),
        supabase.from('customer_subscriptions').select('*, plan:plan_id(*)').eq('user_id', customerUser?.id).eq('status', 'active').gte('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1),
      ]);
      const list = ((p as any) || []).map((x: any) => ({ ...x, benefits: Array.isArray(x.benefits) ? x.benefits : [] })) as Plan[];
      setPlans(list);
      setSelected((list.find((x) => x.is_best) || list[0])?.id || null);
      setMySub(s && s.length ? (s[0] as any) : null);
      setLoading(false);
    })();
  }, [customerUser?.id]);

  const plan = useMemo(() => plans.find((p) => p.id === selected) || null, [plans, selected]);
  const renewDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + (plan?.period_days || 30));
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }, [plan]);

  const subscribe = async () => {
    if (!plan || !customerUser?.id) return;
    setBusy(true);
    const ends = new Date(); ends.setDate(ends.getDate() + plan.period_days);
    const { error } = await supabase.from('customer_subscriptions').insert({
      user_id: customerUser.id, plan_id: plan.id, status: 'active', ends_at: ends.toISOString(), remaining_quota: plan.quota,
    });
    setBusy(false);
    if (error) toast({ title: 'Gagal berlangganan', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Selamat! Kamu member MyZeger Plan', description: plan.name }); onBack(); }
  };

  const benefits: Benefit[] = plan?.benefits.length ? plan.benefits : plan ? [{ title: `${plan.quota} Voucher`, subtitle: plan.description || `Berlaku ${plan.period_days} hari`, qty: plan.quota }] : [];

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-b from-card via-zeger-cream to-zeger-soft pb-48">
      <header className="flex items-center justify-between p-4">
        <button onClick={onBack} aria-label="Kembali"><ChevronLeft className="h-6 w-6" /></button>
        <p className="text-2xl font-black italic text-zeger"><span className="text-sm align-top text-zeger-dark">my</span>Zeger <span className="rounded-md bg-zeger px-1.5 text-base text-zeger-foreground">Plan</span></p>
        <span className="w-6" />
      </header>

      <h1 className="px-6 text-center text-xl font-bold leading-snug">Nikmati beragam keuntungan hanya dengan sekali beli setiap bulannya.</h1>
      <div className="mx-auto my-6 flex h-32 w-32 items-center justify-center rounded-full bg-zeger text-zeger-foreground shadow-xl"><Crown className="h-16 w-16" /></div>

      {mySub && (
        <div className="mx-4 mb-4 rounded-2xl bg-zeger p-4 text-zeger-foreground shadow-lg">
          <p className="text-xs opacity-90">Paket aktif</p>
          <p className="text-lg font-bold">{mySub.plan?.name}</p>
          <p className="text-sm opacity-90">Sisa {mySub.remaining_quota} voucher · s/d {new Date(mySub.ends_at).toLocaleDateString('id-ID')}</p>
        </div>
      )}

      {loading ? <p className="text-center text-sm text-muted-foreground">Memuat...</p> : plans.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground"><Package className="mx-auto mb-2 h-12 w-12" />Paket segera hadir</div>
      ) : (
        <>
          <div className="mx-4 flex rounded-full bg-card p-1.5 shadow-md">
            {plans.map((p) => (
              <button key={p.id} onClick={() => setSelected(p.id)}
                className={cn('relative flex-1 rounded-full py-3 font-bold transition-all', selected === p.id ? 'bg-zeger text-zeger-foreground' : 'text-foreground')}>
                {p.name}
                {p.is_best && <span className="absolute -top-2 right-3 rounded-full bg-zeger-gold px-2 py-0.5 text-xs text-foreground">Best</span>}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3 px-4">
            {benefits.map((b, i) => {
              const Icon = iconFor(b.title);
              return (
                <div key={i} className="relative flex items-center rounded-2xl border border-border bg-card shadow-sm">
                  <span className="m-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zeger-gold/30 text-zeger-dark"><Icon className="h-7 w-7" /></span>
                  <div className="flex-1 py-4">
                    <p className="font-bold">{b.title}</p>
                    {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
                  </div>
                  <div className="relative w-24 self-stretch border-l border-dashed border-border py-4 text-center">
                    <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-zeger-cream" />
                    <span className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full bg-zeger-cream" />
                    <p className="text-xl font-bold">{b.qty ?? 1}</p>
                    <p className="text-sm">Voucher</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {plan && (
        <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-card px-4 pb-6 pt-4 shadow-[0_-8px_24px_-12px_hsl(var(--foreground)/0.2)]">
          <p className="text-2xl font-bold">Rp {plan.price.toLocaleString('id-ID')} <span className="text-base font-normal">/ bulan</span></p>
          <p className="text-sm font-semibold">Diperpanjang otomatis seharga Rp {plan.price.toLocaleString('id-ID')} di {renewDate}</p>
          <button disabled={!!mySub || busy} onClick={subscribe}
            className="mt-3 w-full rounded-full bg-zeger py-4 text-lg font-bold text-zeger-foreground disabled:opacity-50">
            {mySub ? 'Kamu sudah berlangganan' : busy ? 'Memproses...' : 'Langganan Sekarang'}
          </button>
        </div>
      )}
    </div>
  );
}
