import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PAYMENT_METHODS, resolvePaymentMethods, slugMethod, type PaymentMethodConfig } from '@/lib/pos-payment-methods';

/** Back Office editor for the payment methods the branch cashier can pick. */
export const PaymentMethodsEditor = ({ value, onChange }: { value: PaymentMethodConfig[]; onChange: (v: PaymentMethodConfig[]) => void }) => {
  const list = resolvePaymentMethods(value);
  const [label, setLabel] = useState('');
  const builtIn = (v: string) => DEFAULT_PAYMENT_METHODS.some((d) => d.value === v);
  const add = () => {
    const l = label.trim(); const v = slugMethod(l);
    if (!l || !v || list.some((m) => m.value === v)) return;
    onChange([...list, { value: v, label: l, enabled: true }]); setLabel('');
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {list.map((m) => (
          <div key={m.value} className="flex items-center justify-between gap-2 rounded-xl border p-3">
            <span className="font-medium truncate">{m.label}</span>
            <div className="flex items-center gap-1">
              <Switch checked={m.enabled} disabled={m.value === 'cash'}
                onCheckedChange={(c) => onChange(list.map((x) => (x.value === m.value ? { ...x, enabled: c } : x)))} />
              {!builtIn(m.value) && (
                <Button size="icon" variant="ghost" onClick={() => onChange(list.filter((x) => x.value !== m.value))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 max-w-sm">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tambah metode (mis. LinkAja)" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground">Tunai selalu aktif. Kasir cabang ini otomatis mengikuti setelah disimpan.</p>
    </div>
  );
};
