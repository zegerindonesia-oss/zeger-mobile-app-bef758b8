import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Printer, Lock, RefreshCw, CalendarDays, LayoutDashboard, CreditCard, ListOrdered, Layers, ShoppingBag, Wallet, History, ArrowLeft, ChevronRight, Search,
} from 'lucide-react';
import { usePOSShift } from '@/hooks/usePOSShift';
import { supabase } from '@/integrations/supabase/client';
import { buildShiftReport, printShiftReport, loadPrintSettings, rp, jkt, type ShiftReportPrint } from '@/lib/pos-printing';
import { cn } from '@/lib/utils';

const METHOD: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer Bank', debit: 'Kartu Debit', credit: 'Kartu Kredit', edc: 'EDC', gofood: 'GoFood', grabfood: 'GrabFood', shopeefood: 'ShopeeFood', gopay: 'GoPay', shopeepay: 'ShopeePay', ovo: 'OVO', dana: 'DANA' };
const TYPE: Record<string, string> = { dine_in: 'Dine In', take_away: 'Take Away', takeaway: 'Take Away', delivery: 'Delivery', gofood: 'GoFood', grabfood: 'GrabFood', shopeefood: 'ShopeeFood', zeger_app: 'Zeger App' };
const lbl = (m: string, map: Record<string, string>) => map[m] || m.replace(/_/g, ' ').toUpperCase();

type Tab = 'recap' | 'payment' | 'detail' | 'menu' | 'type' | 'drawer' | 'history';
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'recap', label: 'Rekapitulasi Penjualan', icon: LayoutDashboard },
  { id: 'payment', label: 'Metode Pembayaran', icon: CreditCard },
  { id: 'detail', label: 'Rincian Penjualan', icon: ListOrdered },
  { id: 'menu', label: 'Penjualan per Brand & Menu', icon: Layers },
  { id: 'type', label: 'Tipe Pesanan', icon: ShoppingBag },
  { id: 'drawer', label: 'Kas Laci & Tutup Shift', icon: Wallet },
  { id: 'history', label: 'Riwayat Shift', icon: History },
];

const Line = ({ l, v, strong, tone }: { l: string; v: string; strong?: boolean; tone?: 'neg' | 'pos' }) => (
  <div className={cn('flex justify-between items-center gap-3 px-4 md:px-5 py-3.5 border-b last:border-b-0 text-[15px]', strong && 'bg-primary/5 font-bold')}>
    <span className={cn(!strong && 'text-foreground/80')}>{l}</span>
    <span className={cn('tabular-nums font-semibold', tone === 'neg' && 'text-destructive', tone === 'pos' && 'text-success')}>{v}</span>
  </div>
);
const Panel = ({ children }: { children: React.ReactNode }) => <div className="rounded-2xl border bg-card overflow-hidden">{children}</div>;
const TotalBar = ({ cells }: { cells: string[] }) => (
  <div className="mt-3 rounded-2xl bg-primary text-primary-foreground px-5 py-4 flex justify-between font-bold tabular-nums">
    {cells.map((c, i) => <span key={i}>{c}</span>)}
  </div>
);

const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return now;
};

