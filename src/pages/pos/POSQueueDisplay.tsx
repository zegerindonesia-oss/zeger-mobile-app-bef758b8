import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { queueAnnouncement, speakFriendly } from '@/lib/queue-voice';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { playAlertBeep, unlockAudio } from '@/lib/audio';
import { TvMediaItem, detectMediaType, gdriveId, spotifyEmbed, youtubeId } from '@/lib/tv-media';
import { ChefHat, BellRing, Maximize, Volume2, ArrowLeft } from 'lucide-react';

interface Ticket {
  id: string;
  status: string;
  table_number: string | null;
  customer_name: string | null;
  transaction_number: string | null;
  queue_number?: number | null;
  created_at: string;
}

/** Short, easy-to-call number shown on the TV. */
const queueNo = (t: Ticket) => {
  if (t.queue_number) return String(t.queue_number).padStart(3, '0');
  if (t.table_number) return `M${t.table_number}`;
  const digits = (t.transaction_number || t.id).replace(/\D/g, '');
  return digits.slice(-3).padStart(3, '0');
};

const speak = speakFriendly;

/** Rotates through the cashier-configured playlist (video, live, drive, banner, spotify). */
const MediaPlaylist = ({ items, fallback }: { items: TvMediaItem[]; fallback: string | null }) => {
  const list = items.length ? items : fallback ? [{ type: detectMediaType(fallback), url: fallback }] : [];
  const [idx, setIdx] = useState(0);
  const cur = list[idx % Math.max(list.length, 1)];
  const next = useCallback(() => setIdx((i) => (i + 1) % Math.max(list.length, 1)), [list.length]);
  useEffect(() => { setIdx(0); }, [list.length]);
  useEffect(() => {
    if (!cur || list.length < 2) return;
    // Videos advance on end; others (and YouTube/Drive iframes) after their duration.
    if (cur.type === 'video') return;
    const sec = cur.duration || (cur.type === 'image' ? 8 : 60);
    const t = setTimeout(next, sec * 1000);
    return () => clearTimeout(t);
  }, [cur, list.length, next]);
  if (!cur) return <PromoVideo url={null} />;
  const key = `${idx}-${cur.url}`;
  if (cur.type === 'image') return <img key={key} src={cur.url} alt="Promo" className="h-full w-full object-cover animate-fade-in" />;
  if (cur.type === 'spotify') {
    const src = spotifyEmbed(cur.url);
    return src ? <div className="h-full w-full flex items-center justify-center p-6"><iframe key={key} src={src} className="w-full h-[380px] max-w-xl rounded-2xl" allow="autoplay; encrypted-media" title="Spotify" /></div> : <PromoVideo url={null} />;
  }
  if (cur.type === 'gdrive') {
    const id = gdriveId(cur.url);
    return id ? <iframe key={key} className="h-full w-full" src={`https://drive.google.com/file/d/${id}/preview?autoplay=1`} allow="autoplay" title="Promo" /> : <PromoVideo url={null} />;
  }
  if (cur.type === 'video') return <video key={key} className="h-full w-full object-cover" src={cur.url} autoPlay muted playsInline loop={list.length < 2} onEnded={next} />;
  return <PromoVideo key={key} url={cur.url} />;
};

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
  const { code: routeCode } = useParams();
  const [paired, setPaired] = useState<string | null>(params.get('branch'));
  const branchId = paired || localStorage.getItem('flow_tv_branch') || userProfile?.branch_id || null;
  const [codeInput, setCodeInput] = useState('');
  const [pairErr, setPairErr] = useState('');
  const pairWith = useCallback(async (c: string) => {
    setPairErr('');
    const { data } = await (supabase as any).rpc('tv_pair', { _code: c });
    if (data) setPaired(data); else setPairErr('Kode salah. Cek kode di POS kasir → Pengaturan → Layar TV.');
  }, []);
  useEffect(() => { if (routeCode) pairWith(routeCode); }, [routeCode, pairWith]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [branchName, setBranchName] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<TvMediaItem[]>([]);
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
    setMediaItems(Array.isArray(data.media_items) ? data.media_items : []);
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
          setTimeout(() => speak(queueAnnouncement(t.queue_number ?? null, t.customer_name, t.table_number)), 700);
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
    speak('Halo! Layar antrian sudah aktif ya.');
    setSoundOn(true);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  if (!branchId) {
    const press = (d: string) => setCodeInput((v) => (d === '⌫' ? v.slice(0, -1) : (v + d).slice(0, 6)));
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="w-full max-w-md rounded-[2rem] bg-card border shadow-2xl p-8 text-center space-y-5">
          <p className="text-2xl font-extrabold">Hubungkan Layar TV</p>
          <p className="text-muted-foreground text-sm">Masukkan 6 angka kode TV yang tampil di POS kasir (Pengaturan → Layar TV Antrean).</p>
          <input autoFocus inputMode="numeric" value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && codeInput.length === 6 && pairWith(codeInput)}
            className="w-full text-center text-5xl font-black tracking-[0.4em] rounded-2xl border-2 bg-background py-4 focus:outline-none focus:ring-4 focus:ring-primary/30" placeholder="••••••" />
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9','⌫','0','OK'].map((d) => (
              <button key={d} onClick={() => (d === 'OK' ? codeInput.length === 6 && pairWith(codeInput) : press(d))}
                className={`h-16 rounded-2xl text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-primary/40 ${d === 'OK' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}>{d}</button>
            ))}
          </div>
          {pairErr && <p className="text-destructive text-sm">{pairErr}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none">
      <header className="m-3 mb-0 rounded-3xl flex items-center justify-between px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg">
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

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_2fr_1fr] gap-3 p-3">
        <section className="flex flex-col rounded-3xl bg-card border shadow-sm p-4 min-h-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-muted-foreground mb-3"><ChefHat className="h-7 w-7" /> Disiapkan</h2>
          <div className="grid grid-cols-2 gap-2 content-start overflow-hidden">
            {preparing.slice(0, 14).map((t) => (
              <div key={t.id} className="rounded-2xl bg-muted/60 py-3 text-center">
                <p className="text-3xl font-extrabold tabular-nums">{queueNo(t)}</p>
                {t.customer_name && <p className="text-sm font-medium text-muted-foreground truncate px-2">{t.customer_name}</p>}
              </div>
            ))}
            {!preparing.length && <p className="col-span-2 text-muted-foreground">Tidak ada antrean</p>}
          </div>
        </section>

        <section className="min-h-0 flex flex-col bg-foreground rounded-3xl overflow-hidden shadow-lg">
          <div className="flex-1 min-h-0"><MediaPlaylist items={mediaItems} fallback={videoUrl} /></div>
          {runningText && (
            <div className="overflow-hidden bg-primary text-primary-foreground py-2">
              <p className="text-center truncate px-4 text-lg font-semibold">{runningText}</p>
            </div>
          )}
        </section>

        <section className="flex flex-col p-4 rounded-3xl bg-success/10 border border-success/20 min-h-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-success mb-3"><BellRing className="h-7 w-7" /> Siap Diambil</h2>
          <div className="grid gap-3 content-start overflow-hidden">
            {ready.slice(0, 6).map((t) => (
              <div key={t.id} className={`rounded-3xl bg-success text-success-foreground py-5 text-center shadow-lg transition ${highlight === t.id ? 'animate-pulse scale-105 ring-8 ring-success/30' : ''}`}>
                <p className="text-6xl font-black tabular-nums">{queueNo(t)}</p>
                {t.customer_name && <p className="text-xl font-semibold truncate px-3">Kak {t.customer_name}</p>}
              </div>
            ))}
            {!ready.length && <p className="text-muted-foreground">Belum ada pesanan siap</p>}
          </div>
        </section>
      </div>

      <footer className="mx-3 mb-3 rounded-2xl bg-card border px-6 py-2 flex items-center justify-between text-sm text-muted-foreground">
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
