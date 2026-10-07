import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSShift } from '@/hooks/usePOSShift';
import { usePOSBranchSettings } from '@/hooks/usePOSBranchSettings';

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

/** Full-page cash in / cash out with Back Office-defined categories. */
export const POSCashPage = ({ branchId }: { branchId: string | null }) => {
  const { activeShift, addCashMovement } = usePOSShift();
  const { settings } = usePOSBranchSettings(branchId);
  const [type, setType] = useState<'in' | 'out'>('in');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const cats = (type === 'in' ? settings?.cash_in_categories : settings?.cash_out_categories) || [];

  const load = () => {
    if (!activeShift) return setRows([]);
    (supabase as any).from('pos_cash_movements').select('*').eq('shift_id', activeShift.id).order('created_at', { ascending: false })
      .then(({ data }: any) => setRows(data || []));
  };
  useEffect(load, [activeShift?.id]); // eslint-disable-line
  useEffect(() => setCategory(''), [type]);

  const submit = async () => {
    const amt = Number(amount);
    if (!category) return toast.error('Pilih kategori');
    if (!amt || amt <= 0) return toast.error('Nominal belum diisi');
    setBusy(true);
    try {
      await addCashMovement(type, amt, note.trim() ? `${category} — ${note.trim()}` : category, category);
      toast.success(type === 'in' ? 'Kas masuk dicatat' : 'Kas keluar dicatat');
      setAmount(''); setNote(''); setCategory(''); load();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const totalIn = rows.filter((r) => r.movement_type === 'in').reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = rows.filter((r) => r.movement_type === 'out').reduce((s, r) => s + Number(r.amount), 0);

  if (!activeShift) return <div className="py-10 text-center text-muted-foreground">Buka shift terlebih dahulu di Terminal Kasir untuk mencatat kas.</div>;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">Kas Masuk & Kas Keluar</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-background p-4"><div className="text-xs text-muted-foreground">Total Kas Masuk (shift ini)</div><div className="text-xl font-bold text-success">{rp(totalIn)}</div></div>
        <div className="rounded-2xl border bg-background p-4"><div className="text-xs text-muted-foreground">Total Kas Keluar (shift ini)</div><div className="text-xl font-bold text-destructive">{rp(totalOut)}</div></div>
      </div>
      <div className="rounded-2xl border bg-background p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setType('in')} className={cn('h-12 rounded-xl border font-bold flex items-center justify-center gap-2', type === 'in' ? 'bg-success text-success-foreground border-success' : 'hover:bg-muted')}><ArrowDownCircle className="h-5 w-5" /> Kas Masuk</button>
          <button onClick={() => setType('out')} className={cn('h-12 rounded-xl border font-bold flex items-center justify-center gap-2', type === 'out' ? 'bg-destructive text-destructive-foreground border-destructive' : 'hover:bg-muted')}><ArrowUpCircle className="h-5 w-5" /> Kas Keluar</button>
        </div>
        <div>
          <div className="text-sm font-semibold mb-2">Kategori</div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={cn('h-10 px-4 rounded-xl border text-sm font-semibold', category === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input type="number" inputMode="numeric" placeholder="Nominal (Rp)" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg font-bold" />
          <Input placeholder="Keterangan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-12" />
        </div>
        <Button className="h-12 w-full sm:w-48" disabled={busy} onClick={submit}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
      </div>
      <div className="rounded-2xl border bg-background overflow-hidden">
        <div className="px-4 py-3 font-semibold border-b">Riwayat Shift Ini</div>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 text-sm">
            <div><div className="font-semibold">{r.category || r.reason || '-'}</div><div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB · {r.reason}</div></div>
            <div className={cn('font-bold', r.movement_type === 'in' ? 'text-success' : 'text-destructive')}>{r.movement_type === 'in' ? '+' : '-'}{rp(Number(r.amount))}</div>
          </div>
        ))}
        {!rows.length && <div className="px-4 py-6 text-sm text-muted-foreground text-center">Belum ada kas masuk/keluar.</div>}
      </div>
    </div>
  );
};
