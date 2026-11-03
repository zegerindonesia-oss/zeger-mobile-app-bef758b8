import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Receipt, Printer, ChefHat, Sticker, MessageCircle, FileDown, RotateCcw, Undo2,
  Loader2, X, Utensils, ShoppingBag, Bike, Store, ChevronRight, CalendarDays, User, Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { POSPageShell } from '@/components/pos/POSPageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  loadPrintSettings, printReceipt, printKitchen, printStickersOnly, printHtml, renderReceipt,
  type PrintSettings, type ReceiptPrint, type PrintItem,
} from '@/lib/pos-printing';

const rp = (n: number) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PAY: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', edc: 'EDC', debit: 'Debit', card: 'Kartu', shopeepay: 'ShopeePay', gopay: 'GoPay', ovo: 'OVO', dana: 'DANA' };
const payLabel = (k?: string | null) => (k ? PAY[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-');
const typeKind = (t: string) => {
  const s = (t || '').toLowerCase();
  if (s.includes('dine')) return 'dine';
  if (s.includes('take') || s.includes('pick')) return 'take';
  if (s.includes('deliv') || s.includes('food') || s.includes('grab') || s.includes('gojek') || s.includes('shopee')) return 'delivery';
  return 'other';
};
const TYPE_ICON: Record<string, any> = { dine: Utensils, take: ShoppingBag, delivery: Bike, other: Store };
const timeFmt = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isVoid = (s: string) => s === 'void' || s === 'voided';

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className={cn('h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap border transition-all active:scale-95 flex items-center gap-1.5',
      active ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-foreground/80 border-border hover:border-primary/40')}>
    {children}
  </button>
);

export default function POSTransactionsPage() {
  return (
    <POSPageShell title="Riwayat Transaksi">
      {({ branchId, branchName }) => <TxHistory branchId={branchId} branchName={branchName} />}
    </POSPageShell>
  );
}

function TxHistory({ branchId, branchName }: { branchId: string | null; branchName: string }) {
  const navigate = useNavigate();
  const [range, setRange] = useState<'today' | 'yesterday' | '7d' | 'custom'>('today');
  const [from, setFrom] = useState(ymd(new Date()));
  const [to, setTo] = useState(ymd(new Date()));
  const [txs, setTxs] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [pay, setPay] = useState('all');
  const [kind, setKind] = useState('all');
  const [sel, setSel] = useState<any | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!branchId) return;
    (async () => {
      setLoading(true);
      const now = new Date(); let a = from, b = to;
      if (range === 'today') a = b = ymd(now);
      if (range === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); a = b = ymd(y); }
      if (range === '7d') { const y = new Date(now); y.setDate(y.getDate() - 6); a = ymd(y); b = ymd(now); }
      let rows: any[] = [];
      for (let i = 0; ; i += 1000) {
        const { data } = await (supabase as any).from('pos_transactions').select('*').eq('branch_id', branchId)
          .gte('created_at', `${a}T00:00:00+07:00`).lte('created_at', `${b}T23:59:59+07:00`)
          .order('created_at', { ascending: false }).range(i, i + 999);
        rows = rows.concat(data || []);
        if (!data || data.length < 1000) break;
      }
      setTxs(rows);
      const ids = rows.map((r) => r.id); const c: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await (supabase as any).from('pos_transaction_items').select('transaction_id,qty').in('transaction_id', ids.slice(i, i + 200));
        (data || []).forEach((it: any) => { c[it.transaction_id] = (c[it.transaction_id] || 0) + Number(it.qty || 0); });
      }
      setCounts(c);
      setLoading(false);
    })();
  }, [branchId, range, from, to, reload]);

  const methods = useMemo(() => Array.from(new Set(txs.flatMap((t) => [t.payment_method_1, t.payment_method_2]).filter(Boolean))), [txs]);
  const list = txs.filter((t) =>
    (pay === 'all' || t.payment_method_1 === pay || t.payment_method_2 === pay) &&
    (kind === 'all' || typeKind(t.order_type) === kind) &&
    (!q || `${t.transaction_number} ${t.customer_name || ''} ${t.cashier_name || ''}`.toLowerCase().includes(q.toLowerCase())));
  const paid = list.filter((t) => !isVoid(t.status));
  const total = paid.reduce((s, t) => s + Number(t.total || 0), 0);

  const detail = sel && (
    <TxDetail key={sel.id} tx={sel} branchId={branchId} branchName={branchName} onClose={() => setSel(null)}
      onVoided={() => { setSel(null); setReload((r) => r + 1); }}
      onReorder={(items) => { sessionStorage.setItem('pos_reorder', JSON.stringify(items)); navigate('/pos'); }} />
  );

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2">
          {[['Penjualan', rp(total)], ['Transaksi', String(paid.length)], ['Dibatalkan', String(list.length - paid.length)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{l}</div>
              <div className="text-lg md:text-xl font-bold tabular-nums truncate">{v}</div>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. struk, nama pelanggan, atau kasir…" className="h-12 pl-12 rounded-2xl text-base" />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none items-center">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          {([['today', 'Hari Ini'], ['yesterday', 'Kemarin'], ['7d', '7 Hari'], ['custom', 'Pilih Tanggal']] as const).map(([k, l]) => (
            <Chip key={k} active={range === k} onClick={() => setRange(k)}>{l}</Chip>
          ))}
          {range === 'custom' && <>
            <Input type="date" className="h-10 w-auto rounded-full" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" className="h-10 w-auto rounded-full" value={to} onChange={(e) => setTo(e.target.value)} />
          </>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <Chip active={pay === 'all'} onClick={() => setPay('all')}>Semua Bayar</Chip>
          {methods.map((m) => <Chip key={m} active={pay === m} onClick={() => setPay(m)}>{payLabel(m)}</Chip>)}
          <span className="w-px bg-border mx-1 shrink-0" />
          {([['all', 'Semua Tipe', Store], ['dine', 'Dine-in', Utensils], ['take', 'Take Away', ShoppingBag], ['delivery', 'Delivery', Bike]] as const).map(([k, l, I]) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}><I className="h-4 w-4" />{l}</Chip>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {loading ? <div className="py-16 grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            : !list.length ? (
              <div className="py-16 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />Belum ada transaksi di periode ini
              </div>
            ) : list.map((t) => {
              const K = TYPE_ICON[typeKind(t.order_type)]; const v = isVoid(t.status); const active = sel?.id === t.id;
              return (
                <button key={t.id} onClick={() => setSel(t)}
                  className={cn('w-full text-left rounded-2xl border bg-card p-3 md:p-4 flex items-center gap-3 transition-all active:scale-[0.99] hover:border-primary/40 hover:shadow-md',
                    active && 'border-primary ring-2 ring-primary/20', v && 'opacity-60')}>
                  <span className={cn('h-12 w-12 rounded-xl grid place-items-center shrink-0', v ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                    <K className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-bold text-base tabular-nums', v && 'line-through')}>{rp(t.total)}</span>
                      {v && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Dibatalkan</span>}
                    </div>
                    <div className="text-sm text-foreground/80 truncate">{payLabel(t.payment_method_1)}{t.payment_method_2 ? ` + ${payLabel(t.payment_method_2)}` : ''} · {t.customer_name || 'Pelanggan umum'}</div>
                    <div className="text-xs text-muted-foreground">{timeFmt(t.created_at)} · {counts[t.id] || 0} item</div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] font-mono px-2 py-1 rounded-lg bg-muted text-muted-foreground">{t.transaction_number}</span>
                    <span className="text-[11px] text-muted-foreground capitalize">{t.order_type?.replace(/_/g, ' ')}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
        </div>
      </div>

      {/* Desktop: side panel; mobile: bottom sheet */}
      <aside className={cn('hidden lg:flex w-[440px] shrink-0 rounded-2xl border bg-card overflow-hidden flex-col', !sel && 'items-center justify-center text-muted-foreground')}>
        {sel ? detail : <div className="text-center p-8"><Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Pilih transaksi untuk melihat detail,<br />cetak ulang, atau kirim struk.</p></div>}
      </aside>
      <Sheet open={!!sel && typeof window !== 'undefined' && window.innerWidth < 1024} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="bottom" className="p-0 h-[92dvh] rounded-t-3xl flex flex-col [&>button]:hidden">{detail}</SheetContent>
      </Sheet>
    </div>
  );
}

function TxDetail({ tx, branchId, branchName, onClose, onVoided, onReorder }: {
  tx: any; branchId: string | null; branchName: string; onClose: () => void; onVoided: () => void; onReorder: (items: any[]) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');
  const v = isVoid(tx.status);

  useEffect(() => {
    (supabase as any).from('pos_transaction_items').select('*').eq('transaction_id', tx.id).order('created_at').then(({ data }: any) => setItems(data || []));
    loadPrintSettings(branchId).then(setSettings);
  }, [tx.id, branchId]);

  const printItems: PrintItem[] = items.map((i) => ({ product_id: i.product_id, product_name: i.product_name + (i.size ? ` (${i.size})` : ''), category: i.category, qty: Number(i.qty), price: Number(i.price), subtotal: Number(i.subtotal_item), notes: i.notes || undefined }));
  const receipt: ReceiptPrint = {
    transaction_number: tx.transaction_number, branch_name: branchName, kasir_name: tx.cashier_name || '-', created_at: tx.created_at,
    order_type: tx.order_type, table_number: tx.table_number, customer_name: tx.customer_name, items: printItems, queue_number: tx.queue_number ?? null,
    subtotal: Number(tx.subtotal), discount: Number(tx.discount_item || 0) + Number(tx.discount_bill || 0), service_charge: Number(tx.service_charge || 0), tax: Number(tx.tax || 0), total: Number(tx.total),
    payment_method_1: tx.payment_method_1 || 'cash', amount_1: Number(tx.amount_1 || 0), payment_method_2: tx.payment_method_2, amount_2: Number(tx.amount_2 || 0), change_amount: Number(tx.change_amount || 0),
  };
  const kitchen = { ref: tx.transaction_number, order_type: tx.order_type, table_number: tx.table_number, customer_name: tx.customer_name, created_at: tx.created_at, items: printItems };

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    if (!settings) return toast.error('Pengaturan printer belum dimuat');
    setBusy(key);
    try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e?.message || 'Gagal'); } finally { setBusy(null); }
  };
  const text = [
    `*${branchName}*`, `Struk ${tx.transaction_number}`, timeFmt(tx.created_at), tx.customer_name ? `Pelanggan: ${tx.customer_name}` : '', '',
    ...items.map((i) => `${i.qty}x ${i.product_name}${i.size ? ` (${i.size})` : ''}  ${rp(i.subtotal_item)}`), '',
    receipt.discount ? `Diskon: -${rp(receipt.discount)}` : '', `*Total: ${rp(tx.total)}*`, `Bayar: ${payLabel(tx.payment_method_1)}`, '', 'Terima kasih 🙏',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  const sendWa = () => {
    let n = phone.replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1);
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, '_blank');
  };
  const doVoid = async () => {
    setBusy('void');
    const { error } = await (supabase as any).rpc('void_pos_transaction', { _tx: tx.id, _reason: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Transaksi dibatalkan'); setVoidOpen(false); onVoided();
  };
  const reorder = () => onReorder(items.map((i) => ({ product_id: i.product_id, product_code: i.product_code || '', product_name: i.product_name, category: i.category, price: Number(i.price), qty: Number(i.qty), notes: i.notes || '' })));

  const actions = [
    { k: 'receipt', l: 'Cetak Struk', I: Printer, f: () => run('receipt', () => printReceipt(settings!, receipt, false), 'Struk dikirim ke printer') },
    { k: 'kot', l: 'Cetak Dapur', I: ChefHat, f: () => run('kot', () => printKitchen(settings!, kitchen, false), 'Tiket dapur dicetak') },
    { k: 'sticker', l: 'Cetak Stiker', I: Sticker, f: () => run('sticker', () => printStickersOnly(settings!, kitchen), 'Stiker dicetak') },
    { k: 'pdf', l: 'Simpan PDF', I: FileDown, f: () => run('pdf', () => printHtml(renderReceipt(receipt, settings!, '80')), 'Pilih "Simpan sebagai PDF"') },
    { k: 'again', l: 'Pesan Lagi', I: RotateCcw, f: reorder },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="px-5 pt-5 pb-4 border-b bg-gradient-to-b from-primary/10 to-transparent">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-[11px] font-mono px-2 py-1 rounded-lg bg-card border">{tx.transaction_number}</span>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary capitalize">{tx.order_type?.replace(/_/g, ' ')}</span>
              {tx.table_number && <span className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-muted">Meja {tx.table_number}</span>}
              {v && <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-destructive/10 text-destructive">DIBATALKAN</span>}
            </div>
            <div className={cn('text-3xl font-bold tabular-nums', v && 'line-through text-muted-foreground')}>{rp(tx.total)}</div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>{timeFmt(tx.created_at)}</span>
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{tx.cashier_name || '-'}</span>
              {tx.customer_name && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{tx.customer_name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="pos-raised-control h-9 w-9 rounded-xl grid place-items-center shrink-0"><X className="h-4 w-4" /></button>
        </div>
        {v && tx.void_reason && <div className="mt-3 text-xs rounded-xl bg-destructive/10 text-destructive px-3 py-2">Alasan: {tx.void_reason}</div>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Item ({items.reduce((s, i) => s + Number(i.qty), 0)})</h3>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex gap-3 items-start">
                <span className="h-9 min-w-9 px-2 rounded-lg bg-primary/10 text-primary font-bold text-sm grid place-items-center">{i.qty}×</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight">{i.product_name}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {i.size && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground">{i.size}</span>}
                    <span className="text-[11px] text-muted-foreground">@ {rp(i.price)}</span>
                  </div>
                  {i.notes && <div className="text-[11px] text-muted-foreground italic mt-0.5">"{i.notes}"</div>}
                </div>
                <span className="font-semibold text-sm tabular-nums">{rp(i.subtotal_item)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-muted/50 p-4 space-y-1.5 text-sm">
          {[['Subtotal', rp(tx.subtotal)], receipt.discount ? ['Diskon', `-${rp(receipt.discount)}`] : null, receipt.service_charge ? ['Service', rp(receipt.service_charge)] : null, receipt.tax ? ['Pajak', rp(receipt.tax)] : null]
            .filter(Boolean).map(([l, val]: any) => <div key={l} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{val}</span></div>)}
          <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border"><span>Total</span><span className="tabular-nums">{rp(tx.total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{payLabel(tx.payment_method_1)}</span><span className="tabular-nums">{rp(tx.amount_1)}</span></div>
          {tx.payment_method_2 && <div className="flex justify-between"><span className="text-muted-foreground">{payLabel(tx.payment_method_2)}</span><span className="tabular-nums">{rp(tx.amount_2)}</span></div>}
          {Number(tx.change_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Kembali</span><span className="tabular-nums">{rp(tx.change_amount)}</span></div>}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kirim Struk WhatsApp</h3>
          <div className="flex gap-2">
            <Input inputMode="tel" placeholder="08xx (kosongkan untuk pilih kontak)" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl" />
            <Button onClick={sendWa} className="h-12 rounded-xl px-5 gap-2"><MessageCircle className="h-4 w-4" />Kirim</Button>
          </div>
        </section>
      </div>

      <div className="border-t p-4 bg-card">
        <div className="grid grid-cols-3 gap-2">
          {actions.map(({ k, l, I, f }) => (
            <button key={k} onClick={f} disabled={!!busy || !items.length}
              className="h-[72px] rounded-2xl border bg-background flex flex-col items-center justify-center gap-1 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all disabled:opacity-50">
              {busy === k ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <I className="h-5 w-5 text-primary" />}{l}
            </button>
          ))}
          <button onClick={() => setVoidOpen(true)} disabled={v || !!busy}
            className="h-[72px] rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive flex flex-col items-center justify-center gap-1 text-xs font-semibold hover:bg-destructive/10 active:scale-95 transition-all disabled:opacity-40">
            <Undo2 className="h-5 w-5" />Void / Refund
          </button>
        </div>
      </div>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan transaksi {tx.transaction_number}?</DialogTitle>
            <DialogDescription>Total {rp(tx.total)} akan dikeluarkan dari laporan penjualan. Tindakan ini tercatat atas nama Anda.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {['Salah input', 'Pelanggan batal', 'Pesanan double', 'Refund pelanggan'].map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>
            ))}
          </div>
          <Textarea placeholder="Alasan pembatalan (wajib)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Batal</Button>
            <Button variant="destructive" disabled={!reason.trim() || busy === 'void'} onClick={doVoid}>
              {busy === 'void' && <Loader2 className="h-4 w-4 animate-spin" />}Ya, Batalkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
