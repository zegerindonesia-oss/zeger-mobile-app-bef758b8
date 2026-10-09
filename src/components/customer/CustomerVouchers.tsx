import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Copy, Crown, Gift, Percent, Tag, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cxArt, formatRupiah } from '@/lib/customer-art';

interface Voucher {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order: number | null;
  valid_from: string | null;
  valid_until: string;
}

interface UserVoucher {
  id: string;
  voucher_id: string;
  is_used: boolean;
  claimed_at: string;
  used_at?: string | null;
  voucher: Voucher | null;
}

interface Redemption {
  id: string;
  reward_name: string;
  code: string;
  points_spent: number;
  status: string;
  expires_at: string | null;
}

const todayJakarta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

const daysLeft = (iso: string) => {
  const end = new Date(`${String(iso).slice(0, 10)}T23:59:59+07:00`).getTime();
  return Math.ceil((end - Date.now()) / 86400000);
};

export function CustomerVouchers({ customerUser }: { customerUser: any }) {
  const { toast } = useToast();
  const [available, setAvailable] = useState<Voucher[]>([]);
  const [mine, setMine] = useState<UserVoucher[]>([]);
  const [rewards, setRewards] = useState<Redemption[]>([]);
  const [tab, setTab] = useState<'available' | 'mine'>('available');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const today = todayJakarta();
    const [{ data: av }, { data: mv }, { data: rd }] = await Promise.all([
      supabase.from('customer_vouchers').select('*').eq('is_active', true).gte('valid_until', today).order('discount_value', { ascending: false }),
      customerUser?.id
        ? supabase.from('customer_user_vouchers').select('*, voucher:customer_vouchers(*)').eq('user_id', customerUser.id).order('claimed_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      customerUser?.id
        ? supabase.from('loyalty_redemptions').select('id, reward_name, code, points_spent, status, expires_at').eq('member_id', customerUser.id).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setAvailable((av as Voucher[]) || []);
    setMine((mv as UserVoucher[]) || []);
    setRewards((rd as Redemption[]) || []);
    setLoading(false);
  }, [customerUser?.id]);

  useEffect(() => { load(); }, [load]);

  const claimedIds = useMemo(() => new Set(mine.map((m) => m.voucher_id)), [mine]);
  const activeMine = useMemo(() => mine.filter((m) => !m.is_used && m.voucher && daysLeft(m.voucher.valid_until) > 0), [mine]);
  const usedMine = useMemo(() => mine.filter((m) => m.is_used || !m.voucher || daysLeft(m.voucher.valid_until) <= 0), [mine]);
  const activeRewards = useMemo(() => rewards.filter((r) => r.status === 'active'), [rewards]);

  const claim = async (voucher: Voucher) => {
    if (!customerUser?.id) return;
    if (claimedIds.has(voucher.id)) {
      toast({ title: 'Sudah diklaim', description: 'Voucher ini sudah ada di Voucher Saya' });
      setTab('mine');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('customer_user_vouchers').insert({ user_id: customerUser.id, voucher_id: voucher.id });
    setBusy(false);
    if (error) { toast({ title: 'Gagal klaim', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Voucher diklaim!', description: `${voucher.code} siap dipakai di kasir & aplikasi` });
    setTab('mine');
    load();
  };

  const claimByCode = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('customer_vouchers').select('*')
      .eq('code', code).eq('is_active', true).gte('valid_until', todayJakarta()).maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast({ title: 'Kode tidak berlaku', description: 'Kode promo salah atau masa berlakunya habis', variant: 'destructive' });
      return;
    }
    setPromoCode('');
    claim(data as Voucher);
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast({ title: 'Kode disalin', description: code });
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      <header className="cx-bar sticky top-0 z-20 px-4 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold">Voucher & Promo</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Klaim sekali, pakai di outlet mana pun</p>
        <div className="cx-seg mt-3 grid grid-cols-2 gap-1">
          <button onClick={() => setTab('available')} data-active={tab === 'available'} className="cx-seg-item py-2.5 text-xs">
            Tersedia ({available.length})
          </button>
          <button onClick={() => setTab('mine')} data-active={tab === 'mine'} className="cx-seg-item py-2.5 text-xs">
            Voucher Saya ({activeMine.length + activeRewards.length})
          </button>
        </div>
      </header>

      {/* Promo code */}
      <section className="px-4 pt-4">
        <div className="cx-card flex items-center gap-2 rounded-[22px] p-2 pl-4">
          <Tag className="h-[18px] w-[18px] shrink-0 text-zeger" />
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && claimByCode()}
            placeholder="Punya kode promo? Masukkan di sini"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={claimByCode} disabled={busy || !promoCode.trim()} className="cx-btn cx-btn-primary px-5 py-2 text-xs">
            Klaim
          </button>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="cx-shimmer h-[118px] rounded-[20px]" />)}</div>
      ) : tab === 'available' ? (
        <section className="space-y-3 p-4">
          {available.length === 0 ? (
            <Empty icon={Ticket} title="Belum ada voucher" desc="Voucher baru biasanya hadir tiap awal bulan. Cek lagi nanti ya!" />
          ) : (
            available.map((v) => (
              <VoucherTicket
                key={v.id}
                voucher={v}
                claimed={claimedIds.has(v.id)}
                busy={busy}
                onClaim={() => claim(v)}
                onCopy={() => copy(v.code)}
              />
            ))
          )}
        </section>
      ) : (
        <section className="space-y-3 p-4">
          {activeRewards.length > 0 && (
            <>
              <h2 className="pt-1 text-sm font-extrabold">Hadiah dari Poin</h2>
              {activeRewards.map((r) => (
                <article key={r.id} className="cx-ticket flex overflow-hidden">
                  <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-1 bg-gradient-to-b from-zeger-gold to-[hsl(38_90%_43%)] p-3 text-center">
                    <img src={cxArt.coin} alt="" aria-hidden className="h-8 w-8 object-contain" width={640} height={640} />
                    <span className="cx-num text-[11px] font-extrabold text-[hsl(30_60%_18%)]">{r.points_spent} poin</span>
                  </div>
                  <div className="relative flex-1 p-3.5">
                    <span className="cx-notch -left-2.5 -top-2.5" />
                    <span className="cx-notch -bottom-2.5 -left-2.5" />
                    <p className="text-sm font-extrabold leading-tight">{r.reward_name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.expires_at ? `Berlaku s/d ${new Date(r.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Tunjukkan kode ini ke kasir'}
                    </p>
                    <button onClick={() => copy(r.code)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-zeger-soft px-3 py-1.5 text-xs font-extrabold text-zeger">
                      {r.code} <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}

          <h2 className="pt-1 text-sm font-extrabold">Voucher Belanja</h2>
          {activeMine.length === 0 ? (
            <Empty icon={Gift} title="Belum ada voucher aktif" desc="Klaim dulu voucher di tab Tersedia, lalu pakai saat checkout." />
          ) : (
            activeMine.map((m) => (
              <VoucherTicket key={m.id} voucher={m.voucher!} owned onCopy={() => copy(m.voucher!.code)} />
            ))
          )}

          {usedMine.length > 0 && (
            <>
              <h2 className="pt-3 text-sm font-extrabold text-muted-foreground">Belum Bisa Dipakai</h2>
              {usedMine.map((m) =>
                m.voucher ? (
                  <VoucherTicket key={m.id} voucher={m.voucher} owned dim used={m.is_used} onCopy={() => copy(m.voucher!.code)} />
                ) : null,
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function VoucherTicket({
  voucher, claimed, owned, dim, used, busy, onClaim, onCopy,
}: {
  voucher: Voucher; claimed?: boolean; owned?: boolean; dim?: boolean; used?: boolean; busy?: boolean;
  onClaim?: () => void; onCopy?: () => void;
}) {
  const pct = voucher.discount_type === 'percentage';
  const left = daysLeft(voucher.valid_until);
  return (
    <article className="cx-ticket flex overflow-hidden" data-dim={dim ? 'true' : 'false'}>
      <div className="cx-ticket-stub flex w-[92px] shrink-0 flex-col items-center justify-center gap-0.5 p-2.5 text-center">
        {pct ? <Percent className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}
        <span className="cx-num text-lg font-extrabold leading-none">
          {pct ? `${voucher.discount_value}%` : `${Math.round(voucher.discount_value / 1000)}K`}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-85">Off</span>
      </div>
      <div className="relative min-w-0 flex-1 p-3.5">
        <span className="cx-notch -left-2.5 -top-2.5" />
        <span className="cx-notch -bottom-2.5 -left-2.5" />
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-extrabold leading-tight">{voucher.description || `Diskon ${pct ? `${voucher.discount_value}%` : formatRupiah(voucher.discount_value)}`}</p>
          {used && <span className="shrink-0 rounded-full bg-[hsl(var(--cx-rail))] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Terpakai</span>}
        </div>
        {(voucher.min_order || 0) > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">Min. belanja {formatRupiah(voucher.min_order || 0)}</p>
        )}
        <p className={cn('mt-1 inline-flex items-center gap-1 text-[11px] font-semibold', left <= 3 ? 'text-zeger' : 'text-muted-foreground')}>
          <Clock className="h-3.5 w-3.5" />
          {left > 0 ? `Berakhir ${left} hari lagi` : 'Masa berlaku habis'}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <button onClick={onCopy} className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[hsl(var(--cx-rail))] px-2.5 py-1 text-[11px] font-extrabold">
            <span className="truncate">{voucher.code}</span>
            <Copy className="h-3 w-3 shrink-0" />
          </button>
          {owned ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Siap dipakai
            </span>
          ) : (
            <button
              onClick={onClaim}
              disabled={busy || claimed || left <= 0}
              className={cn('cx-btn px-4 py-1.5 text-xs', claimed ? 'cx-btn-ghost' : 'cx-btn-primary')}
            >
              {claimed ? 'Sudah diklaim' : 'Klaim'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Empty({ icon: Icon, title, desc }: { icon: typeof Gift; title: string; desc: string }) {
  return (
    <div className="cx-card flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
      <span className="cx-stage flex h-16 w-16 items-center justify-center rounded-full">
        <Icon className="h-8 w-8 text-zeger" />
      </span>
      <p className="mt-3 text-sm font-extrabold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

export default CustomerVouchers;
