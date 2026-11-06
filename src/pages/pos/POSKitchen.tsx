import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePOSKDS, KDSStation, stationOf, KDSTicket } from '@/hooks/usePOSKDS';
import { KDSTicketCard } from '@/components/pos/KDSTicketCard';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Volume2, History, RotateCcw, QrCode, Coffee, Utensils, LayoutGrid } from 'lucide-react';
import { unlockAudio } from '@/lib/audio';

const ONLINE = ['gofood', 'grabfood', 'shopeefood', 'zeger_app'];

const KIOSK_KEY = 'flow_kds_kiosk_token';

const POSKitchen = ({ kiosk = false }: { kiosk?: boolean }) => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const kioskToken = useMemo(() => {
    if (!kiosk) return null;
    const k = params.get('k');
    if (k) { localStorage.setItem(KIOSK_KEY, k); return k; }
    return localStorage.getItem(KIOSK_KEY);
  }, [kiosk, params]);
  const branchId = kiosk ? null : userProfile?.branch_id || null;
  const { tickets, recent, loading, updateStatus, recallTicket, toggleItemDone, kioskBranch, kioskError } = usePOSKDS(branchId, kioskToken);
  const [pairOpen, setPairOpen] = useState(false);
  const [pairToken, setPairToken] = useState<string | null>(null);
  const openPair = async (rotate = false) => {
    if (!userProfile?.branch_id) return toast.error('Akun ini belum terhubung ke cabang');
    const { data, error } = await (supabase as any).rpc('kds_pairing_token', { _branch_id: userProfile.branch_id, _rotate: rotate });
    if (error) return toast.error(error.message);
    setPairToken(data); setPairOpen(true);
    if (rotate) toast.success('QR baru dibuat. Tablet lama harus scan ulang.');
  };
  const pairUrl = pairToken ? `${window.location.origin}/kds?k=${pairToken}` : '';
  const [filter, setFilter] = useState<'all' | 'dine_in' | 'online'>('all');
  const [station, setStation] = useState<KDSStation>('all');
  const [recallOpen, setRecallOpen] = useState(false);
  const [mTab, setMTab] = useState<'queued' | 'cooking' | 'ready'>('queued');

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
    <button data-active={active} onClick={onClick} className="pos-kds-chip rounded-full px-4 min-h-11 text-sm font-semibold flex items-center gap-1.5 transition">
      {children}
    </button>
  );

  if (kiosk && (!kioskToken || kioskError)) {
    return (
      <div className="pos-kds-shell h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <QrCode className="h-16 w-16 text-primary" />
        <div className="text-2xl font-bold">Hubungkan Layar Dapur</div>
        <p className="pos-kds-muted max-w-md">{kioskError || 'Buka Kitchen Display di POS kasir, tekan tombol "QR Tablet Dapur", lalu scan QR-nya dengan kamera tablet ini.'}</p>
      </div>
    );
  }

  return (
    <div className="pos-kds-shell h-[100dvh] flex flex-col font-sans">
      <div className="pos-kds-bar flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3">
        <div className="flex items-center gap-3">
          {!kiosk && (
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate('/pos')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <div className="font-bold text-lg">Kitchen Display{kioskBranch?.name ? ` · ${kioskBranch.name}` : ''}</div>
            <div className="text-xs pos-kds-muted">
              {filtered.length} tiket aktif{lateCount > 0 && <span className="text-primary font-semibold"> · {lateCount} terlambat</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto md:flex-wrap -mx-1 px-1 pb-1 md:pb-0 [&>*]:shrink-0">
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
          {!kiosk && <Chip active={false} onClick={() => openPair()}><QrCode className="h-4 w-4" />QR Tablet Dapur</Chip>}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
        </div>
      ) : (
        <>
        <div className="md:hidden grid grid-cols-3 gap-2 px-3 pt-3">
          {([['queued','Antri','bg-warning'],['cooking','Diproses','bg-primary'],['ready','Siap','bg-success']] as const).map(([k,l,d]) => (
            <button key={k} data-active={mTab===k} onClick={() => setMTab(k)} className="pos-kds-chip rounded-2xl min-h-14 font-bold flex items-center justify-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${d}`} />{l}
              <span className="rounded-full bg-white/15 px-2 text-sm">{filtered.filter((t) => t.status === k).length}</span>
            </button>
          ))}
        </div>
        <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {filtered.filter((t) => t.status === mTab).length === 0
            ? <div className="text-center pos-kds-muted py-16">Tidak ada tiket</div>
            : filtered.filter((t) => t.status === mTab).map((t) => (
              <KDSTicketCard key={t.id} ticket={t} station={station} onUpdateStatus={updateStatus} onToggleItem={toggleItemDone} />
            ))}
        </div>
        <div className="hidden md:flex flex-1 gap-3 p-3 min-h-0">
          <Column title="ANTRI" dot="bg-warning" items={filtered.filter((t) => t.status === 'queued')} />
          <Column title="DIPROSES" dot="bg-primary" items={filtered.filter((t) => t.status === 'cooking')} />
          <Column title="SIAP" dot="bg-success" items={filtered.filter((t) => t.status === 'ready')} />
        </div>
        </>
      )}

      <Sheet open={recallOpen} onOpenChange={setRecallOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Recall Tiket (2 jam terakhir)</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[80vh]">
            {recent.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">Belum ada tiket tersaji</div>}
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="font-semibold">#{t.queue_number ? String(t.queue_number).padStart(3, '0') : (t.transaction_number || t.id).slice(-6)}</div>
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

      <Dialog open={pairOpen} onOpenChange={setPairOpen}>
        <DialogContent className="w-[94vw] md:w-[80vw] max-w-none max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Hubungkan Tablet Dapur</DialogTitle></DialogHeader>
          <div className="flex flex-col md:flex-row items-center gap-6 py-2">
            {pairUrl && <div className="bg-background p-4 rounded-2xl border"><QRCodeSVG value={pairUrl} size={260} /></div>}
            <div className="space-y-3 text-sm">
              <p>1. Buka kamera tablet dapur, lalu scan QR ini.</p>
              <p>2. Tablet langsung membuka Kitchen Display cabang ini, tanpa login dan tanpa akses kasir.</p>
              <p>3. Tablet tetap terhubung walau dimatikan atau di-refresh.</p>
              <p className="text-muted-foreground">Jika tablet hilang atau ganti perangkat, tekan "Buat QR Baru" agar tablet lama terputus.</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(pairUrl); toast.success('Link disalin'); }}>Salin Link</Button>
                <Button variant="destructive" onClick={() => openPair(true)}>Buat QR Baru</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSKitchen;
