import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePOSKDS, KDSStation, stationOf, KDSTicket } from '@/hooks/usePOSKDS';
import { KDSTicketCard } from '@/components/pos/KDSTicketCard';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Volume2, History, RotateCcw, Coffee, Utensils, LayoutGrid } from 'lucide-react';
import { unlockAudio } from '@/lib/audio';

const ONLINE = ['gofood', 'grabfood', 'shopeefood', 'zeger_app'];

const POSKitchen = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const branchId = userProfile?.branch_id || null;
  const { tickets, recent, loading, updateStatus, recallTicket, toggleItemDone } = usePOSKDS(branchId);
  const [filter, setFilter] = useState<'all' | 'dine_in' | 'online'>('all');
  const [station, setStation] = useState<KDSStation>('all');
  const [recallOpen, setRecallOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = tickets;
    if (filter === 'dine_in') list = list.filter((t) => t.order_type === 'dine_in' || t.order_type === 'take_away');
    if (filter === 'online') list = list.filter((t) => ONLINE.includes(t.order_type || ''));
    if (station !== 'all') list = list.filter((t) => t.items.some((i) => stationOf(i.category) === station));
    return list;
  }, [tickets, filter, station]);

  const lateCount = filtered.filter(
    (t) => t.status !== 'ready' && Date.now() - new Date(t.created_at).getTime() >= 600000
  ).length;

  const Column = ({ title, dot, items }: { title: string; dot: string; items: KDSTicket[] }) => (
    <div className="pos-kds-column flex-1 min-w-0 flex flex-col rounded-3xl">
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold tracking-wide">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> {title}
        </span>
        <span className="pos-kds-chip rounded-full px-2.5 text-sm font-bold">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-center pos-kds-muted py-16 text-sm">Tidak ada tiket</div>
        ) : (
          items.map((t) => (
            <KDSTicketCard key={t.id} ticket={t} station={station} onUpdateStatus={updateStatus} onToggleItem={toggleItemDone} />
          ))
        )}
      </div>
    </div>
  );

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button data-active={active} onClick={onClick} className="pos-kds-chip rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-1.5 transition">
      {children}
    </button>
  );

  return (
    <div className="pos-kds-shell h-screen flex flex-col font-sans">
      <div className="pos-kds-bar flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate('/pos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="font-bold text-lg">Kitchen Display</div>
            <div className="text-xs pos-kds-muted">
              {filtered.length} tiket aktif{lateCount > 0 && <span className="text-primary font-semibold"> · {lateCount} terlambat</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={station === 'all'} onClick={() => setStation('all')}><LayoutGrid className="h-4 w-4" />Semua Stasiun</Chip>
          <Chip active={station === 'bar'} onClick={() => setStation('bar')}><Coffee className="h-4 w-4" />Barista</Chip>
          <Chip active={station === 'kitchen'} onClick={() => setStation('kitchen')}><Utensils className="h-4 w-4" />Dapur</Chip>
          <span className="w-px h-6 bg-white/15 mx-1" />
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Semua</Chip>
          <Chip active={filter === 'dine_in'} onClick={() => setFilter('dine_in')}>Dine/Take</Chip>
          <Chip active={filter === 'online'} onClick={() => setFilter('online')}>Online</Chip>
          <span className="w-px h-6 bg-white/15 mx-1" />
          <Chip active={false} onClick={() => setRecallOpen(true)}><History className="h-4 w-4" />Recall</Chip>
          <Chip active={false} onClick={unlockAudio}><Volume2 className="h-4 w-4" /></Chip>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
        </div>
      ) : (
        <div className="flex-1 flex gap-3 p-3 min-h-0">
          <Column title="ANTRI" dot="bg-warning" items={filtered.filter((t) => t.status === 'queued')} />
          <Column title="DIPROSES" dot="bg-primary" items={filtered.filter((t) => t.status === 'cooking')} />
          <Column title="SIAP" dot="bg-success" items={filtered.filter((t) => t.status === 'ready')} />
        </div>
      )}

      <Sheet open={recallOpen} onOpenChange={setRecallOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Recall Tiket (2 jam terakhir)</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[80vh]">
            {recent.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">Belum ada tiket tersaji</div>}
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="font-semibold">#{(t.transaction_number || t.id).slice(-6)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.customer_name || (t.table_number ? `Meja ${t.table_number}` : t.order_type)} ·{' '}
                    {t.served_at && new Date(t.served_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => recallTicket(t.id)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Recall
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default POSKitchen;
