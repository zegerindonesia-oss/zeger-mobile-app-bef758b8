import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Props {
  open: boolean;
  scope: 'item' | 'bill';
  baseAmount: number;
  itemName?: string;
  onClose: () => void;
  onApply: (data: { type: 'percentage' | 'fixed'; value: number; computed: number; name: string }) => void;
}

export const POSPromoDialog = ({ open, scope, baseAmount, itemName, onClose, onApply }: Props) => {
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [name, setName] = useState('');

  const computed =
    type === 'percentage'
      ? Math.round((baseAmount * (Number(value) || 0)) / 100)
      : Math.round(Number(value) || 0);

  const handleApply = () => {
    const v = Number(value) || 0;
    if (v <= 0) return;
    onApply({
      type,
      value: v,
      computed: Math.min(computed, baseAmount),
      name: name.trim() || (scope === 'item' ? `Diskon ${itemName}` : 'Diskon Bill'),
    });
    setValue('');
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {scope === 'item' ? `Diskon: ${itemName}` : 'Diskon Bill'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Tipe</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as 'percentage' | 'fixed')}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="percentage" id="pct" />
                <Label htmlFor="pct">Persen (%)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed" id="fix" />
                <Label htmlFor="fix">Nominal (Rp)</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs">Nilai</Label>
            <Input
              type="number"
              placeholder={type === 'percentage' ? '10' : '5000'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Nama Promo (opsional)</Label>
            <Input
              placeholder="Misal: Promo karyawan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="bg-muted p-3 rounded text-sm">
            <div className="flex justify-between">
              <span>Dasar:</span>
              <span>Rp{baseAmount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between font-semibold text-destructive">
              <span>Diskon:</span>
              <span>-Rp{Math.min(computed, baseAmount).toLocaleString('id-ID')}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Batal
            </Button>
            <Button onClick={handleApply} className="flex-1" disabled={Number(value) <= 0}>
              Terapkan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
