import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, ClipboardList, Users, ShoppingBasket } from 'lucide-react';

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');

/** Today's (Asia/Jakarta local) POS metrics for the branch. Refreshes when `refreshKey` changes. */
export const POSStatsBar = ({ branchId, refreshKey }: { branchId: string | null; refreshKey: number }) => {
  const [s, setS] = useState({ sales: 0, orders: 0, members: 0 });

  useEffect(() => {
    if (!branchId) return;
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    supabase
      .from('pos_transactions')
      .select('total, member_id, status')
      .eq('branch_id', branchId)
      .gte('created_at', start)
      .eq('status', 'paid')
      .then(({ data }) => {
        const rows = data || [];
        setS({
          sales: rows.reduce((a, r: any) => a + Number(r.total || 0), 0),
          orders: rows.length,
          members: new Set(rows.map((r: any) => r.member_id).filter(Boolean)).size,
        });
      });
  }, [branchId, refreshKey]);

  const cards = [
    { label: 'Penjualan Hari Ini', value: rp(s.sales), icon: Wallet },
    { label: 'Pesanan', value: s.orders.toString(), icon: ClipboardList },
    { label: 'Member Dilayani', value: s.members.toString(), icon: Users },
    { label: 'Rata-rata Order', value: rp(s.orders ? s.sales / s.orders : 0), icon: ShoppingBasket },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="glass-raised rounded-2xl p-3.5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <c.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-xl font-bold tracking-tight truncate">{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
