import { useState } from 'react';
import { Delete, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { setActiveCashier } from '@/lib/pos-cashier';
import { toast } from 'sonner';

/** Full-screen numpad: cashier must enter their PIN before using the POS. */
export const POSPinLock = ({ branchId, branchName, onUnlock }: { branchId: string | null; branchName: string; onUnlock: () => void }) => {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (p = pin) => {
    if (p.length < 4 || !branchId) return;
    setBusy(true); setErr('');
    const { data, error } = await (supabase as any).rpc('verify_cashier_pin', { _branch_id: branchId, _pin: p });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) { setErr('PIN salah. Coba lagi.'); setPin(''); return; }
    setActiveCashier(branchId, { id: row.profile_id, name: row.full_name, at: Date.now() });
    toast.success(`Selamat bertugas, ${row.full_name}`);
    onUnlock();
  };
  const press = (d: string) => {
    if (busy) return;
    const n = (pin + d).slice(0, 6);
    setPin(n); setErr('');
    if (n.length === 6) submit(n);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl space-y-5 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center"><Lock className="h-7 w-7" /></div>
        <div>
          <h1 className="text-2xl font-bold">Masuk Kasir</h1>
          <p className="text-sm text-muted-foreground">{branchName} · masukkan PIN kasir Anda</p>
        </div>
        <div className="flex justify-center gap-3 h-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
          ))}
        </div>
        <p className="text-sm text-destructive h-5">{err}</p>
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => press(d)} className="pos-raised-control h-16 rounded-2xl text-2xl font-bold">{d}</button>
          ))}
          <button onClick={() => setPin((p) => p.slice(0, -1))} className="pos-raised-control h-16 rounded-2xl grid place-items-center" aria-label="Hapus"><Delete className="h-6 w-6" /></button>
          <button onClick={() => press('0')} className="pos-raised-control h-16 rounded-2xl text-2xl font-bold">0</button>
          <button onClick={() => submit()} disabled={pin.length < 4 || busy} className="h-16 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50 grid place-items-center">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Masuk'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Belum punya PIN? Minta manager mengatur PIN di Back Office → Konfigurasi POS Cabang.</p>
      </div>
    </div>
  );
};
