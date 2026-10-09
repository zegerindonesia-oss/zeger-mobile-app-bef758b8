import { useState } from 'react';
import { ChevronLeft, Copy, Share2, Gift, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { cxArt } from '@/lib/customer-art';

interface Props { customerUser: any; onBack: () => void; }

export function CustomerReferral({ customerUser, onBack }: Props) {
  const cfg = useCustomerAppConfig();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const myCode = customerUser?.id ? `${cfg.referral.code_prefix}${String(customerUser.id).slice(0, 6).toUpperCase()}` : '-';

  const copy = () => {
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast({ title: 'Kode disalin', description: myCode });
  };

  const share = async () => {
    const text = `Pakai kode referral saya di Zeger Coffee: ${myCode} — kita berdua dapat ${cfg.referral.reward_points} poin gratis!`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: 'Zeger Referral', text }); } catch { /* dibatalkan */ }
    } else {
      navigator.clipboard.writeText(text);
      toast({ title: 'Pesan disalin', description: 'Tinggal tempel ke chat temanmu.' });
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc('redeem_referral', { _code: code.trim() });
    setLoading(false);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Berhasil!', description: `Kamu dapat ${cfg.referral.reward_points} poin` }); setCode(''); }
  };

  const steps = [
    { n: 1, t: 'Bagikan kodemu', d: 'Kirim kode ke teman lewat WhatsApp atau sosial media.' },
    { n: 2, t: 'Teman daftar', d: 'Mereka masukkan kodemu saat buat akun Zeger.' },
    { n: 3, t: 'Poin cair', d: `Kalian berdua langsung dapat ${cfg.referral.reward_points} poin.` },
  ];

  return (
    <div className="cx-app min-h-screen pb-28">
      <header className="cx-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Ajak Teman</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Hero code card */}
        <div className="cx-card cx-sheen rounded-3xl overflow-hidden cx-rise">
          <div className="cx-stage-dark relative px-5 py-6 text-white">
            <img src={cxArt.gift} alt="" className="cx-art cx-float absolute -right-3 -top-2 h-28 w-28 object-contain opacity-95" />
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Kode referral kamu</p>
            <p className="cx-num text-3xl font-extrabold tracking-[0.2em] mt-1.5">{myCode}</p>
            <p className="text-xs opacity-90 mt-3 max-w-[72%]">
              Ajak teman daftar Zeger, kalian berdua dapat {cfg.referral.reward_points} poin.
            </p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            <button onClick={copy} className="cx-btn cx-btn-ghost px-4 py-3 text-sm inline-flex items-center justify-center gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Tersalin' : 'Salin'}
            </button>
            <button onClick={share} className="cx-btn cx-btn-primary px-4 py-3 text-sm inline-flex items-center justify-center gap-2">
              <Share2 className="h-4 w-4" /> Bagikan
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="cx-card rounded-3xl p-5">
          <h2 className="text-base font-bold mb-3">Cara kerjanya</h2>
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-3">
                <div className="cx-num h-7 w-7 rounded-full bg-zeger text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {s.n}
                </div>
                <div>
                  <p className="text-sm font-bold">{s.t}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Redeem */}
        <div className="cx-card rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-[18px] w-[18px] text-zeger" />
            <p className="text-base font-bold">Punya kode dari teman?</p>
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Masukkan kode"
              className="flex-1 min-w-0 rounded-full border border-[hsl(var(--cx-line))] bg-white px-4 py-3 text-sm font-semibold tracking-wider outline-none focus:border-zeger/50 focus:ring-4 focus:ring-zeger/10"
            />
            <button disabled={loading || !code.trim()} onClick={redeem} className="cx-btn cx-btn-primary px-6 py-3 text-sm shrink-0">
              {loading ? '...' : 'Klaim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerReferral;
