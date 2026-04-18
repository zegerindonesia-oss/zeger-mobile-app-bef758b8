import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface Props {
  open: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (payload: {
    method1: string;
    amount1: number;
    method2: string | null;
    amount2: number;
    cashReceived: number;
    change: number;
  }) => Promise<void>;
}

const METHODS = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'edc', label: 'EDC / Debit / Kredit' },
  { value: 'gopay', label: 'GoPay' },
  { value: 'ovo', label: 'OVO' },
];

export const POSPayment = ({ open, total, onClose, onConfirm }: Props) => {
  const [method1, setMethod1] = useState('cash');
  const [amount1, setAmount1] = useState<number>(0);
  const [mixed, setMixed] = useState(false);
  const [method2, setMethod2] = useState('qris');
  const [amount2, setAmount2] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

  const change = useMemo(() => {
    const paid = (amount1 || 0) + (mixed ? amount2 || 0 : 0);
    if (method1 === 'cash' && !mixed) return Math.max(0, (amount1 || 0) - total);
    return Math.max(0, paid - total);
  }, [amount1, amount2, mixed, method1, total]);

  const handleConfirm = async () => {
    const a1 = mixed ? amount1 || 0 : total;
    const a2 = mixed ? amount2 || 0 : 0;
    const cashReceived = method1 === 'cash' && !mixed ? amount1 || 0 : 0;
    const paid = mixed ? a1 + a2 : (method1 === 'cash' ? amount1 || 0 : total);
    if (mixed && a1 + a2 < total) return;
    if (method1 === 'cash' && !mixed && paid < total) return;
    setProcessing(true);
    try {
      await onConfirm({
        method1,
        amount1: mixed ? a1 : total,
        method2: mixed ? method2 : null,
        amount2: a2,
        cashReceived,
        change,
      });
    } finally {
      setProcessing(false);
    }
  };

  const quickAmounts = [50000, 100000, 200000, 500000];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted p-3 rounded text-center">
            <div className="text-xs text-muted-foreground">Total Tagihan</div>
            <div className="text-3xl font-bold text-primary">{fmt(total)}</div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Mixed Payment (2 metode)</Label>
            <Switch checked={mixed} onCheckedChange={setMixed} />
          </div>

          <div>
            <Label className="text-xs">Metode 1</Label>
            <Select value={method1} onValueChange={setMethod1}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {(mixed || method1 === 'cash') && (
              <>
                <Input
                  type="number"
                  className="mt-2"
                  placeholder="Nominal"
                  value={amount1 || ''}
                  onChange={(e) => setAmount1(Number(e.target.value) || 0)}
                />
                {method1 === 'cash' && !mixed && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {quickAmounts.map((a) => (
                      <Button key={a} size="sm" variant="outline" onClick={() => setAmount1(a)}>
                        {fmt(a)}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setAmount1(total)}>UANG PAS</Button>
                  </div>
                )}
              </>
            )}
          </div>

          {mixed && (
            <div>
              <Label className="text-xs">Metode 2</Label>
              <Select value={method2} onValueChange={setMethod2}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.filter((m) => m.value !== method1).map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="mt-2"
                placeholder="Nominal"
                value={amount2 || ''}
                onChange={(e) => setAmount2(Number(e.target.value) || 0)}
              />
            </div>
          )}

          {(method1 === 'cash' || mixed) && change > 0 && (
            <div className="bg-primary/10 p-3 rounded flex justify-between items-center">
              <span className="font-semibold">Kembalian</span>
              <span className="text-2xl font-bold text-primary">{fmt(change)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>Batal</Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? 'Memproses...' : 'Konfirmasi Bayar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
