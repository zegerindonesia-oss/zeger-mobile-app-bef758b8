import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, ShoppingCart, RefreshCw, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POSSalesAnalytics, periodRange, toYmd, type Period, type AnalyticsTx, type AnalyticsItem } from '@/components/pos/POSSalesAnalytics';

/** Cashier dashboard: sales analytics for the cashier's branch over a chosen period (default today). */
const POSDashboard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const branchId = userProfile?.branch_id;
  const [period, setPeriod] = useState<Period>('today');
  const [cFrom, setCFrom] = useState(toYmd(new Date()));
  const [cTo, setCTo] = useState(toYmd(new Date()));
  const [from, to] = periodRange(period, cFrom, cTo);
  const [tx, setTx] = useState<AnalyticsTx[]>([]);
  const [items, setItems] = useState<AnalyticsItem[]>([]);
  const [brandOf, setBrandOf] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('products').select('id,brand').then(({ data }) => setBrandOf(new Map((data || []).map((p: any) => [p.id, p.brand || 'Tanpa Brand']))));
  }, []);

  const load = async () => {
    if (!branchId) return;
    setLoading(true);
    const rows: AnalyticsTx[] = [];
    for (let i = 0; ; i += 1000) {
      const { data } = await (supabase as any).from('pos_transactions')
        .select('id,total,created_at,payment_method_1,amount_1,payment_method_2,amount_2,order_type,void_at')
        .eq('branch_id', branchId).eq('status', 'paid').is('void_at', null)
        .gte('created_at', `${from}T00:00:00+07:00`).lte('created_at', `${to}T23:59:59+07:00`)
        .order('created_at').range(i, i + 999);
      rows.push(...((data || []) as AnalyticsTx[]));
      if (!data || data.length < 1000) break;
    }
    const ids = rows.map((r) => r.id);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
    const res = await Promise.all(chunks.map((c) => supabase.from('pos_transaction_items').select('transaction_id,product_id,product_name,qty,subtotal_item').in('transaction_id', c)));
    setTx(rows);
    setItems(res.flatMap((r) => (r.data || []) as AnalyticsItem[]));
    setLoading(false);
  };
  useEffect(() => { load(); }, [branchId, from, to]); // eslint-disable-line

  return (
    <div className="min-h-[100dvh] pos-canvas pos-touch p-3 md:p-5 space-y-4">
      <header className="pos-command-header rounded-2xl px-3 md:px-5 py-3 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/pos')} className="pos-raised-control h-11 w-11 rounded-xl flex items-center justify-center" title="Kembali"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-[140px]">
          <h1 className="text-lg md:text-xl font-bold">Dashboard Kasir</h1>
          <p className="text-xs text-muted-foreground">{from === to ? new Date(`${from}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `${from} s/d ${to}`}</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40 h-11 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="yesterday">Kemarin</SelectItem>
            <SelectItem value="month">Bulan Ini</SelectItem>
            <SelectItem value="custom">Custom Tanggal</SelectItem>
          </SelectContent>
        </Select>
        {period === 'custom' && <div className="flex items-center gap-2">
          <Input type="date" className="h-11 w-auto rounded-xl" value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
          <span className="text-sm text-muted-foreground">s/d</span>
          <Input type="date" className="h-11 w-auto rounded-xl" value={cTo} onChange={(e) => setCTo(e.target.value)} />
        </div>}
        <button onClick={load} className="pos-raised-control h-11 w-11 rounded-xl flex items-center justify-center" title="Muat ulang"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <button onClick={() => navigate('/pos/settings')} className="pos-raised-control h-11 w-11 rounded-xl hidden sm:flex items-center justify-center" title="Pengaturan"><Settings className="h-4 w-4" /></button>
        <button onClick={() => navigate('/pos')} className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-2 shadow-lg shadow-primary/25">
          <ShoppingCart className="h-4 w-4" /> <span className="hidden sm:inline">Mulai Transaksi</span>
        </button>
      </header>
      <POSSalesAnalytics txs={tx} items={items} brandOf={brandOf} from={from} to={to} />
    </div>
  );
};

export default POSDashboard;