/** Full shift recap (ESB-style sections) for the running shift (X) or a closed one (Z), plus shift history. */
export const POSShiftPage = ({ branchId, branchName, kasirName }: { branchId: string | null; branchName: string; kasirName: string }) => {
  const { activeShift, closeShift } = usePOSShift();
  const [r, setR] = useState<ShiftReportPrint | null>(null);
  const [viewShift, setViewShift] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>('recap');
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useClock();

  const target = viewShift || activeShift;
  const load = () => {
    if (!target) { setR(null); return; }
    setR(null);
    buildShiftReport(target, { kind: target.status === 'closed' || target.closed_at ? 'Z' : 'X', branch_name: branchName, kasir_name: target.cashier_name || kasirName }).then(setR);
  };
  useEffect(load, [target?.id]); // eslint-disable-line

  const print = async (rep: ShiftReportPrint) => printShiftReport(await loadPrintSettings(branchId), { ...rep, printed_at: new Date().toISOString() });

  const close = async () => {
    if (counted === '') return toast.error('Isi jumlah uang fisik di laci');
    if (!window.confirm('Tutup shift sekarang? Data shift akan dikunci.')) return;
    setBusy(true);
    try {
      const closed = await closeShift(Number(counted), notes);
      const z = await buildShiftReport(closed, { kind: 'Z', branch_name: branchName, kasir_name: kasirName });
      toast.success('Shift ditutup — mencetak Z-Report');
      await print(z);
      setViewShift(closed); setR(z);
    } catch (e: any) { toast.error(e.message || 'Gagal menutup shift'); }
    setBusy(false);
  };

  const isZ = r?.kind === 'Z';
  const diff = counted === '' || !r ? null : Number(counted) - r.expected_cash;
  const cashSales = r?.payments.find((p) => p.method === 'cash')?.amount || 0;
  const brands = useMemo(() => {
    const g: Record<string, { name: string; qty: number; amount: number; category?: string }[]> = {};
    (r?.products || []).forEach((p) => { (g[p.brand || 'Lainnya'] ??= []).push(p); });
    return Object.entries(g).sort((a, b) => b[1].reduce((s, x) => s + x.amount, 0) - a[1].reduce((s, x) => s + x.amount, 0));
  }, [r]);

  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-primary text-primary-foreground p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-primary/20">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider opacity-80">{viewShift ? 'Detail Shift' : isZ ? 'Z-Report · Shift Ditutup' : 'Ganti Shift / Hari'}</div>
          <div className="text-lg md:text-xl font-bold truncate">{branchName} · {r?.kasir_name || kasirName}</div>
          {r && <div className="text-xs opacity-90">Shift {r.shift_type} · buka {jkt(r.opened_at)}{r.closed_at ? ` · tutup ${jkt(r.closed_at)}` : ' · sedang berlangsung'}</div>}
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-primary-foreground/15 px-4 py-2">
          <CalendarDays className="h-5 w-5" />
          <div className="leading-tight"><div className="font-semibold text-sm capitalize">{dateStr}</div><div className="text-xs opacity-90">{timeStr} WIB</div></div>
        </div>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-4 items-start">
        {/* Left nav */}
        <div className="space-y-2">
          {viewShift && activeShift?.id !== viewShift.id && (
            <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => { setViewShift(null); setTab('recap'); }}><ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke shift aktif</Button>
          )}
          {r && <div className="grid grid-cols-2 gap-2">
            {!isZ && <Button variant="outline" className="h-11 rounded-xl" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>}
            <Button variant="outline" className={cn('h-11 rounded-xl', isZ && 'col-span-2')} onClick={() => print(r)}><Printer className="h-4 w-4 mr-1" />Cetak {r.kind}</Button>
          </div>}
          <nav className="flex md:flex-col gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('shrink-0 md:w-full flex items-center gap-3 rounded-xl px-4 h-12 text-sm font-semibold text-left transition border',
                  tab === t.id ? 'bg-primary text-primary-foreground border-primary shadow' : 'bg-card hover:border-primary/40')}>
                <t.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="min-w-0">
          {tab === 'history' ? <ShiftHistory branchId={branchId} onOpen={(s) => { setViewShift(s); setTab('recap'); }} />
            : !target ? <div className="py-16 text-center text-muted-foreground rounded-2xl border bg-card">Tidak ada shift aktif. Buka tab Riwayat Shift untuk melihat shift sebelumnya.</div>
            : !r ? <div className="py-16 text-center text-muted-foreground rounded-2xl border bg-card">Menghitung rekap...</div>
            : <>
              {tab === 'recap' && <div className="space-y-3">
                <h2 className="text-lg font-bold">Rekapitulasi Penjualan</h2>
                <Panel>
                  <Line l="Penjualan Kotor" v={rp(r.gross)} />
                  <Line l="Total Diskon" v={`-${rp(r.discount)}`} tone="neg" />
                  <Line l="Penjualan Bersih" v={rp(r.gross - r.discount)} strong />
                  <Line l="Service Charge" v={rp(r.service)} />
                  <Line l="Pajak (PB1)" v={rp(r.tax)} />
                  <Line l="Grand Total" v={rp(r.net)} strong />
                </Panel>
                <Panel>
                  <Line l="Jumlah Transaksi" v={String(r.tx_count)} />
                  <Line l="Rata-rata / Transaksi" v={rp(r.tx_count ? r.net / r.tx_count : 0)} />
                  <Line l="Item Terjual" v={String((r.products || []).reduce((s, p) => s + p.qty, 0))} />
                  <Line l="Transaksi Dibatalkan (Void)" v={String(r.void_count)} />
                </Panel>
              </div>}

              {tab === 'payment' && <div>
                <h2 className="text-lg font-bold mb-3">Penjualan Berdasarkan Metode Pembayaran</h2>
                <Panel>
                  <div className="grid grid-cols-[1fr_80px_140px] px-5 py-3 text-xs font-bold uppercase text-muted-foreground border-b"><span>Metode</span><span className="text-right">Trx</span><span className="text-right">Nominal</span></div>
                  {r.payments.length ? r.payments.map((p) => (
                    <div key={p.method} className="grid grid-cols-[1fr_80px_140px] px-5 py-3.5 border-b last:border-b-0 text-[15px]"><span>{lbl(p.method, METHOD)}</span><span className="text-right tabular-nums">{p.count}</span><span className="text-right font-semibold tabular-nums">{rp(p.amount)}</span></div>
                  )) : <div className="p-5 text-muted-foreground">Belum ada pembayaran</div>}
                </Panel>
                <TotalBar cells={['TOTAL', String(r.payments.reduce((s, p) => s + p.count, 0)), rp(r.payments.reduce((s, p) => s + p.amount, 0))]} />
              </div>}

              {tab === 'detail' && <div>
                <h2 className="text-lg font-bold mb-3">Rincian Penjualan</h2>
                <Panel>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[15px]">
                      <thead className="text-xs uppercase text-muted-foreground"><tr className="border-b"><th className="text-left px-5 py-3">Menu</th><th className="text-right px-3">Jumlah</th><th className="text-right px-5">Subtotal</th></tr></thead>
                      <tbody>{(r.products || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((p, i) => (
                        <tr key={p.name} className={cn('border-b last:border-b-0', i % 2 === 0 && 'bg-primary/[0.03]')}><td className="px-5 py-3">{p.name}</td><td className="text-right px-3 tabular-nums">{p.qty}</td><td className="text-right px-5 font-semibold tabular-nums">{rp(p.amount)}</td></tr>
                      ))}</tbody>
                    </table>
                    {!(r.products || []).length && <div className="p-5 text-muted-foreground">Belum ada penjualan</div>}
                  </div>
                </Panel>
                <TotalBar cells={['TOTAL', `${(r.products || []).reduce((s, p) => s + p.qty, 0)} item`, rp((r.products || []).reduce((s, p) => s + p.amount, 0))]} />
              </div>}

              {tab === 'menu' && <div className="space-y-3">
                <h2 className="text-lg font-bold">Penjualan Berdasarkan Brand & Menu</h2>
                {brands.length ? brands.map(([brand, items]) => {
                  const cats: Record<string, typeof items> = {};
                  items.forEach((p) => { (cats[p.category || 'Lainnya'] ??= []).push(p); });
                  return (
                    <Panel key={brand}>
                      <div className="grid grid-cols-[1fr_70px_120px] px-5 py-3 bg-primary/10 font-bold"><span>{brand}</span><span className="text-right text-xs uppercase self-center">Qty</span><span className="text-right text-xs uppercase self-center">Subtotal</span></div>
                      {Object.entries(cats).map(([cat, ps]) => (
                        <div key={cat} className="px-5 py-2">
                          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground py-1">{cat}</div>
                          {ps.map((p) => <div key={p.name} className="grid grid-cols-[1fr_70px_120px] py-1.5 text-[15px]"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{p.name}</span><span className="text-right tabular-nums">{p.qty}</span><span className="text-right tabular-nums">{rp(p.amount)}</span></div>)}
                        </div>
                      ))}
                      <div className="grid grid-cols-[1fr_70px_120px] px-5 py-3 border-t font-bold text-primary"><span>TOTAL {brand}</span><span className="text-right tabular-nums">{items.reduce((s, p) => s + p.qty, 0)}</span><span className="text-right tabular-nums">{rp(items.reduce((s, p) => s + p.amount, 0))}</span></div>
                    </Panel>
                  );
                }) : <Panel><div className="p-5 text-muted-foreground">Belum ada penjualan</div></Panel>}
              </div>}

              {tab === 'type' && <div>
                <h2 className="text-lg font-bold mb-3">Penjualan Berdasarkan Tipe Pesanan</h2>
                <Panel>
                  {(r.order_types || []).length ? r.order_types!.map((t) => <Line key={t.type} l={`${lbl(t.type, TYPE)} (${t.count})`} v={rp(t.amount)} />) : <div className="p-5 text-muted-foreground">Belum ada penjualan</div>}
                </Panel>
                <TotalBar cells={['TOTAL', rp((r.order_types || []).reduce((s, t) => s + t.amount, 0))]} />
              </div>}

              {tab === 'drawer' && <div className="space-y-3">
                <h2 className="text-lg font-bold">Kas Laci</h2>
                <Panel>
                  <Line l="Modal Awal" v={rp(r.opening_cash)} />
                  <Line l="Penjualan Tunai" v={rp(cashSales)} />
                  <Line l="Kas Masuk" v={rp(r.cash_in)} />
                  <Line l="Kas Keluar" v={`-${rp(r.cash_out)}`} tone="neg" />
                  <Line l="Uang Seharusnya di Laci" v={rp(r.expected_cash)} strong />
                  {isZ && r.closing_cash != null && <>
                    <Line l="Fisik Dihitung Kasir" v={rp(r.closing_cash)} />
                    <Line l="Selisih" v={`${(r.difference || 0) >= 0 ? '+' : ''}${rp(r.difference || 0)}`} strong tone={(r.difference || 0) < 0 ? 'neg' : 'pos'} />
                  </>}
                </Panel>
                {!isZ && !viewShift && (
                  <div className="rounded-2xl border-2 border-destructive/30 bg-card p-4 space-y-3">
                    <div className="font-bold flex items-center gap-2"><Lock className="h-4 w-4 text-destructive" /> Tutup Shift</div>
                    <div className="space-y-3">
                      <Input type="text" inputMode="numeric" placeholder="Uang fisik di laci (Rp)" value={counted ? Number(counted).toLocaleString('id-ID') : ''} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} className="h-16 text-2xl font-bold text-center" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => setCounted(String(Math.round(r.expected_cash)))}>Sesuai sistem</Button>
                        <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setCounted('')}>Hapus</Button>
                      </div>
                      <div className={cn('rounded-xl p-3 text-center text-lg font-bold', diff == null ? 'bg-muted text-muted-foreground' : diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                        {diff == null ? 'Selisih: -' : `Selisih: ${diff >= 0 ? '+' : ''}${rp(diff)}`}
                      </div>
                      <Input placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12 text-base" />
                    </div>
                    <Button variant="destructive" className="h-14 text-base w-full" disabled={busy} onClick={close}>{busy ? 'Memproses...' : 'Tutup Shift & Cetak Z-Report'}</Button>
                  </div>
                )}
              </div>}
            </>}
        </div>
      </div>
    </div>
  );
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dt = (s: string) => new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Detail Rekapitulasi: list of past shifts with opening/closing cash and variance. */
const ShiftHistory = ({ branchId, onOpen }: { branchId: string | null; onOpen: (s: any) => void }) => {
  const today = new Date();
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(ymd(today));
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    if (!branchId) return;
    setRows(null);
    (supabase as any).from('pos_shifts').select('*').eq('branch_id', branchId)
      .gte('opened_at', `${from}T00:00:00+07:00`).lte('opened_at', `${to}T23:59:59+07:00`)
      .order('opened_at', { ascending: false }).limit(200)
      .then(({ data }: any) => setRows(data || []));
  }, [branchId, from, to]);
  const list = (rows || []).filter((s) => !q || (s.cashier_name || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Detail Rekapitulasi Shift</h2>
      <div className="flex flex-wrap gap-2">
        {([['Hari Ini', 0], ['Kemarin', 1], ['Bulan Ini', -1]] as const).map(([l, n]) => (
          <Button key={l} variant="outline" size="sm" className="rounded-xl" onClick={() => {
            const d = new Date();
            if (n === -1) { setFrom(ymd(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(ymd(d)); }
            else { d.setDate(d.getDate() - n); setFrom(ymd(d)); setTo(ymd(d)); }
          }}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground self-center">Klik baris shift untuk melihat rekap lengkap, termasuk rincian menu per brand.</span>
      </div>
      <div className="grid sm:grid-cols-[auto_auto_1fr] gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl" />
        <div className="relative"><Search className="h-4 w-4 absolute left-3 top-3.5 text-muted-foreground" /><Input placeholder="Cari nama kasir" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 rounded-xl pl-9" /></div>
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr className="border-b">
              {['Shift Awal', 'Kasir', 'Kas Awal', 'Shift Akhir', 'Penjualan', 'Kas Seharusnya', 'Kas Akhir', 'Selisih', ''].map((h) => <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((s, i) => {
                const open = !s.closed_at;
                const d = Number(s.cash_difference || 0);
                return (
                  <tr key={s.id} onClick={() => onOpen(s)} className={cn('border-b last:border-b-0 cursor-pointer hover:bg-primary/5', i % 2 === 0 && 'bg-primary/[0.03]')}>
                    <td className="px-3 py-3 whitespace-nowrap font-semibold text-primary">{dt(s.opened_at)}</td>
                    <td className="px-3">{s.cashier_name || '-'}</td>
                    <td className="px-3 tabular-nums">{rp(s.opening_cash)}</td>
                    <td className="px-3 whitespace-nowrap">{open ? <span className="font-semibold text-warning">Sedang berlangsung</span> : dt(s.closed_at)}</td>
                    <td className="px-3 tabular-nums">{open ? '-' : rp(s.total_sales)}</td>
                    <td className="px-3 tabular-nums">{open ? '-' : rp(s.expected_cash || 0)}</td>
                    <td className="px-3 tabular-nums">{open ? '-' : rp(s.closing_cash || 0)}</td>
                    <td className={cn('px-3 tabular-nums font-semibold', !open && d < 0 && 'text-destructive', !open && d > 0 && 'text-success')}>{open ? '-' : `${d > 0 ? '+' : ''}${rp(d)}`}</td>
                    <td className="px-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows === null ? <div className="p-5 text-muted-foreground">Memuat...</div> : !list.length && <div className="p-5 text-muted-foreground">Tidak ada shift di rentang ini</div>}
        </div>
      </Panel>
      <p className="text-xs text-muted-foreground">Catatan: shift yang ditutup sebelum perbaikan ini mungkin menyimpan selisih kas yang keliru; buka detailnya untuk melihat hitungan yang sudah diperbaiki.</p>
    </div>
  );
};
