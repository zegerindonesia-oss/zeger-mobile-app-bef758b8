import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, ShoppingCart, Wallet, ClipboardList, Users, ShoppingBasket, Trophy, RefreshCw, Settings } from 'lucide-react';

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const PIE = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning, 38 92% 50%))', 'hsl(var(--muted-foreground))'];

interface Tx { id: string; total: number; member_id: string | null; created_at: string; payment_method_1: string | null; amount_1: number; payment_method_2: string | null; amount_2: number; order_type: string }

/** Cashier dashboard: today's (Jakarta local) sales analytics for the cashier's branch. */
const POSDashboard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const branchId = userProfile?.branch_id;
  const [tx, setTx] = useState<Tx[]>([]);
  const [top, setTop] = useState<{ name: string; qty: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!branchId) return;
    setLoading(true);
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const rows: Tx[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('pos_transactions')
        .select('id,total,member_id,created_at,payment_method_1,amount_1,payment_method_2,amount_2,order_type')
        .eq('branch_id', branchId).eq('status', 'paid').gte('created_at', start)
        .order('created_at').range(from, from + 999);
      rows.push(...((data || []) as Tx[]));
      if (!data || data.length < 1000) break;
    }
    setTx(rows);
    const ids = rows.map((r) => r.id);
    const agg: Record<string, { name: string; qty: number; total: number }> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from('pos_transaction_items').select('product_name,qty,subtotal_item').in('transaction_id', ids.slice(i, i + 200));
      (data || []).forEach((it: any) => {
        const a = (agg[it.product_name] ||= { name: it.product_name, qty: 0, total: 0 });
        a.qty += Number(it.qty || 0); a.total += Number(it.subtotal_item || 0);
      });
    }
    setTop(Object.values(agg).sort((a, b) => b.qty - a.qty).slice(0, 5));
    setLoading(false);
  };
  useEffect(() => { load(); }, [branchId]);

  const sales = tx.reduce((a, r) => a + Number(r.total || 0), 0);
  const members = new Set(tx.map((r) => r.member_id).filter(Boolean)).size;

  const hourly = useMemo(() => {
    const h = Array.from({ length: 17 }, (_, i) => ({ jam: `${String(i + 6).padStart(2, '0')}`, omzet: 0, order: 0 }));
    tx.forEach((r) => {
      const idx = new Date(r.created_at).getHours() - 6;
      if (h[idx]) { h[idx].omzet += Number(r.total || 0); h[idx].order += 1; }
    });
    return h;
  }, [tx]);

  const methods = useMemo(() => {
    const m: Record<string, number> = {};
    tx.forEach((r) => {
      if (r.payment_method_1) m[r.payment_method_1] = (m[r.payment_method_1] || 0) + Number(r.amount_1 || (r.payment_method_2 ? 0 : r.total));
      if (r.payment_method_2) m[r.payment_method_2] = (m[r.payment_method_2] || 0) + Number(r.amount_2 || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [tx]);

  const cards = [
    { label: 'Penjualan Hari Ini', value: rp(sales), icon: Wallet },
    { label: 'Jumlah Pesanan', value: String(tx.length), icon: ClipboardList },
    { label: 'Member Dilayani', value: String(members), icon: Users },
    { label: 'Rata-rata / Order', value: rp(tx.length ? sales / tx.length : 0), icon: ShoppingBasket },
  ];

  return (
    <div className="min-h-[100dvh] pos-canvas pos-touch p-3 md:p-5 space-y-4">
      <header className="pos-command-header rounded-2xl px-3 md:px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/pos')} className="pos-raised-control h-11 w-11 rounded-xl flex items-center justify-center" title="Kembali"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-bold">Dashboard Kasir</h1>
          <p className="text-xs text-muted-foreground">Ringkasan hari ini · {new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={load} className="pos-raised-control h-11 w-11 rounded-xl flex items-center justify-center" title="Muat ulang"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <button onClick={() => navigate('/pos/settings')} className="pos-raised-control h-11 w-11 rounded-xl hidden sm:flex items-center justify-center" title="Pengaturan"><Settings className="h-4 w-4" /></button>
        <button onClick={() => navigate('/pos')} className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-2 shadow-lg shadow-primary/25">
          <ShoppingCart className="h-4 w-4" /> <span className="hidden sm:inline">Mulai Transaksi</span>
        </button>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-raised rounded-2xl px-4 py-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><c.icon className="h-5 w-5" /></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{c.label}</div><div className="pos-number text-lg md:text-2xl font-bold truncate">{c.value}</div></div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <section className="pos-panel rounded-2xl p-4 lg:col-span-2">
          <h2 className="font-bold mb-3">Omzet per Jam</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="jam" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} />
                <Tooltip formatter={(v: number, n) => (n === 'omzet' ? rp(v) : v)} labelFormatter={(l) => `Jam ${l}:00`} />
                <Area type="monotone" dataKey="omzet" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="pos-panel rounded-2xl p-4">
          <h2 className="font-bold mb-3">Metode Pembayaran</h2>
          {methods.length ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={methods} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={3}>
                    {methods.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie><Tooltip formatter={(v: number) => rp(v)} /></PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 mt-2">
                {methods.map((m, i) => (
                  <li key={m.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />{m.name}</span>
                    <span className="pos-number font-semibold">{rp(m.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-muted-foreground py-10 text-center">Belum ada pembayaran hari ini</p>}
        </section>
      </div>

      <section className="pos-panel rounded-2xl p-4">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Menu Terlaris Hari Ini</h2>
        {top.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {top.map((t, i) => (
              <div key={t.name} className="glass-raised rounded-xl p-3">
                <div className="text-xs text-muted-foreground">#{i + 1}</div>
                <div className="font-semibold truncate">{t.name}</div>
                <div className="text-sm"><span className="pos-number font-bold">{t.qty}</span> terjual · {rp(t.total)}</div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Belum ada data penjualan.</p>}
      </section>
    </div>
  );
};

export default POSDashboard;
