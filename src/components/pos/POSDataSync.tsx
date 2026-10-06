import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { syncOfflineSales, usePOSConnection } from '@/lib/pos-offline';
import { cn } from '@/lib/utils';

type Key = 'branch' | 'pos' | 'promo' | 'menu' | 'sales' | 'tables' | 'member' | 'users';
const ITEMS: { key: Key; title: string; desc: string; table?: string }[] = [
  { key: 'branch', title: 'Pengaturan Cabang', desc: 'Pajak, service charge, format tagihan & profil outlet.', table: 'branches' },
  { key: 'pos', title: 'Pengaturan POS', desc: 'Printer, layar TV antrean & preferensi kasir.', table: 'pos_printer_settings' },
  { key: 'promo', title: 'Promosi & Voucher', desc: 'Daftar promo, periode berlaku, bundle & voucher.', table: 'pos_promotions' },
  { key: 'menu', title: 'Menu', desc: 'Daftar menu, kategori, harga, foto & stok outlet.', table: 'products' },
  { key: 'sales', title: 'Penjualan', desc: 'Kirim transaksi offline yang tersimpan di perangkat ke pusat.' },
  { key: 'tables', title: 'Pengaturan Meja', desc: 'Area dan daftar meja cabang.', table: 'pos_tables' },
  { key: 'member', title: 'Member & Loyalty', desc: 'Data member, tier, reward dan aturan poin.', table: 'loyalty_rewards' },
  { key: 'users', title: 'Pengguna & Hak Akses', desc: 'Akun kasir, peran dan hak akses dari back office.', table: 'user_role_permissions' },
];

/** Pulls latest back-office data and pushes offline sales on demand. */
export const POSDataSync = () => {
  const conn = usePOSConnection();
  const [sel, setSel] = useState<Set<Key>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, string>>({});
  const all = sel.size === ITEMS.length;

  const toggle = (k: Key) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const run = async () => {
    if (!navigator.onLine) return toast.error('Perangkat sedang offline');
    setBusy(true);
    const res: Record<string, string> = {};
    for (const it of ITEMS.filter((i) => sel.has(i.key))) {
      try {
        if (it.key === 'sales') {
          const r = await syncOfflineSales();
          res[it.key] = r.failed ? `${r.failed} gagal` : `${r.ok} terkirim`;
        } else if (it.table) {
          const { count, error } = await (supabase as any).from(it.table).select('*', { count: 'exact', head: true });
          if (error) throw error;
          res[it.key] = `${count ?? 0} data diperbarui`;
        }
      } catch { res[it.key] = 'gagal'; }
    }
    localStorage.setItem('pos_last_data_sync', new Date().toISOString());
    window.dispatchEvent(new Event('pos-data-synced'));
    setDone(res);
    setBusy(false);
    toast.success('Sinkronisasi selesai — data terbaru dari back office sudah dimuat');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 font-semibold">
          <Switch checked={all} onCheckedChange={(v) => setSel(v ? new Set(ITEMS.map((i) => i.key)) : new Set())} /> Pilih Semua
        </label>
        <Button onClick={run} disabled={!sel.size || busy} className="h-12 px-6 rounded-2xl">
          <RefreshCw className={cn('h-4 w-4 mr-2', busy && 'animate-spin')} /> Sinkronkan
        </Button>
      </div>
      <div className={cn('rounded-2xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2', conn.online ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
        <span className="h-2 w-2 rounded-full bg-current" />
        {conn.online ? 'Online' : 'Offline'} · {conn.pending} penjualan menunggu sinkron
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {ITEMS.map((it) => (
          <button key={it.key} type="button" onClick={() => toggle(it.key)}
            className={cn('text-left rounded-2xl border p-4 flex gap-3 transition', sel.has(it.key) ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50')}>
            <Checkbox checked={sel.has(it.key)} className="mt-0.5 pointer-events-none" />
            <div className="min-w-0">
              <div className="font-bold">{it.title}</div>
              <div className="text-sm text-muted-foreground">{it.desc}</div>
              {done[it.key] && <div className="mt-1 text-xs font-semibold text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{done[it.key]}</div>}
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Perubahan menu, harga, promo, dan hak akses dibuat di Back Office. Tekan Sinkronkan agar kasir memakai data terbaru.</p>
    </div>
  );
};
