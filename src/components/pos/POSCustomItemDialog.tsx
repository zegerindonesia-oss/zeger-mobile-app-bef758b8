import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (item: { name: string; price: number; qty: number; notes: string }) => void;
}

export const POSCustomItemDialog = ({ open, onClose, onAdd }: Props) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setName('');
    setPrice('');
    setQty('1');
    setNotes('');
  };

  const handleAdd = () => {
    const p = Number(price) || 0;
    const q = Number(qty) || 1;
    if (!name.trim() || p <= 0 || q <= 0) return;
    onAdd({ name: name.trim(), price: p, qty: q, notes: notes.trim() });
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nama Item *</Label>
            <Input
              placeholder="Misal: Es Teh Manis Custom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Harga *</Label>
              <Input
                type="number"
                placeholder="10000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Catatan (opsional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="bg-muted p-2 rounded text-sm flex justify-between">
            <span>Total:</span>
            <span className="font-semibold">
              Rp{((Number(price) || 0) * (Number(qty) || 0)).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Batal
            </Button>
            <Button
              onClick={handleAdd}
              className="flex-1"
              disabled={!name.trim() || Number(price) <= 0}
            >
              Tambah
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
