import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LayoutGrid, Users, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_ORDER_MODES, EXTERNAL_MODES } from '@/lib/pos-order-modes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderType: string;
  pax: number;
  externalOrderId: string;
  allowedModes?: string[];
  onConfirm: (v: { orderType: string; pax: number; externalOrderId: string }) => void;
}

export const POSModeDialog = ({ open, onOpenChange, orderType, pax, externalOrderId, allowedModes, onConfirm }: Props) => {
  const [mode, setMode] = useState(orderType);
  const [p, setP] = useState(pax);
  const [ext, setExt] = useState(externalOrderId);
  const modes = ALL_ORDER_MODES.filter((m) => !allowedModes || allowedModes.includes(m.id));
  useEffect(() => { if (open) { setMode(orderType); setP(pax); setExt(externalOrderId); } }, [open]); // eslint-disable-line

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden [&>button]:hidden">
        <div className="bg-primary text-primary-foreground px-5 py-4 flex items-center gap-2 font-bold text-lg">
          <LayoutGrid className="h-5 w-5" /> Mode Transaksi
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm mb-3"><Users className="h-4 w-4 text-primary" /> Jumlah Pax</div>
            <Input type="number" min={1} value={p} onChange={(e) => setP(Math.max(1, Number(e.target.value) || 1))}
              className="mx-auto w-32 h-14 text-center text-2xl font-bold rounded-2xl" />
            <div className="flex gap-2 overflow-x-auto mt-3 pb-1 custom-scroll">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setP(n)}
                  className={cn('h-12 w-14 shrink-0 rounded-xl border text-base font-semibold transition', p === n ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-muted')}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm mb-3"><Store className="h-4 w-4 text-primary" /> Mode Penjualan</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {modes.map((m, i) => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={cn('h-14 rounded-2xl border text-sm font-bold uppercase transition', mode === m.id ? 'bg-primary text-primary-foreground border-primary shadow' : 'border-border hover:bg-muted')}>
                  {String.fromCharCode(65 + i)}. {m.label}
                </button>
              ))}
            </div>
            {EXTERNAL_MODES.includes(mode) && (
              <Input className="mt-3 h-11 rounded-xl" placeholder="ID pemesanan platform" value={ext} onChange={(e) => setExt(e.target.value)} />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-12 w-36 rounded-2xl text-destructive border-destructive/50" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button className="h-12 w-36 rounded-2xl" disabled={!mode} onClick={() => { onConfirm({ orderType: mode, pax: p, externalOrderId: ext }); onOpenChange(false); }}>Proses</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
