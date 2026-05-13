import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChefHat, Bell, CheckCircle2, Clock, Utensils } from 'lucide-react';
import { KDSTicket, KDSStatus } from '@/hooks/usePOSKDS';

interface Props {
  ticket: KDSTicket;
  onUpdateStatus: (id: string, status: KDSStatus) => void;
  onToggleItem: (itemId: string, isDone: boolean) => void;
}

const orderTypeLabel: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  zeger_app: 'Zeger App',
  internal: 'Internal',
};

const orderTypeColor: Record<string, string> = {
  dine_in: 'bg-blue-600',
  take_away: 'bg-purple-600',
  gofood: 'bg-green-600',
  grabfood: 'bg-emerald-600',
  shopeefood: 'bg-orange-600',
  zeger_app: 'bg-red-600',
  internal: 'bg-gray-600',
};

export const KDSTicketCard = ({ ticket, onUpdateStatus, onToggleItem }: Props) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const startTime = new Date(ticket.created_at).getTime();
  const elapsedMin = Math.floor((now - startTime) / 60000);
  const isLate = elapsedMin >= 10;
  const isWarning = elapsedMin >= 5 && elapsedMin < 10;

  const cardBorder = isLate
    ? 'border-red-500 border-2 ring-2 ring-red-500/40'
    : isWarning
    ? 'border-yellow-500 border-2'
    : 'border-border';

  return (
    <Card className={`p-3 bg-card text-card-foreground ${cardBorder} flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${orderTypeColor[ticket.order_type || 'take_away']} text-white text-xs`}>
              {orderTypeLabel[ticket.order_type || 'take_away'] || ticket.order_type}
            </Badge>
            {ticket.table_number && (
              <Badge variant="outline" className="text-xs">Meja {ticket.table_number}</Badge>
            )}
          </div>
          <div className="font-bold text-base mt-1 truncate">
            #{ticket.transaction_number || ticket.id.slice(-6)}
          </div>
          {ticket.customer_name && (
            <div className="text-xs text-muted-foreground truncate">{ticket.customer_name}</div>
          )}
          {ticket.external_order_id && (
            <div className="text-xs text-muted-foreground truncate">Order: {ticket.external_order_id}</div>
          )}
        </div>
        <div className={`flex items-center gap-1 text-sm font-mono px-2 py-1 rounded ${isLate ? 'bg-red-500 text-white' : isWarning ? 'bg-yellow-500 text-black' : 'bg-muted'}`}>
          <Clock className="h-3 w-3" />
          {elapsedMin}m
        </div>
      </div>

      <div className="space-y-1 border-t border-b py-2">
        {ticket.items.map((it) => (
          <div key={it.id} className="flex items-start gap-2">
            <Checkbox
              checked={it.is_done}
              onCheckedChange={(v) => onToggleItem(it.id, !!v)}
              className="mt-1"
            />
            <div className={`flex-1 min-w-0 ${it.is_done ? 'line-through opacity-60' : ''}`}>
              <div className="text-sm font-semibold leading-tight">
                <span className="text-primary">{it.qty}x</span> {it.product_name}
              </div>
              {it.notes && (
                <div className="text-xs bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded mt-0.5 inline-block">
                  📝 {it.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {ticket.status === 'queued' && (
          <Button size="sm" className="flex-1" onClick={() => onUpdateStatus(ticket.id, 'cooking')}>
            <ChefHat className="h-4 w-4 mr-1" /> Mulai Masak
          </Button>
        )}
        {ticket.status === 'cooking' && (
          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onUpdateStatus(ticket.id, 'ready')}>
            <Bell className="h-4 w-4 mr-1" /> Siap
          </Button>
        )}
        {ticket.status === 'ready' && (
          <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => onUpdateStatus(ticket.id, 'served')}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Sajikan
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onUpdateStatus(ticket.id, 'cancelled')} title="Batalkan">
          ✕
        </Button>
      </div>
    </Card>
  );
};