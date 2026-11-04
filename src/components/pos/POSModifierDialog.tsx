import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus } from 'lucide-react';
import { defaultSelection, getModifierGroups, modifierPrice } from '@/lib/pos-modifiers';
import type { AddItemOptions } from '@/hooks/usePOSCart';

interface Props {
  product: { name: string; price: number; category: string | null; custom_options?: any } | null;
  onClose: () => void;
  onConfirm: (opts: AddItemOptions) => void;
  /** Prefill when editing an existing cart line. */
  initial?: { qty: number; modifiers: string[]; notes: string } | null;
}

const fmt = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

export const POSModifierDialog = ({ product, onClose, onConfirm, initial }: Props) => {
  const groups = useMemo(() => (product ? getModifierGroups(product) : []), [product]);
  const [selected, setSelected] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (product) {
      setSelected(initial ? initial.modifiers : defaultSelection(groups));
      setQty(initial?.qty ?? 1);
      setNotes(initial?.notes ?? '');
    }
  }, [product, groups, initial]);

  if (!product) return null;

  const toggle = (groupIdx: number, name: string) => {
    const g = groups[groupIdx];
    const groupNames = g.options.map((o) => o.name);
    setSelected((prev) => {
      if (g.multi) return prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      const without = prev.filter((x) => !groupNames.includes(x));
      if (prev.includes(name) && !g.required) return without;
      return [...without, name];
    });
  };

  const extra = modifierPrice(groups, selected);
  const unit = Number(product.price) + extra;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[92vw] md:w-[80vw] max-w-5xl max-h-[88vh] p-6 md:p-8">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-baseline gap-2">
            <span className="text-xl md:text-2xl">{product.name}</span>
            <span className="text-primary text-xl md:text-2xl">{fmt(unit)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
          {groups.map((g, gi) => (
            <div key={g.name}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                {g.name} {g.required ? <span className="text-destructive">*</span> : <span className="normal-case font-normal">(opsional{g.multi ? ', bisa lebih dari satu' : ''})</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = selected.includes(o.name);
                  return (
                    <Button
                      key={o.name}
                      type="button"
                      size="sm"
                      variant={on ? 'default' : 'outline'}
                      onClick={() => toggle(gi, o.name)}
                      className="h-14 px-5 text-base rounded-xl"
                    >
                      {o.name}
                      {o.price > 0 && <span className="ml-1 opacity-80 text-xs">+{fmt(o.price)}</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
          <Input placeholder="Catatan dapur (misal: dipanasin, pisah es)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
            <span className="w-10 text-center font-semibold">{qty}</span>
            <Button size="icon" variant="outline" onClick={() => setQty((q) => q + 1)}><Plus className="h-4 w-4" /></Button>
          </div>
          <Button className="flex-1 h-14 text-base" onClick={() => onConfirm({ qty, modifiers: selected, notes, extraPrice: extra })}>
            {initial ? 'Simpan Perubahan' : 'Tambah'} • {fmt(unit * qty)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
