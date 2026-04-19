import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { POSCartItem } from '@/hooks/usePOSCart';

export interface SplitResult {
  mode: 'item' | 'equal' | 'custom';
  splits: Array<{
    label: string;
    items?: POSCartItem[];
    amount: number;
  }>;
}

interface Props {
  open: boolean;
  items: POSCartItem[];
  total: number;
  onClose: () => void;
  onConfirm: (result: SplitResult) => void;
}

export const POSSplitBillDialog = ({ open, items, total, onClose, onConfirm }: Props) => {
  const [mode, setMode] = useState<'item' | 'equal' | 'custom'>('equal');
  const [peopleCount, setPeopleCount] = useState('2');
  const [itemAssignment, setItemAssignment] = useState<Record<string, number>>({});
  const [splitCount, setSplitCount] = useState(2);
  const [customAmounts, setCustomAmounts] = useState<string[]>(['', '']);

  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

  // EQUAL
  const equalSplits = useMemo(() => {
    const n = Math.max(2, Math.min(6, Number(peopleCount) || 2));
    const per = Math.round(total / n);
    return Array.from({ length: n }, (_, i) => ({
      label: `Bill ${String.fromCharCode(65 + i)}`,
      amount: i === n - 1 ? total - per * (n - 1) : per,
    }));
  }, [peopleCount, total]);

  // ITEM
  const itemSplits = useMemo(() => {
    const groups: Record<number, POSCartItem[]> = {};
    items.forEach((it) => {
      const target = itemAssignment[it.product_id] ?? 0;
      groups[target] = groups[target] || [];
      groups[target].push(it);
    });
    return Array.from({ length: splitCount }, (_, i) => {
      const list = groups[i] || [];
      const amount = list.reduce((s, it) => s + it.price * it.qty - it.discount_item * it.qty, 0);
      return { label: `Bill ${String.fromCharCode(65 + i)}`, items: list, amount };
    });
  }, [items, itemAssignment, splitCount]);

  // CUSTOM
  const customSplits = useMemo(
    () =>
      customAmounts.map((a, i) => ({
        label: `Bill ${String.fromCharCode(65 + i)}`,
        amount: Number(a) || 0,
      })),
    [customAmounts]
  );
  const customSum = customSplits.reduce((s, x) => s + x.amount, 0);

  const handleConfirm = () => {
    if (mode === 'equal') onConfirm({ mode, splits: equalSplits });
    else if (mode === 'item') {
      if (itemSplits.some((s) => s.amount === 0)) {
        return;
      }
      onConfirm({ mode, splits: itemSplits });
    } else {
      if (customSum !== total) return;
      onConfirm({ mode, splits: customSplits });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Bill — Total {fmt(total)}</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="equal">Bagi Rata</TabsTrigger>
            <TabsTrigger value="item">Per Item</TabsTrigger>
            <TabsTrigger value="custom">Nominal Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="equal" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Jumlah Orang (2-6)</Label>
              <Input
                type="number"
                min={2}
                max={6}
                value={peopleCount}
                onChange={(e) => setPeopleCount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              {equalSplits.map((s) => (
                <div key={s.label} className="flex justify-between bg-muted p-2 rounded text-sm">
                  <span>{s.label}</span>
                  <span className="font-semibold">{fmt(s.amount)}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="item" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Jumlah Bill</Label>
              <Input
                type="number"
                min={2}
                max={6}
                value={splitCount}
                onChange={(e) => {
                  const n = Math.max(2, Math.min(6, Number(e.target.value) || 2));
                  setSplitCount(n);
                }}
              />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map((it) => (
                <div key={it.product_id} className="border rounded p-2">
                  <div className="text-sm font-medium">
                    {it.product_name} × {it.qty} — {fmt(it.price * it.qty)}
                  </div>
                  <div className="flex gap-3 mt-1">
                    {Array.from({ length: splitCount }, (_, i) => (
                      <label key={i} className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={(itemAssignment[it.product_id] ?? 0) === i}
                          onCheckedChange={() =>
                            setItemAssignment((p) => ({ ...p, [it.product_id]: i }))
                          }
                        />
                        Bill {String.fromCharCode(65 + i)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {itemSplits.map((s) => (
                <div key={s.label} className="flex justify-between bg-muted p-2 rounded text-sm">
                  <span>{s.label} ({s.items?.length || 0} item)</span>
                  <span className="font-semibold">{fmt(s.amount)}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Jumlah Bill</Label>
              <Input
                type="number"
                min={2}
                max={6}
                value={customAmounts.length}
                onChange={(e) => {
                  const n = Math.max(2, Math.min(6, Number(e.target.value) || 2));
                  setCustomAmounts((prev) => {
                    const arr = [...prev];
                    while (arr.length < n) arr.push('');
                    return arr.slice(0, n);
                  });
                }}
                className="w-20"
              />
            </div>
            <div className="space-y-2">
              {customAmounts.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Label className="text-xs w-16">Bill {String.fromCharCode(65 + i)}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={a}
                    onChange={(e) =>
                      setCustomAmounts((prev) => {
                        const arr = [...prev];
                        arr[i] = e.target.value;
                        return arr;
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="bg-muted p-2 rounded text-sm space-y-1">
              <div className="flex justify-between">
                <span>Total terbagi:</span>
                <span className="font-semibold">{fmt(customSum)}</span>
              </div>
              <div className="flex justify-between">
                <span>Selisih:</span>
                <span className={customSum === total ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                  {fmt(total - customSum)}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={mode === 'custom' && customSum !== total}
          >
            Lanjut Bayar Split
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
