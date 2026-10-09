import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Gift, History, QrCode, Sparkles, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { LoyaltyRedeemDialog } from '@/components/loyalty/LoyaltyRedeemDialog';
import { PointsHistoryList } from '@/components/loyalty/PointsHistoryList';
import { cxArt, formatRupiah } from '@/lib/customer-art';
import { cn } from '@/lib/utils';

interface CustomerLoyaltyProps {
  customerUser: any;
  onNavigate: (view: string) => void;
  onBack: () => void;
}

interface Redemption {
  id: string; reward_name: string; code: string; points_spent: number; status: string; expires_at: string | null;
}

export function CustomerLoyalty({ customerUser, onNavigate, onBack }: CustomerLoyaltyProps) {
  const [points, setPoints] = useState<number>(customerUser?.points || 0);
  const [memberCode, setMemberCode] = useState<string | null>(customerUser?.member_code || null);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [showQr, setShowQr] = useState(false);

  const load = useCallback(async () => {
    if (!customerUser?.id) return;
    const [{ data: me }, { data: red }, { data: earned }] = await Promise.all([
      supabase.from('customer_users').select('member_code, points').eq('id', customerUser.id).maybeSingle(),
      supabase.from('loyalty_redemptions').select('id, reward_name, code, points_spent, status, expires_at').eq('member_id', customerUser.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('customer_points_history').select('change').eq('user_id', customerUser.id).gt('change', 0),
    ]);
    if (me?.member_code) setMemberCode(me.member_code);
    if (me?.points != null) setPoints(Number(me.points));
    setRedemptions((red as Redemption[]) || []);
    setTotalEarned(((earned as any[]) || []).reduce((s, r) => s + Number(r.change || 0), 0));
  }, [customerUser?.id]);

  useEffect(() => { load(); }, [load]);

  const value = points * 500;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-28">
      {/* Hero */}
      <header className="cx-stage-dark relative overflow-hidden rounded-b-[34px] px-4 pb-16 pt-4 text-white">
        <div className="flex items-center justify-between">
          <button onClick={onBack} aria-label="Kembali" className="cx-icon-btn h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-extrabold">Zeger Loyalty</h1>
          <button onClick={() => setShowQr((v) => !v)} aria-label="Kartu member" className="cx-icon-btn h-10 w-10">
            <QrCode className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center text-center">
          <img src={cxArt.coin} alt="" aria-hidden className="cx-coin cx-float h-24 w-24 object-contain" width={640} height={640} />
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] opacity-80">Zeger Poin</p>
          <p className="cx-num text-5xl font-extrabold leading-none">{points.toLocaleString('id-ID')}</p>
          <p className="mt-2 text-xs opacity-85">Setara potongan {formatRupiah(value)} di semua channel</p>
          <p className="mt-0.5 text-[11px] opacity-70 truncate max-w-full">
            {(customerUser?.name || 'Zeger Member').toUpperCase()}{memberCode ? ` · ${memberCode}` : ''}
          </p>
        </div>
      </header>

      {/* Actions */}
      <div className="cx-card relative z-10 -mt-10 mx-4 grid grid-cols-2 gap-2 rounded-[26px] p-2.5">
        <button onClick={() => setRedeemOpen(true)} className="cx-btn cx-btn-primary flex items-center justify-center gap-2 py-3 text-sm">
          <Gift className="h-[18px] w-[18px]" /> Tukar Poin
        </button>
        <button onClick={() => { setTab('history'); setHistoryKey((k) => k + 1); }} className="cx-btn cx-btn-ghost flex items-center justify-center gap-2 py-3 text-sm">
          <History className="h-[18px] w-[18px]" /> Riwayat
        </button>
      </div>

      {/* Member QR */}
      {showQr && (
        <section className="px-4 pt-4">
          <div className="cx-card cx-pop-in flex flex-col items-center rounded-[26px] p-5">
            <p className="text-sm font-extrabold">Kartu Member</p>
            <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
              Tunjukkan QR ini ke kasir atau rider sebelum bayar supaya poin langsung masuk
            </p>
            <div className="mt-3 rounded-2xl border border-[hsl(var(--cx-line))] bg-white p-3">
              <QRCodeSVG value={memberCode || customerUser?.id || ''} size={168} level="M" />
            </div>
            <p className="cx-num mt-3 text-lg font-extrabold tracking-[0.2em]">{memberCode || '—'}</p>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="grid grid-cols-2 gap-3 px-4 pt-4">
        <div className="cx-card rounded-[22px] p-3.5">
          <p className="text-[11px] text-muted-foreground">Total poin terkumpul</p>
          <p className="cx-num mt-0.5 text-xl font-extrabold">{totalEarned.toLocaleString('id-ID')}</p>
        </div>
        <div className="cx-card rounded-[22px] p-3.5">
          <p className="text-[11px] text-muted-foreground">Nilai 1 poin</p>
          <p className="cx-num mt-0.5 text-xl font-extrabold text-zeger">Rp500</p>
        </div>
      </section>

      <section className="px-4 pt-3">
        <div className="cx-card cx-sheen flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-zeger-cream to-white p-4">
          <Sparkles className="h-6 w-6 shrink-0 text-zeger-gold" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dapat <span className="font-bold text-foreground">1 poin setiap Rp10.000</span> belanja di outlet, booth, rider, maupun aplikasi.
            Poinnya satu untuk semua channel Zeger.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="px-4 pt-6">
        <div className="cx-seg grid grid-cols-2 gap-1">
          <button onClick={() => setTab('rewards')} data-active={tab === 'rewards'} className="cx-seg-item py-2.5 text-xs">Hadiah Saya</button>
          <button onClick={() => setTab('history')} data-active={tab === 'history'} className="cx-seg-item py-2.5 text-xs">Riwayat Poin</button>
        </div>

        <div className="cx-card mt-3 rounded-[26px] p-4">
          {tab === 'history' ? (
            <PointsHistoryList memberId={customerUser?.id} limit={50} refreshKey={historyKey} />
          ) : redemptions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Ticket className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-extrabold">Belum ada penukaran</p>
              <p className="mt-1 text-xs text-muted-foreground">Tukar poinmu jadi minuman gratis atau voucher diskon.</p>
              <button onClick={() => setRedeemOpen(true)} className="cx-btn cx-btn-primary mt-4 px-5 py-2 text-xs">Tukar sekarang</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--cx-line))] p-3">
                  <span className="cx-stage flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zeger">
                    <Gift className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.reward_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Kode <span className="cx-num font-bold text-foreground">{r.code}</span> · {r.points_spent} poin
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold',
                      r.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-[hsl(var(--cx-rail))] text-muted-foreground',
                    )}
                  >
                    {r.status === 'active' ? 'Aktif' : r.status === 'used' ? 'Terpakai' : 'Kedaluwarsa'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="px-4 pt-4">
        <button onClick={() => onNavigate('vouchers')} className="cx-btn cx-btn-ghost w-full py-3 text-sm">
          Lihat semua voucher saya
        </button>
      </div>

      <LoyaltyRedeemDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        memberId={customerUser?.id}
        memberPoints={points}
        onRedeemed={(r: any) => {
          setPoints(r.remaining_points);
          setHistoryKey((k) => k + 1);
          load();
          setTab('rewards');
        }}
      />
    </div>
  );
}

export default CustomerLoyalty;
