import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChefHat, Bell, CheckCircle2, Clock, X, Coffee, Utensils } from 'lucide-react';
import { KDSTicket, KDSStatus, KDSStation, stationOf } from '@/hooks/usePOSKDS';

interface Props {
  ticket: KDSTicket;
  station?: KDSStation;
  onUpdateStatus: (id: string, status: KDSStatus) => void;
  onToggleItem: (itemId: string, isDone: boolean) => void;
}

const orderTypeLabel: Record<string, string> = {
  dine_in: 'Dine In', take_away: 'Take Away', gofood: 'GoFood', grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood', zeger_app: 'Zeger App', internal: 'Internal',
};

export const KDSTicketCard = ({ ticket, station = 'all', onUpdateStatus, onToggleItem }: Props) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const elapsedMin = Math.floor((now - new Date(ticket.created_at).getTime()) / 60000);
  const sla = ticket.status === 'ready' ? 'ok' : elapsedMin >= 10 ? 'late' : elapsedMin >= 5 ? 'warn' : 'ok';
  const items = station === 'all' ? ticket.items : ticket.items.filter((i) => stationOf(i.category) === station);
  const doneCount = ticket.items.filter((i) => i.is_done).length;

  return (
    <div data-sla={sla} className="pos-kds-ticket rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
            <span className="pos-kds-chip rounded-full px-2.5 py-0.5">
              {orderTypeLabel[ticket.order_type || 'take_away'] || ticket.order_type}
            </span>
            {ticket.table_number && (
              <span className="pos-kds-chip rounded-full px-2.5 py-0.5">Meja {ticket.table_number}</span>
            )}
          </div>
          <div className="font-display font-bold text-xl mt-1.5 truncate">
            #{(ticket.transaction_number || ticket.id).slice(-6)}
          </div>
          {ticket.customer_name && <div className="text-sm pos-kds-muted truncate">{ticket.customer_name}</div>}
          {ticket.external_order_id && <div className="text-xs pos-kds-muted truncate">Order: {ticket.external_order_id}</div>}
        </div>
        <div className={`flex items-center gap-1 text-sm font-mono font-bold px-2.5 py-1 rounded-lg pos-kds-sla-${sla}`}>
          <Clock className="h-3.5 w-3.5" />
          {elapsedMin}m
        </div>
      </div>

      <div className="space-y-2 border-y border-white/10 py-3">
        {items.map((it) => {
          const st = stationOf(it.category);
          return (
            <label key={it.id} className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={it.is_done}
                onCheckedChange={(v) => onToggleItem(it.id, !!v)}
                className="mt-0.5 h-5 w-5 border-white/40"
              />
              <div className={`flex-1 min-w-0 ${it.is_done ? 'line-through opacity-50' : ''}`}>
                <div className="text-base font-semibold leading-tight flex items-center gap-1.5">
                  <span className="text-primary font-bold">{it.qty}×</span>
                  <span className="truncate">{it.product_name}</span>
                  {station === 'all' && (st === 'bar'
                    ? <Coffee className="h-3.5 w-3.5 pos-kds-muted shrink-0" />
                    : <Utensils className="h-3.5 w-3.5 pos-kds-muted shrink-0" />)}
                </div>
                {it.notes && <div className="text-xs pos-kds-note px-2 py-1 rounded-md mt-1 inline-block">{it.notes}</div>}
              </div>
            </label>
          );
        })}
        <div className="text-xs pos-kds-muted">{doneCount}/{ticket.items.length} item selesai</div>
      </div>

      <div className="flex gap-2">
        {ticket.status === 'queued' && (
          <Button size="lg" className="flex-1" onClick={() => onUpdateStatus(ticket.id, 'cooking')}>
            <ChefHat className="h-5 w-5 mr-1" /> Mulai
          </Button>
        )}
        {ticket.status === 'cooking' && (
          <Button size="lg" className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => onUpdateStatus(ticket.id, 'ready')}>
            <Bell className="h-5 w-5 mr-1" /> Siap
          </Button>
        )}
        {ticket.status === 'ready' && (
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => onUpdateStatus(ticket.id, 'served')}>
            <CheckCircle2 className="h-5 w-5 mr-1" /> Sajikan
          </Button>
        )}
        <Button size="lg" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => onUpdateStatus(ticket.id, 'cancelled')} title="Batalkan">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
