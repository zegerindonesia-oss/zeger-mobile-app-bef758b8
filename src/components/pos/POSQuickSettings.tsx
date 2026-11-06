import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CategoryOrderSettings } from '@/components/customer/CategoryOrderSettings';
import { normalizeCategoryOrder } from '@/lib/customer-category-order';
import { ALL_ORDER_MODES } from '@/lib/pos-order-modes';

export const defaultModeKey = (branchId: string) => `pos.default_order_mode.${branchId}`;
const cacheKey = (branchId: string) => `pos_default_mode_${branchId}`;

/** Default order mode for a branch: cached on device, source of truth in app_settings. Falls back to dine-in. */
export const getCachedDefaultMode = (branchId: string | null) =>
  (branchId && localStorage.getItem(cacheKey(branchId))) || 'dine_in';

export const loadDefaultMode = async (branchId: string): Promise<string> => {
  const { data } = await supabase.from('app_settings').select('setting_value').eq('setting_key', defaultModeKey(branchId)).maybeSingle();
  const v = typeof data?.setting_value === 'string' ? data.setting_value : 'dine_in';
  localStorage.setItem(cacheKey(branchId), v);
  return v;
};

export function POSQuickSettings({ branchId, allowedModes }: { branchId: string | null; allowedModes?: string[] }) {
  const [mode, setMode] = useState('dine_in');
  const [order, setOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (branchId) loadDefaultMode(branchId).then(setMode);
    supabase.from('app_settings').select('setting_value').eq('setting_key', 'customer_menu.category_order').maybeSingle()
      .then(({ data }) => setOrder(normalizeCategoryOrder(data?.setting_value)));
  }, [branchId]);

  const modes = ALL_ORDER_MODES.filter((m) => !allowedModes?.length || allowedModes.includes(m.id));

  const save = async () => {
    if (!branchId) return;
    setSaving(true);
    const rows = [
      { setting_key: defaultModeKey(branchId), setting_value: mode as any, setting_type: 'pos', is_active: true },
      { setting_key: 'customer_menu.category_order', setting_value: order as any, setting_type: 'customer_app', is_active: true },
    ];
    const { error } = await supabase.from('app_settings').upsert(rows as any, { onConflict: 'setting_key' });
    setSaving(false);
    if (error) return toast.error('Gagal menyimpan: ' + error.message);
    localStorage.setItem(cacheKey(branchId), mode);
    toast.success('Default transaksi & urutan kategori disimpan');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="font-semibold">Mode transaksi default</div>
        <p className="text-xs text-muted-foreground">Mode yang otomatis terpilih setiap pesanan baru. Pilih meja tidak wajib — kasir bisa langsung bayar.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {modes.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`h-12 rounded-xl border-2 font-semibold transition ${mode === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="font-semibold">Urutan kategori menu</div>
        <p className="text-xs text-muted-foreground">Kategori teratas muncul paling kiri di POS (juga dipakai di aplikasi customer & QR meja).</p>
        <CategoryOrderSettings order={order} onChange={setOrder} />
      </div>
      <Button onClick={save} disabled={saving || !branchId} className="w-full md:w-auto">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
    </div>
  );
}
