import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { queueAnnouncement, speakFriendly } from '@/lib/queue-voice';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { playAlertBeep, unlockAudio } from '@/lib/audio';
import { TvMediaItem, detectMediaType, gdriveId, spotifyEmbed, youtubeId, youtubePlaylistId } from '@/lib/tv-media';
import { Maximize, Volume2, ArrowLeft, Users, Clock } from 'lucide-react';
import zegerEmblem from '@/assets/zeger-logo-3d.png.asset.json';
import { Volume1, VolumeX, Type } from 'lucide-react';

/**
 * React doesn't reliably set the `muted` attribute, so browsers/Android TV
 * block autoplay. Force muted + play() via ref.
 */
const AutoVideo = ({ src, loop, onEnded, audible }: { src: string; loop?: boolean; onEnded?: () => void; audible?: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    v.play().catch(() => undefined);
  }, [src]);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.muted = !audible; if (audible) { v.removeAttribute('muted'); v.volume = 1; }
    v.play().catch(() => { v.muted = true; v.play().catch(() => undefined); });
  }, [audible, src]);
  return <video ref={ref} className="h-full w-full object-cover" src={src} autoPlay muted playsInline loop={loop} onEnded={onEnded} onError={onEnded} />;
};

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
const MediaPlaylist = ({ items, fallback, audible }: { items: TvMediaItem[]; fallback: string | null; audible?: boolean }) => {
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
  if (cur.type === 'video') return <AutoVideo key={key} audible={audible} src={cur.url} loop={list.length < 2} onEnded={list.length < 2 ? undefined : next} />;
  return <PromoVideo key={`${key}-${audible}`} url={cur.url} audible={audible} />;
};

