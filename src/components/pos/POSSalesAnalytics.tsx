import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Trophy, Wallet, ClipboardList, ShoppingBasket, Package } from 'lucide-react';

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const k = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--muted-foreground))', 'hsl(var(--primary) / 0.55)', 'hsl(var(--success) / 0.55)', 'hsl(var(--warning) / 0.55)', 'hsl(var(--foreground) / 0.35)'];
const PAY: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', edc: 'EDC', debit: 'Debit', credit: 'Kredit', card: 'Kartu' };
const MODE: Record<string, string> = { dine_in: 'Dine In', take_away: 'Take Away', takeaway: 'Take Away', delivery: 'Delivery', gofood: 'GoFood', grabfood: 'GrabFood', shopeefood: 'ShopeeFood', zeger_app: 'Zeger App' };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface AnalyticsTx { id: string; total: number; created_at: string; order_type?: string | null; payment_method_1?: string | null; amount_1?: number; payment_method_2?: string | null; amount_2?: number; change_amount?: number }
export interface AnalyticsItem { transaction_id?: string; product_id?: string | null; product_name: string; qty: number; subtotal_item: number }

type Row = { name: string; value: number; count: number };
const toRows = (m: Record<string, { v: number; n: number }>): Row[] => Object.entries(m).map(([name, x]) => ({ name, value: x.v, count: x.n })).sort((a, b) => b.value - a.value);

