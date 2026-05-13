import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePOSKDS, KDSStatus } from '@/hooks/usePOSKDS';
import { KDSTicketCard } from '@/components/pos/KDSTicketCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { ArrowLeft, Volume2, Filter } from 'lucide-react';
import { unlockAudio } from '@/lib/audio';

const POSKitchen = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const branchId = userProfile?.branch_id || null;
  const { tickets, loading, updateStatus, toggleItemDone } = usePOSKDS(branchId);
  const [filter, setFilter] = useState<'all' | 'dine_in' | 'online'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return tickets;
    if (filter === 'dine_in')
      return tickets.filter((t) => t.order_type === 'dine_in' || t.order_type === 'take_away');
    return tickets.filter((t) => ['gofood', 'grabfood', 'shopeefood', 'zeger_app'].includes(t.order_type || ''));
  }, [tickets, filter]);

  const queued = filtered.filter((t) => t.status === 'queued');
  const cooking = filtered.filter((t) => t.status === 'cooking');
  const ready = filtered.filter((t) => t.status === 'ready');

  const Column = ({ title, color, items }: { title: string; color: string; items: typeof tickets }) => (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className={`px-3 py-2 rounded-t-md ${color} text-white flex items-center justify-between`}>
        <span className="font-bold text-base">{title}</span>
        <Badge variant="secondary" className="text-foreground">{items.length}</Badge>
      </div>
      <div className="flex-1 overflow-y-auto bg-muted/30 p-2 rounded-b-md space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Tidak ada</div>
        ) : (
          items.map((t) => (
            <KDSTicketCard
              key={t.id}
              ticket={t}
              onUpdateStatus={updateStatus}
              onToggleItem={toggleItemDone}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b px-4 py-2 bg-card">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => navigate('/pos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ZegerLogo size="sm" className="text-primary" />
          <div>
            <div className="font-bold text-lg">Kitchen Display</div>
            <div className="text-xs text-muted-foreground">{tickets.length} tiket aktif</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
            Semua
          </Button>
          <Button size="sm" variant={filter === 'dine_in' ? 'default' : 'outline'} onClick={() => setFilter('dine_in')}>
            Dine/Take
          </Button>
          <Button size="sm" variant={filter === 'online' ? 'default' : 'outline'} onClick={() => setFilter('online')}>
            Online
          </Button>
          <Button size="sm" variant="outline" onClick={unlockAudio} title="Aktifkan suara">
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
        </div>
      ) : (
        <div className="flex-1 flex gap-2 p-2 min-h-0">
          <Column title="ANTRI" color="bg-orange-600" items={queued} />
          <Column title="DIMASAK" color="bg-blue-600" items={cooking} />
          <Column title="SIAP" color="bg-green-600" items={ready} />
        </div>
      )}
    </div>
  );
};

export default POSKitchen;