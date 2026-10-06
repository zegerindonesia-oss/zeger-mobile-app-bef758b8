import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Offline POS sale queue: sales are stored locally and pushed when internet returns. */
const KEY = 'pos_offline_sales_v1';
const EVT = 'pos-offline-queue-changed';

export interface OfflineSale {
  id: string;
  created_at: string;
  tx: Record<string, any>;
  items: Record<string, any>[];
  branch_id: string;
  stock: { product_id: string; qty: number }[];
}

export const getOfflineSales = (): OfflineSale[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const save = (l: OfflineSale[]) => { localStorage.setItem(KEY, JSON.stringify(l)); window.dispatchEvent(new Event(EVT)); };
export const enqueueOfflineSale = (s: OfflineSale) => save([...getOfflineSales(), s]);

let syncing = false;
export const syncOfflineSales = async (): Promise<{ ok: number; failed: number }> => {
  if (syncing || !navigator.onLine) return { ok: 0, failed: getOfflineSales().length };
  syncing = true;
  let ok = 0, failed = 0;
  try {
    for (const s of getOfflineSales()) {
      try {
        const { data: exists } = await supabase.from('pos_transactions').select('id').eq('id', s.id).maybeSingle();
        if (!exists) {
          const { error } = await supabase.from('pos_transactions').insert(s.tx as any);
          if (error) throw error;
          const { error: e2 } = await supabase.from('pos_transaction_items').insert(s.items as any);
          if (e2) throw e2;
          for (const it of s.stock) {
            const { data: inv } = await supabase.from('inventory').select('id, stock_quantity')
              .eq('branch_id', s.branch_id).eq('product_id', it.product_id).is('rider_id', null).maybeSingle();
            if (inv) await supabase.from('inventory').update({ stock_quantity: Math.max(0, (inv.stock_quantity || 0) - it.qty), last_updated: new Date().toISOString() }).eq('id', inv.id);
          }
          try { await (supabase as any).rpc('deduct_recipe_for_transaction', { _transaction_id: s.id }); } catch { /* optional */ }
        }
        save(getOfflineSales().filter((x) => x.id !== s.id));
        ok++;
      } catch (e) {
        console.error('offline sync failed', e);
        failed++;
      }
    }
  } finally { syncing = false; }
  return { ok, failed };
};

/** Online flag + pending count; auto-syncs when the connection comes back. */
export const usePOSConnection = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(getOfflineSales().length);
  const [syncingNow, setSyncingNow] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const sync = useCallback(async () => {
    setSyncingNow(true);
    const r = await syncOfflineSales();
    setSyncingNow(false);
    setPending(getOfflineSales().length);
    if (r.failed === 0) setLastSync(new Date());
    return r;
  }, []);

  useEffect(() => {
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    const ch = () => setPending(getOfflineSales().length);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener(EVT, ch);
    window.addEventListener('storage', ch);
    if (navigator.onLine && getOfflineSales().length) sync();
    return () => {
      window.removeEventListener('online', up); window.removeEventListener('offline', down);
      window.removeEventListener(EVT, ch); window.removeEventListener('storage', ch);
    };
  }, [sync]);

  return { online, pending, syncing: syncingNow, lastSync, sync };
};