/** Shared sales analytics (cards, daily trend, brand/payment/mode pies, top 5, peak hours) for POS and Back Office. */
export function POSSalesAnalytics({ txs, items, brandOf, from, to }: { txs: AnalyticsTx[]; items: AnalyticsItem[]; brandOf: Map<string, string>; from: string; to: string }) {
  const sales = txs.reduce((s, t) => s + Number(t.total || 0), 0);
  const qty = items.reduce((s, i) => s + Number(i.qty || 0), 0);

  const daily = useMemo(() => {
    const m: Record<string, { omzet: number; order: number }> = {};
    const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`);
    for (let d = new Date(a); d <= b && Object.keys(m).length < 400; d.setDate(d.getDate() + 1)) m[ymd(d)] = { omzet: 0, order: 0 };
    txs.forEach((t) => { const key = ymd(new Date(t.created_at)); (m[key] ??= { omzet: 0, order: 0 }); m[key].omzet += Number(t.total || 0); m[key].order += 1; });
    return Object.entries(m).sort(([x], [y]) => x.localeCompare(y)).map(([d, v]) => ({ tgl: `${d.slice(8)}/${d.slice(5, 7)}`, ...v }));
  }, [txs, from, to]);

  const hourly = useMemo(() => {
    const h = Array.from({ length: 24 }, (_, i) => ({ jam: String(i).padStart(2, '0'), omzet: 0, order: 0 }));
    txs.forEach((t) => { const x = h[new Date(t.created_at).getHours()]; x.omzet += Number(t.total || 0); x.order += 1; });
    let first = h.findIndex((x) => x.order), last = 23 - [...h].reverse().findIndex((x) => x.order);
    if (first < 0) { first = 6; last = 22; }
    return h.slice(Math.max(0, first - 1), Math.min(24, last + 2));
  }, [txs]);
  const peak = hourly.reduce((p, x) => (x.order > (p?.order || 0) ? x : p), null as null | { jam: string; order: number; omzet: number });

  const brands = useMemo(() => { const m: Record<string, { v: number; n: number }> = {}; items.forEach((i) => { const b = (i.product_id && brandOf.get(i.product_id)) || 'Tanpa Brand'; m[b] ??= { v: 0, n: 0 }; m[b].v += Number(i.subtotal_item || 0); m[b].n += Number(i.qty || 0); }); return toRows(m); }, [items, brandOf]);
  const pays = useMemo(() => { const m: Record<string, { v: number; n: number }> = {}; const add = (key: string | null | undefined, v: number) => { if (!key) return; const l = PAY[key] || key.toUpperCase(); m[l] ??= { v: 0, n: 0 }; m[l].v += v; m[l].n += 1; }; txs.forEach((t) => { if (t.payment_method_2) { add(t.payment_method_1, Number(t.amount_1 || 0)); add(t.payment_method_2, Number(t.amount_2 || 0)); } else add(t.payment_method_1, Number(t.total || 0)); }); return toRows(m); }, [txs]);
  const modes = useMemo(() => { const m: Record<string, { v: number; n: number }> = {}; txs.forEach((t) => { const l = MODE[t.order_type || ''] || (t.order_type || '-'); m[l] ??= { v: 0, n: 0 }; m[l].v += Number(t.total || 0); m[l].n += 1; }); return toRows(m); }, [txs]);
  const top = useMemo(() => { const m: Record<string, { v: number; n: number }> = {}; items.forEach((i) => { const n = i.product_name || 'Item'; m[n] ??= { v: 0, n: 0 }; m[n].n += Number(i.qty || 0); m[n].v += Number(i.subtotal_item || 0); }); return Object.entries(m).map(([name, x]) => ({ name, qty: x.n, value: x.v })).sort((a, b) => b.qty - a.qty).slice(0, 5); }, [items]);

  const cards = [
    { label: 'Total Penjualan', value: rp(sales), icon: Wallet },
    { label: 'Jumlah Transaksi', value: String(txs.length), icon: ClipboardList },
    { label: 'Rata-rata / Transaksi', value: rp(txs.length ? sales / txs.length : 0), icon: ShoppingBasket },
    { label: 'Item Terjual', value: String(qty), icon: Package },
  ];

  const PieBlock = ({ title, rows, unit }: { title: string; rows: Row[]; unit: string }) => {
    const tot = rows.reduce((s, r) => s + r.value, 0) || 1;
    return (
      <section className="pos-panel rounded-2xl p-4">
        <h2 className="font-bold mb-2">{title}</h2>
        {rows.length ? <>
          <div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>{rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => rp(v)} /></PieChart></ResponsiveContainer></div>
          <table className="w-full text-sm mt-2"><thead><tr className="text-xs text-muted-foreground"><th className="text-left py-1">Nama</th><th className="text-right">{unit}</th><th className="text-right">Omzet</th><th className="text-right">%</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={r.name} className="border-t"><td className="py-1.5"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />{r.name}</span></td><td className="text-right tabular-nums">{r.count}</td><td className="text-right tabular-nums font-semibold">{rp(r.value)}</td><td className="text-right tabular-nums">{((r.value / tot) * 100).toFixed(1)}</td></tr>)}</tbody></table>
        </> : <p className="text-sm text-muted-foreground py-10 text-center">Belum ada data</p>}
      </section>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-raised rounded-2xl px-4 py-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><c.icon className="h-5 w-5" /></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{c.label}</div><div className="text-lg md:text-2xl font-bold truncate tabular-nums">{c.value}</div></div>
          </div>
        ))}
      </div>

      <section className="pos-panel rounded-2xl p-4">
        <h2 className="font-bold mb-3">Grafik Penjualan per Hari</h2>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily}>
            <defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="tgl" fontSize={11} /><YAxis fontSize={11} tickFormatter={k} width={44} />
            <Tooltip formatter={(v: number, n) => (n === 'omzet' ? rp(v) : `${v} transaksi`)} />
            <Area type="monotone" dataKey="omzet" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gd)" dot={daily.length <= 31} />
          </AreaChart>
        </ResponsiveContainer></div>
      </section>

      <div className="grid lg:grid-cols-3 gap-3">
        <PieBlock title="Penjualan per Brand" rows={brands} unit="Qty" />
        <PieBlock title="Metode Pembayaran" rows={pays} unit="Trx" />
        <PieBlock title="Mode Transaksi" rows={modes} unit="Trx" />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-3">
        <section className="pos-panel rounded-2xl p-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> 5 Menu Terlaris</h2>
          {top.length ? <div className="space-y-2.5">{top.map((t, i) => (
            <div key={t.name}>
              <div className="flex justify-between text-sm"><span className="font-semibold truncate">#{i + 1} {t.name}</span><span className="tabular-nums shrink-0 ml-2">{t.qty} · {rp(t.value)}</span></div>
              <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(t.qty / top[0].qty) * 100}%` }} /></div>
            </div>))}</div> : <p className="text-sm text-muted-foreground">Belum ada data</p>}
        </section>
        <section className="pos-panel rounded-2xl p-4">
          <h2 className="font-bold">Analisa Jam Ramai</h2>
          <p className="text-xs text-muted-foreground mb-2">{peak ? `Paling ramai jam ${peak.jam}:00–${String(Number(peak.jam) + 1).padStart(2, '0')}:00 · ${peak.order} transaksi · ${rp(peak.omzet)}` : 'Belum ada data'}</p>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="jam" fontSize={11} /><YAxis fontSize={11} width={30} allowDecimals={false} />
              <Tooltip formatter={(v: number, n) => (n === 'omzet' ? rp(v) : `${v} transaksi`)} labelFormatter={(l) => `Jam ${l}:00`} />
              <Bar dataKey="order" radius={[6, 6, 0, 0]}>{hourly.map((h) => <Cell key={h.jam} fill={peak && h.jam === peak.jam ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.35)'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </section>
      </div>
    </div>
  );
}

export type Period = 'today' | 'yesterday' | 'month' | 'custom';
export const periodRange = (p: Period, from: string, to: string): [string, string] => {
  const n = new Date();
  if (p === 'today') return [ymd(n), ymd(n)];
  if (p === 'yesterday') { const y = new Date(n); y.setDate(y.getDate() - 1); return [ymd(y), ymd(y)]; }
  if (p === 'month') return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(n)];
  return [from, to];
};
export { ymd as toYmd };
