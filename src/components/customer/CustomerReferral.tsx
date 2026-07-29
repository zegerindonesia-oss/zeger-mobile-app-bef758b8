import { useState } from 'react';
import { ChevronLeft, Copy, Share2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';

interface Props { customerUser: any; onBack: () => void; }

export function CustomerReferral({ customerUser, onBack }: Props) {
  const cfg = useCustomerAppConfig();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const myCode = customerUser?.id ? `${cfg.referral.code_prefix}${String(customerUser.id).slice(0, 6).toUpperCase()}` : '-';

  const copy = () => { navigator.clipboard.writeText(myCode); toast({ title: 'Kode disalin', description: myCode }); };
  const share = async () => {
    const text = `Pakai kode referral saya di Zeger Coffee: ${myCode} — dapat ${cfg.referral.reward_points} poin gratis!`;
    if ((navigator as any).share) { try { await (navigator as any).share({ title: 'Zeger Referral', text }); } catch {} }
    else { navigator.clipboard.writeText(text); toast({ title: 'Pesan disalin' }); }
  };
  const redeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc('redeem_referral', { _code: code.trim() });
    setLoading(false);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Berhasil!', description: `Dapat ${cfg.referral.reward_points} poin` }); setCode(''); }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="bg-[#EA2831] text-white p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10"><ChevronLeft className="h-6 w-6" /></button>
        <h1 className="text-xl font-bold">Referral</h1>
      </div>
      <div className="p-4 space-y-6">
        <div className="bg-gradient-to-br from-[#EA2831] to-red-700 text-white rounded-2xl p-6 shadow-xl">
          <p className="text-sm opacity-90">Kode referral kamu</p>
          <p className="text-3xl font-bold tracking-widest mt-2">{myCode}</p>
          <p className="text-xs opacity-90 mt-3">Ajak temanmu daftar & keduanya dapat {cfg.referral.reward_points} poin gratis.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={copy} className="flex-1"><Copy className="h-4 w-4 mr-1" />Salin</Button>
            <Button variant="secondary" onClick={share} className="flex-1"><Share2 className="h-4 w-4 mr-1" />Bagikan</Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-5 w-5 text-[#EA2831]" />
            <p className="font-bold text-gray-900">Punya kode referral?</p>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Masukkan kode" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            <Button disabled={loading} onClick={redeem} className="bg-[#EA2831] hover:bg-red-700">Klaim</Button>
          </div>
        </div>
      </div>
    </div>
  );
}