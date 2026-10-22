import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageCircle } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; branchId: string | null; shiftId?: string | null; branchName: string; inline?: boolean }

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PAY: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', edc: 'EDC/Debit', debit: 'Debit', card: 'Kartu' };

export function POSReportsDialog({ open, onOpenChange, branchId, shiftId, branchName, inline }: Props) {
  const [range, setRange] = useState<'shift' | 'today' | 'yesterday' | 'custom'>('today');
  const [from, setFrom] = useState(ymd(new Date()));
  const [to, setTo] = useState(ymd(new Date()));
  const [txs, setTxs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !branchId) return;
    (async () => {
      setLoading(true);
      const db = supabase as any;
      let rows: any[] = [];
      for (let i = 0; ; i += 1000) {
        let qb = db.from('pos_transactions').select('id,transaction_number,created_at,customer_name,status,payment_method_1,amount_1,payment_method_2,amount_2,change_amount,subtotal,discount_item,discount_bill,service_charge,tax,total,order_type')
          .eq('branch_id', branchId).order('created_at', { ascending: false }).range(i, i + 999);
        if (range === 'shift' && shiftId) qb = qb.eq('shift_id', shiftId);
        else {
          const now = new Date(); let a = from, b = to;
          if (range === 'today') a = b = ymd(now);
          if (range === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); a = b = ymd(y); }
          qb = qb.gte('created_at', `${a}T00:00:00+07:00`).lte('created_at', `${b}T23:59:59+07:00`);
        }
        const { data } = await qb;
        rows = rows.concat(data || []);
        if (!data || data.length < 1000) break;
      }
      setTxs(rows);
      const ids = rows.filter((t) => t.status === 'paid').map((t) => t.id);
      let its: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db.from('pos_transaction_items').select('transaction_id,product_name,category,qty,price,subtotal_item,notes').in('transaction_id', ids.slice(i, i + 200));
        its = its.concat(data || []);
      }
      setItems(its);
      setLoading(false);
    })();
  }, [open, branchId, shiftId, range, from, to]);

  const paid = txs.filter((t) => t.status === 'paid');
  const voids = txs.filter((t) => t.status === 'void' || t.status === 'voided');
  const sum = (k: string) => paid.reduce((s, t) => s + Number(t[k] || 0), 0);
  const gross = sum('subtotal'), disc = sum('discount_item') + sum('discount_bill'), net = sum('total');

  const pays = useMemo(() => {
    const m: Record<string, { count: number; amount: number }> = {};
    paid.forEach((t) => {
      const add = (k: string | null, a: number) => { if (!k) return; m[k] ??= { count: 0, amount: 0 }; m[k].count++; m[k].amount += a; };
      add(t.payment_method_1, Number(t.amount_1 || 0) - (t.payment_method_1 === 'cash' ? Number(t.change_amount || 0) : 0));
      add(t.payment_method_2, Number(t.amount_2 || 0));
    });
    return Object.entries(m).sort((a, b) => b[1].amount - a[1].amount);
  }, [txs]);

  const menus = useMemo(() => {
    const m: Record<string, { cat: string; qty: number; amount: number }> = {};
    items.forEach((i) => { const k = i.product_name || 'Item'; m[k] ??= { cat: i.category || '-', qty: 0, amount: 0 }; m[k].qty += Number(i.qty || 0); m[k].amount += Number(i.subtotal_item || 0); });
    return Object.entries(m).sort((a, b) => b[1].qty - a[1].qty);
  }, [items]);
  const menuTotal = menus.reduce((s, [, v]) => s + v.amount, 0) || 1;

  const filtered = txs.filter((t) => !q || `${t.transaction_number} ${t.customer_name || ''}`.toLowerCase().includes(q.toLowerCase()));

  const sendWa = () => {
    const text = [`*Laporan ${branchName}*`, `Penjualan Bersih: ${rp(net)}`, `Transaksi: ${paid.length} · Void: ${voids.length}`, '', '*Metode Bayar*',
      ...pays.map(([k, v]) => `- ${PAY[k] || k} (${v.count}): ${rp(v.amount)}`), '', '*Menu Terlaris*', ...menus.slice(0, 10).map(([k, v]) => `- ${k}: ${v.qty}`)].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const Stat = ({ l, v }: { l: string; v: string }) => (
    <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-bold">{v}</div></div>
  );

  const body = (
      <>
        <div className="flex flex-wrap gap-2 items-center">
          {([['shift', 'Shift Ini'], ['today', 'Hari Ini'], ['yesterday', 'Kemarin'], ['custom', 'Pilih Tanggal']] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={range === k ? 'default' : 'outline'} onClick={() => setRange(k)} disabled={k === 'shift' && !shiftId}>{l}</Button>
          ))}
          {range === 'custom' && <>
            <Input type="date" className="w-auto h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" className="w-auto h-9" value={to} onChange={(e) => setTo(e.target.value)} />
          </>}
          <Button size="sm" variant="outline" className="ml-auto" onClick={sendWa}><MessageCircle className="h-4 w-4" /> Kirim WA</Button>
        </div>
        {loading ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <Tabs defaultValue="summary">
            <TabsList className="grid grid-cols-4 w-full h-12">
              <TabsTrigger value="summary">Penjualan</TabsTrigger>
              <TabsTrigger value="history">Riwayat</TabsTrigger>
              <TabsTrigger value="menu">Per Menu</TabsTrigger>
              <TabsTrigger value="pay">Metode Bayar</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat l="Penjualan Kotor" v={rp(gross)} />
              <Stat l="Diskon" v={`-${rp(disc)}`} />
              <Stat l="Service + Pajak" v={rp(sum('service_charge') + sum('tax'))} />
              <Stat l="Penjualan Bersih" v={rp(net)} />
              <Stat l="Jumlah Transaksi" v={String(paid.length)} />
              <Stat l="Rata-rata / Transaksi" v={rp(paid.length ? net / paid.length : 0)} />
              <Stat l="Item Terjual" v={String(items.reduce((s, i) => s + Number(i.qty || 0), 0))} />
              <Stat l="Void / Batal" v={String(voids.length)} />
            </TabsContent>
            <TabsContent value="history" className="space-y-2">
              <Input placeholder="Cari no. struk / nama pelanggan" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="divide-y border rounded-xl">
                {filtered.map((t) => (
                  <button key={t.id} className="w-full text-left p-3 flex justify-between gap-2 hover:bg-muted/50" onClick={() => setSel(sel?.id === t.id ? null : t)}>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{t.transaction_number}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('id-ID')} · {t.customer_name || '-'} · {PAY[t.payment_method_1] || t.payment_method_1}</div>
                      {sel?.id === t.id && (
                        <div className="mt-2 text-xs space-y-0.5">
                          {items.filter((i) => i.transaction_id === t.id).map((i, x) => <div key={x}>{i.qty}x {i.product_name} — {rp(i.subtotal_item)}</div>)}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm">{rp(t.total)}</div>
                      <div className={`text-xs ${t.status === 'paid' ? 'text-primary' : 'text-destructive'}`}>{t.status}</div>
                    </div>
                  </button>
                ))}
                {!filtered.length && <div className="p-6 text-center text-sm text-muted-foreground">Belum ada transaksi</div>}
              </div>
            </TabsContent>
            <TabsContent value="menu">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="p-2">Menu</th><th>Kategori</th><th className="text-right">Qty</th><th className="text-right">Omzet</th><th className="text-right p-2">%</th></tr></thead>
                <tbody>{menus.map(([k, v]) => (
                  <tr key={k} className="border-t"><td className="p-2">{k}</td><td>{v.cat}</td><td className="text-right">{v.qty}</td><td className="text-right">{rp(v.amount)}</td><td className="text-right p-2">{((v.amount / menuTotal) * 100).toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </TabsContent>
            <TabsContent value="pay" className="space-y-2">
              {pays.map(([k, v]) => (
                <div key={k} className="rounded-xl border p-3 flex justify-between">
                  <div><div className="font-semibold">{PAY[k] || k}</div><div className="text-xs text-muted-foreground">{v.count} transaksi</div></div>
                  <div className="font-bold">{rp(v.amount)}</div>
                </div>
              ))}
              {!pays.length && <div className="p-6 text-center text-sm text-muted-foreground">Belum ada pembayaran</div>}
            </TabsContent>
          </Tabs>
        )}
      </>
  );
  if (inline) return <div className="space-y-3">{body}</div>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Laporan & Riwayat</DialogTitle></DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
