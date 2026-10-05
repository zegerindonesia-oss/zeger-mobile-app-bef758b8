import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { playAlertBeep, unlockAudio } from '@/lib/audio';
import { ChefHat, BellRing, Maximize, Volume2 } from 'lucide-react';

interface Ticket {
  id: string;
  status: string;
  order_type: string | null;
  table_number: string | null;
  customer_name: string | null;
  transaction_number: string | null;
  created_at: string;
  ready_at: string | null;
}

/** Short, easy-to-call number shown on the TV. */
const queueNo = (t: Ticket) => {
  if (t.table_number) return `M${t.table_number}`;
  const digits = (t.transaction_number || t.id).replace(/\D/g, '');
  return digits.slice(-3).padStart(3, '0');
};

const speak = (text: string) => {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* speech not supported */ }
};

const POSQueueDisplay = () => {
  const { userProfile } = useAuth();
  const branchId = userProfile?.branch_id;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [branchName, setBranchName] = useState('');
  const [now, setNow] = useState(new Date());
  const [soundOn, setSoundOn] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const readyIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data } = await (supabase as any)
      .from('pos_kds_tickets')
      .select('id,status,order_type,table_number,customer_name,transaction_number,created_at,ready_at')
      .eq('branch_id', branchId)
      .in('status', ['queued', 'cooking', 'ready'])
      .gte('created_at', since)
      .order('created_at');
    const list = (data || []) as Ticket[];
    const ready = list.filter((t) => t.status === 'ready');
    if (readyIds.current) {
      const fresh = ready.filter((t) => !readyIds.current!.has(t.id));
      if (fresh.length) {
        const t = fresh[fresh.length - 1];
        setHighlight(t.id);
        setTimeout(() => setHighlight(null), 8000);
        if (soundOn) {
          playAlertBeep();
          const no = queueNo(t);
          const spoken = no.startsWith('M') ? `meja ${no.slice(1)}` : `nomor ${no.split('').join(' ')}`;
          setTimeout(() => speak(`Pesanan ${spoken}${t.customer_name ? `, atas nama ${t.customer_name}` : ''}, silakan diambil.`), 600);
        }
      }
    }
    readyIds.current = new Set(ready.map((t) => t.id));
    setTickets(list);
  }, [branchId, soundOn]);

  useEffect(() => {
    load();
    if (!branchId) return;
    const ch = supabase
      .channel(`queue_${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_kds_tickets', filter: `branch_id=eq.${branchId}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [branchId, load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!branchId) return;
    supabase.from('branches').select('name').eq('id', branchId).maybeSingle().then(({ data }) => setBranchName(data?.name || ''));
  }, [branchId]);

  const preparing = tickets.filter((t) => t.status !== 'ready');
  const ready = tickets.filter((t) => t.status === 'ready').slice().reverse();

  const enable = () => {
    unlockAudio();
    speak('Layar antrean aktif');
    setSoundOn(true);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none">
      <header className="flex items-center justify-between px-8 py-4 bg-primary text-primary-foreground">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">ZEGER</h1>
          <p className="text-sm opacity-80">{branchName}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums">{now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm opacity-80">{now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-5">
        <section className="col-span-2 flex flex-col border-r p-6 min-h-0">
          <h2 className="flex items-center gap-3 text-2xl font-bold text-muted-foreground mb-4"><ChefHat className="h-8 w-8" /> Sedang Disiapkan</h2>
          <div className="grid grid-cols-3 gap-3 content-start overflow-hidden">
            {preparing.map((t) => (
              <div key={t.id} className="rounded-2xl border-2 bg-card py-5 text-center shadow-sm">
                <p className="text-4xl font-extrabold tabular-nums">{queueNo(t)}</p>
                {t.customer_name && <p className="text-sm text-muted-foreground truncate px-2">{t.customer_name}</p>}
              </div>
            ))}
            {!preparing.length && <p className="col-span-3 text-muted-foreground text-lg">Tidak ada antrean</p>}
          </div>
        </section>

        <section className="col-span-3 flex flex-col p-6 bg-success/5 min-h-0">
          <h2 className="flex items-center gap-3 text-2xl font-bold text-success mb-4"><BellRing className="h-8 w-8" /> Siap Diambil</h2>
          <div className="grid grid-cols-3 gap-4 content-start overflow-hidden">
            {ready.map((t) => (
              <div key={t.id} className={`rounded-3xl bg-success text-success-foreground py-8 text-center shadow-lg transition ${highlight === t.id ? 'animate-pulse scale-105 ring-8 ring-success/30' : ''}`}>
                <p className="text-6xl font-black tabular-nums">{queueNo(t)}</p>
                {t.customer_name && <p className="text-lg font-medium truncate px-3">{t.customer_name}</p>}
              </div>
            ))}
            {!ready.length && <p className="col-span-3 text-muted-foreground text-lg">Belum ada pesanan siap</p>}
          </div>
        </section>
      </div>

      <footer className="px-8 py-3 border-t flex items-center justify-between text-sm text-muted-foreground">
        <span>Terima kasih telah menunggu ☕ Silakan ambil pesanan saat nomor Anda muncul di kolom hijau.</span>
        {!soundOn ? (
          <button onClick={enable} className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 font-medium">
            <Maximize className="h-4 w-4" /> Aktifkan Suara & Layar Penuh
          </button>
        ) : (
          <span className="flex items-center gap-1 text-success"><Volume2 className="h-4 w-4" /> Suara aktif</span>
        )}
      </footer>
    </div>
  );
};

export default POSQueueDisplay;