const PromoVideo = ({ url, audible }: { url: string | null; audible?: boolean }) => {
  const m = audible ? 0 : 1;
  if (!url) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <img src={zegerEmblem.url} alt="Zeger" className="h-32 w-32 object-contain drop-shadow-2xl mb-4" />
        <p className="text-6xl font-black tracking-tight">ZEGER COFFEE</p>
        <p className="mt-2 text-lg opacity-80">Happiness in every cup ☕</p>
      </div>
    );
  }
  const list = youtubePlaylistId(url);
  if (list) {
    return (
      <iframe
        className="h-full w-full pointer-events-none"
        src={`https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1&mute=${m}&loop=1&controls=0&modestbranding=1&rel=0`}
        allow="autoplay; encrypted-media"
        title="Promo"
      />
    );
  }
  const yt = youtubeId(url);
  if (yt) {
    return (
      <iframe
        className="h-full w-full pointer-events-none"
        src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=${m}&loop=1&playlist=${yt}&controls=0&modestbranding=1&rel=0`}
        allow="autoplay; encrypted-media"
        title="Promo"
      />
    );
  }
  return <AutoVideo src={url} loop audible={audible} />;
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
  const [videoSound, setVideoSound] = useState(localStorage.getItem('flow_tv_video_sound') !== '0');
  const [textSize, setTextSize] = useState(Number(localStorage.getItem('flow_tv_text_size') || 1));
  useEffect(() => { localStorage.setItem('flow_tv_video_sound', videoSound ? '1' : '0'); }, [videoSound]);
  useEffect(() => { localStorage.setItem('flow_tv_text_size', String(textSize)); }, [textSize]);
  const TEXT_SIZES = ['text-lg', 'text-2xl', 'text-4xl', 'text-5xl'];
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

  // Ready first (newest call on top), then preparing oldest-first.
  const rows = [...ready, ...preparing].slice(0, 9);
  const waitMin = Math.max(preparing.length * 2, preparing.length ? 3 : 0);
  const time = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="tv-glass-canvas relative isolate h-screen flex flex-col overflow-hidden select-none p-4 gap-4">
      <div aria-hidden className="tv-waves">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="tv-wave tv-wave-1"><path d="M0,620 C240,480 420,760 720,600 C1020,440 1200,700 1440,560 L1440,900 L0,900 Z" /></svg>
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="tv-wave tv-wave-2"><path d="M0,700 C300,560 520,820 820,660 C1100,520 1260,760 1440,640 L1440,900 L0,900 Z" /></svg>
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="tv-wave tv-wave-3"><path d="M0,0 L1440,0 L1440,220 C1180,360 980,120 700,260 C430,390 220,170 0,300 Z" /></svg>
        <div className="tv-orb tv-orb-a" /><div className="tv-orb tv-orb-b" />
      </div>
      <header className="tv-glass rounded-[2rem] flex items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-4 min-w-0">
          {userProfile && (
            <button onClick={() => navigate('/pos')} className="tv-glass-chip h-11 w-11 rounded-2xl flex items-center justify-center" title="Kembali ke POS (Esc)">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <img src={zegerEmblem.url} alt="Logo Zeger Coffee" className="h-16 w-16 object-contain drop-shadow-xl shrink-0" />
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight text-foreground">ZEGER COFFEE</h1>
            <p className="text-sm text-muted-foreground truncate">{branchName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="tv-glass-chip rounded-2xl px-5 py-2 flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            <div><p className="text-xs text-muted-foreground">Total antrean saat ini</p><p className="text-2xl font-black tabular-nums">{preparing.length} <span className="text-base font-semibold">pesanan</span></p></div>
          </div>
          <div className="tv-glass-chip rounded-2xl px-5 py-2 flex items-center gap-3">
            <Clock className="h-7 w-7 text-primary" />
            <div><p className="text-xs text-muted-foreground">Estimasi waktu tunggu</p><p className="text-2xl font-black tabular-nums">{waitMin ? `± ${waitMin}` : '0'} <span className="text-base font-semibold">menit</span></p></div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-5xl font-black tabular-nums text-foreground">{time}</p>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[2.3fr_1fr] gap-4">
        <section className="tv-glass rounded-[2rem] p-3 min-h-0 flex">
          <div className="flex-1 rounded-[1.5rem] overflow-hidden bg-foreground shadow-2xl"><MediaPlaylist items={mediaItems} fallback={videoUrl} audible={soundOn && videoSound} /></div>
        </section>

        <section className="tv-glass rounded-[2rem] p-3 min-h-0 flex flex-col">
          <div className="grid grid-cols-[72px_1fr_auto] gap-2 px-3 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>No.</span><span>Nama</span><span>Status</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden" style={{ perspective: '1000px' }}>
            {rows.map((t, i) => {
              const isReady = t.status === 'ready';
              return (
                <div key={t.id} style={{ animationDelay: `${i * 70}ms` }}
                  className={`tv-row-drop tv-glass-row grid grid-cols-[72px_1fr_auto] items-center gap-2 rounded-2xl px-3 py-2.5 ${isReady ? 'tv-row-ready' : ''} ${highlight === t.id ? 'tv-row-call' : ''}`}>
                  <span className="text-3xl font-black tabular-nums tracking-tight text-foreground">{queueNo(t)}</span>
                  <span className="text-xl font-semibold truncate text-foreground">{t.customer_name ? `Kak ${t.customer_name}` : t.table_number ? `Meja ${t.table_number}` : '—'}</span>
                  <span className={`tv-badge ${isReady ? 'tv-badge-ready' : 'tv-badge-process'}`}>{isReady ? 'Siap Diambil' : 'Sedang Diproses'}</span>
                </div>
              );
            })}
            {!rows.length && <div className="flex-1 grid place-items-center text-xl text-muted-foreground">Belum ada antrean ☕</div>}
          </div>
        </section>
      </div>

      <footer className="tv-glass rounded-full pl-2 pr-2 py-2 flex items-center gap-3">
        <div className="flex-1 overflow-hidden">
          <p className={`tv-marquee whitespace-nowrap ${TEXT_SIZES[textSize] || 'text-lg'} font-semibold text-foreground`}>{runningText || 'Silakan ambil pesanan saat nama Anda dipanggil dan status berubah menjadi Siap Diambil. Terima kasih! ☕'}</p>
        </div>
        <button onClick={() => setTextSize((n) => (n + 1) % TEXT_SIZES.length)} className="tv-glass-chip shrink-0 h-10 px-3 rounded-full flex items-center gap-1 text-sm font-semibold" title="Ukuran teks berjalan"><Type className="h-4 w-4" /> {['S','M','L','XL'][textSize]}</button>
        <button onClick={() => setVideoSound((v) => !v)} className="tv-glass-chip shrink-0 h-10 px-3 rounded-full flex items-center gap-1 text-sm font-semibold" title="Suara video">{videoSound ? <Volume1 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Video {videoSound ? 'On' : 'Mute'}</button>
        {!soundOn ? (
          <button onClick={enable} className="shrink-0 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 font-medium">
            <Maximize className="h-4 w-4" /> Aktifkan Suara & Layar Penuh
          </button>
        ) : (
          <span className="shrink-0 flex items-center gap-1 text-success px-3"><Volume2 className="h-4 w-4" /> Suara aktif</span>
        )}
      </footer>
    </div>
  );
};

export default POSQueueDisplay;
