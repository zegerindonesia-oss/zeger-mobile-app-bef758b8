import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_ORDER_MODES } from '@/lib/pos-order-modes';
import { applyModePrice, PRICING_MODEL_LABELS, type ModePricingMap, type ModePricingRule, type PricingModel, type RoundingRule } from '@/lib/pos-mode-pricing';

const SAMPLE = 10000;
const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

interface Props { modes: string[]; value: ModePricingMap; onChange: (v: ModePricingMap) => void }

/** Back Office editor: price uprise model per order mode (percent, fixed, or gross-up net recovery). */
export const ModePricingEditor = ({ modes, value, onChange }: Props) => {
  const list = ALL_ORDER_MODES.filter((m) => modes.includes(m.id));
  const set = (id: string, patch: Partial<ModePricingRule>) => {
    const cur: ModePricingRule = value[id] || { model: 'none', value: 0, rounding: 'exact' };
    onChange({ ...value, [id]: { ...cur, ...patch } });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Harga menu di Back Office = harga offline. Pilih cara kenaikan per mode. <b>Net Recovery</b> menghitung harga = offline ÷ (1 − komisi%), jadi setelah dipotong aplikasi, outlet tetap terima sama dengan harga offline.
      </p>
      {list.map((m) => {
        const r: ModePricingRule = value[m.id] || { model: 'none', value: 0, rounding: 'exact' };
        const sell = applyModePrice(SAMPLE, r);
        const net = r.model === 'gross_up' ? sell * (1 - (Number(r.value) || 0) / 100) : sell;
        return (
          <div key={m.id} className="grid gap-2 rounded-2xl border p-3 md:grid-cols-[8rem_1fr_7rem_9rem_1fr] md:items-center">
            <div className="font-semibold">{m.label}</div>
            <Select value={r.model} onValueChange={(v) => set(m.id, { model: v as PricingModel })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(PRICING_MODEL_LABELS) as PricingModel[]).map((k) => <SelectItem key={k} value={k}>{PRICING_MODEL_LABELS[k]}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" min={0} disabled={r.model === 'none'} value={r.value || ''} placeholder={r.model === 'fixed' ? 'Rp' : '%'}
              onChange={(e) => set(m.id, { value: Number(e.target.value) || 0 })} />
            <Select value={r.rounding} onValueChange={(v) => set(m.id, { rounding: v as RoundingRule })} disabled={r.model === 'none'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Tanpa pembulatan</SelectItem>
                <SelectItem value="500">Bulatkan Rp500</SelectItem>
                <SelectItem value="1000">Bulatkan Rp1.000</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {rp(SAMPLE)} → <b className="text-foreground">{rp(sell)}</b>
              {r.model === 'gross_up' && <> · diterima ±{rp(net)}</>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
