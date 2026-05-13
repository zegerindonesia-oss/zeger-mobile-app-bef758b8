import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Globe, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { POSOnlineOrderForm } from './POSOnlineOrderForm';

interface OnlineOrder {
  id: string;
  transaction_number: string;
  order_type: string;
  external_order_id: string | null;
  customer_name: string | null;
  total: number;
  status: string;
  kitchen_status: string | null;
  payment_method_1: string | null;
  created_at: string;
}

interface Props {
  branchId: string | null;
  shiftId: string | null;
}

const platformLabel: Record<string, string> = {
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  zeger_app: 'Zeger',
};

const platformColor: Record<string, string> = {
  gofood: 'bg-green-600',
  grabfood: 'bg-emerald-600',
  shopeefood: 'bg-orange-600',
  zeger_app: 'bg-red-600',
};

export const POSOnlineOrderPanel = ({ branchId, shiftId }: Props) => {
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [count, setCount] = useState(0);

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    const { data } = await supabase
      .from('pos_transactions')
      .select('id, transaction_number, order_type, external_order_id, customer_name, total, status, kitchen_status, payment_method_1, created_at')
      .eq('branch_id', branchId)
      .in('order_type', ['gofood', 'grabfood', 'shopeefood', 'zeger_app'])
      .in('status', ['preparing', 'paid'])
      .order('created_at', { ascending: false })
      .limit(50);
    const list = (data || []) as OnlineOrder[];
    const active = list.filter((o) => o.kitchen_status !== 'served');
    setOrders(list);
    setCount(active.length);
  }, [branchId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!branchId) return;
    const ch = supabase
      .channel(`online_orders_${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_transactions', filter: `branch_id=eq.${branchId}` },
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pos_kds_tickets', filter: `branch_id=eq.${branchId}` },
        () => fetchOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branchId, fetchOrders]);

  const markPaid = async (id: string) => {
    await supabase.from('pos_transactions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    toast.success('Order ditandai dibayar');
    fetchOrders();
  };

  const cancel = async (id: string) => {
    if (!confirm('Batalkan order ini?')) return;
    await supabase.from('pos_transactions').update({ status: 'cancelled' }).eq('id', id);
    await supabase.from('pos_kds_tickets').update({ status: 'cancelled' }).eq('transaction_id', id);
    toast.success('Order dibatalkan');
    fetchOrders();
  };

  const elapsed = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return `${m}m`;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" variant="outline" className="relative">
            <Globe className="h-3 w-3 mr-1" /> Online
            {count > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 bg-red-600">{count}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[480px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Order Online ({count})</span>
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Baru
              </Button>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-4 space-y-2">
            {orders.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">Belum ada order online</div>
            ) : (
              orders.map((o) => (
                <Card key={o.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={`${platformColor[o.order_type]} text-white text-xs`}>
                          {platformLabel[o.order_type]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {o.kitchen_status === 'ready' ? '✓ Siap' : o.kitchen_status === 'preparing' ? '👨‍🍳 Dimasak' : 'Antri'}
                        </Badge>
                      </div>
                      <div className="font-bold text-sm mt-1">#{o.transaction_number}</div>
                      {o.external_order_id && <div className="text-xs text-muted-foreground">Platform: {o.external_order_id}</div>}
                      {o.customer_name && <div className="text-xs text-muted-foreground">{o.customer_name}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">Rp{Number(o.total).toLocaleString('id-ID')}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" /> {elapsed(o.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {o.status === 'preparing' && (
                      <Button size="sm" className="flex-1" onClick={() => markPaid(o.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Selesai & Bayar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => cancel(o.id)}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <POSOnlineOrderForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={fetchOrders}
        branchId={branchId}
        shiftId={shiftId}
      />
    </>
  );
};