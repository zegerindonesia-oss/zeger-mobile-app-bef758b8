import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { playAlertBeep, unlockAudio } from '@/lib/audio';
import { ChefHat, BellRing, Maximize, Volume2, ArrowLeft } from 'lucide-react';

interface Ticket {
  id: string;
  status: string;
  table_number: string | null;
  customer_name: string | null;
  transaction_number: string | null;
  created_at: string;
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

const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1];

const PromoVideo = ({ url }: { url: string | null }) => {
  if (!url) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <p className="text-6xl font-black tracking-tight">ZEGER</p>
        <p className="mt-2 text-lg opacity-80">Happiness in every cup ☕</p>
      </div>
    );
  }
  const yt = youtubeId(url);
  if (yt) {
    return (
      <iframe
        className="h-full w-full pointer-events-none"
        src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&modestbranding=1&rel=0`}
        allow="autoplay; encrypted-media"
        title="Promo"
      />
    );
  }
  return <video className="h-full w-full object-cover" src={url} autoPlay muted loop playsInline />;
};

/**
 * TV queue screen. Works logged-in (cashier's branch) or as a paired TV via
 * `/tv?branch=<id>` using the public read-only queue feed (no login on the TV).
 */
const POSQueueDisplay = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paired = params.get('branch');
  const branchId = paired || localStorage.getItem('flow_tv_branch') || userProfile?.branch_id || null;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [branchName, setBranchName] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [runningText, setRunningText] = useState('');
  const [now, setNow] = useState(new Date());
  const [soundOn, setSoundOn] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const readyIds = useRef<Set<string> | null>(null);

  useEffect(() => { if (paired) localStorage.setItem('flow_tv_branch', paired); }, [paired]);

  const load = useCallback(async () => {
    if (!branchId) return;
    const { data } = await (supabase as any).rpc('get_queue_display', { _branch_id: branchId });
    if (!data) return;
    setBranchName(data.branch_name || '');
    setVideoUrl(data.video_url || null);
    setRunningText(data.running_text || '');
    const list = (data.tickets || []) as Ticket[];
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
    const poll = setInterval(load, 4000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && userProfile) navigate('/pos'); };
    window.addEventListener('keydown', esc);
    return () => { clearInterval(id); window.removeEventListener('keydown', esc); };
  }, [navigate, userProfile]);

  const preparing = tickets.filter((t) => t.status !== 'ready');
  const ready = tickets.filter((t) => t.status === 'ready').slice().reverse();

  const enable = () => {
    unlockAudio();
    speak('Layar antrean aktif');
    setSoundOn(true);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  if (!branchId) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-center p-8">
        <div>
          <p className="text-2xl font-bold">Layar TV belum terhubung</p>
          <p className="text-muted-foreground mt-2">Buka Pengaturan POS di kasir → "Layar TV Antrean", lalu scan QR atau ketik link-nya di browser TV.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none">
      <header className="flex items-center justify-between px-6 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-4">
          {userProfile && (
            <button onClick={() => navigate('/pos')} className="h-11 w-11 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center" title="Kembali ke POS (Esc)">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">ZEGER</h1>
            <p className="text-sm opacity-80">{branchName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums">{now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm opacity-80">{now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_2fr_1fr]">
        <section className="flex flex-col border-r p-4 min-h-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-muted-foreground mb-3"><ChefHat className="h-7 w-7" /> Disiapkan</h2>
          <div className="grid grid-cols-2 gap-2 content-start overflow-hidden">
            {preparing.slice(0, 14).map((t) => (
              <div key={t.id} className="rounded-2xl border-2 bg-card py-3 text-center shadow-sm">
                <p className="text-3xl font-extrabold tabular-nums">{queueNo(t)}</p>
                {t.customer_name && <p className="text-xs text-muted-foreground truncate px-2">{t.customer_name}</p>}
              </div>
            ))}
            {!preparing.length && <p className="col-span-2 text-muted-foreground">Tidak ada antrean</p>}
          </div>
        </section>

        <section className="min-h-0 flex flex-col bg-foreground">
          <div className="flex-1 min-h-0"><PromoVideo url={videoUrl} /></div>
          {runningText && (
            <div className="overflow-hidden bg-primary text-primary-foreground py-2">
              <p className="whitespace-nowrap animate-[marquee_25s_linear_infinite] text-lg font-semibold">{runningText}</p>
            </div>
          )}
        </section>

        <section className="flex flex-col p-4 bg-success/5 min-h-0 border-l">
          <h2 className="flex items-center gap-2 text-xl font-bold text-success mb-3"><BellRing className="h-7 w-7" /> Siap Diambil</h2>
          <div className="grid gap-3 content-start overflow-hidden">
            {ready.slice(0, 6).map((t) => (
              <div key={t.id} className={`rounded-3xl bg-success text-success-foreground py-5 text-center shadow-lg transition ${highlight === t.id ? 'animate-pulse scale-105 ring-8 ring-success/30' : ''}`}>
                <p className="text-6xl font-black tabular-nums">{queueNo(t)}</p>
                {t.customer_name && <p className="text-lg font-medium truncate px-3">{t.customer_name}</p>}
              </div>
            ))}
            {!ready.length && <p className="text-muted-foreground">Belum ada pesanan siap</p>}
          </div>
        </section>
      </div>

      <footer className="px-6 py-2 border-t flex items-center justify-between text-sm text-muted-foreground">
        <span>Silakan ambil pesanan saat nomor Anda muncul di kolom hijau.</span>
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
