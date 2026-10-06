import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Printer, Tv, Copy, ExternalLink } from 'lucide-react';
import { POSPrinterSettings } from '@/components/pos/POSPrinterSettings';
import { cn } from '@/lib/utils';
import { TvMediaItem, TvMediaType, TV_MEDIA_LABEL, detectMediaType, isDriveFolder } from '@/lib/tv-media';
import { Plus, Trash2, ArrowUp, RefreshCw } from 'lucide-react';
import { POSDataSync } from '@/components/pos/POSDataSync';

type Tab = 'printer' | 'tv' | 'sync';

/** Full-page POS settings: printers + TV queue pairing & promo video. */
const POSSettings = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const branchId = userProfile?.branch_id || null;
  const [tab, setTab] = useState<Tab>('printer');
  const [videoUrl, setVideoUrl] = useState('');
  const [runningText, setRunningText] = useState('');
  const [items, setItems] = useState<TvMediaItem[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<TvMediaType | 'auto'>('auto');
  const [saving, setSaving] = useState(false);

  const tvUrl = branchId ? `${window.location.origin}/tv?branch=${branchId}` : '';
  const qr = tvUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tvUrl)}` : '';

  useEffect(() => {
    if (!branchId) return;
    (supabase as any).from('pos_display_settings').select('video_url,running_text,media_items').eq('branch_id', branchId).maybeSingle()
      .then(({ data }: any) => { setVideoUrl(data?.video_url || ''); setRunningText(data?.running_text || ''); setItems(Array.isArray(data?.media_items) ? data.media_items : []); });
  }, [branchId]);

  const saveTv = async () => {
    if (!branchId) return;
    setSaving(true);
    const { error } = await (supabase as any).from('pos_display_settings').upsert({
      branch_id: branchId, video_url: videoUrl.trim() || null, media_items: items, running_text: runningText.trim() || null,
      updated_at: new Date().toISOString(), updated_by: userProfile?.id,
    });
    setSaving(false);
    error ? toast.error(error.message) : toast.success('Pengaturan TV tersimpan — TV akan update otomatis');
  };

  const addItem = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (isDriveFolder(url)) { toast.error('Itu link folder. Buka videonya di Drive → Bagikan → salin link file (akses: siapa saja yang memiliki link).'); return; }
    const type = newType === 'auto' ? detectMediaType(url) : newType;
    setItems((l) => [...l, { type, url, duration: type === 'image' ? 8 : type === 'video' ? undefined : 60 }]);
    setNewUrl('');
  };
  const updateItem = (i: number, patch: Partial<TvMediaItem>) => setItems((l) => l.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const moveUp = (i: number) => i > 0 && setItems((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; });

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'tv', label: 'Layar TV Antrean', icon: Tv },
    { id: 'sync', label: 'Sinkronkan Data', icon: RefreshCw },
  ];

  return (
    <div className="min-h-[100dvh] pos-canvas pos-touch p-3 md:p-5 space-y-4">
      <header className="pos-command-header rounded-2xl px-3 md:px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/pos')} className="pos-raised-control h-11 w-11 rounded-xl flex items-center justify-center" title="Kembali"><ArrowLeft className="h-5 w-5" /></button>
        <div><h1 className="text-lg md:text-xl font-bold">Pengaturan POS</h1><p className="text-xs text-muted-foreground">Printer, layar TV & preferensi kasir</p></div>
      </header>

      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        <nav className="pos-panel rounded-2xl p-2 flex md:flex-col gap-1 h-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex-1 md:flex-none flex items-center gap-2 rounded-xl px-3 h-11 text-sm font-semibold transition', tab === t.id ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-muted')}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        <section className="pos-panel rounded-2xl p-4 md:p-6 min-w-0">
          {tab === 'printer' && (
            <POSPrinterSettings inline open onOpenChange={() => undefined} branchId={branchId} userId={userProfile?.id} />
          )}
          {tab === 'sync' && <POSDataSync />}
          {tab === 'tv' && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
                <div className="rounded-2xl bg-background p-3 text-center shadow-inner">
                  {qr && <img src={qr} alt="QR layar TV" className="mx-auto h-52 w-52" />}
                  <p className="text-xs text-muted-foreground mt-2">Scan dari browser Smart TV / Android TV</p>
                </div>
                <div className="space-y-3">
                  <h2 className="text-lg font-bold">Hubungkan TV (sekali saja)</h2>
                  <ol className="list-decimal pl-5 text-sm space-y-1 text-muted-foreground">
                    <li>Buka browser di Smart TV / Android TV box.</li>
                    <li>Scan QR di samping, atau ketik link di bawah.</li>
                    <li>TV akan mengingat outlet ini — besok cukup buka browser lagi, tanpa login.</li>
                    <li>Tekan "Aktifkan Suara & Layar Penuh" di TV agar nomor dipanggil otomatis.</li>
                  </ol>
                  <div className="flex gap-2">
                    <Input readOnly value={tvUrl} className="font-mono text-xs" />
                    <Button variant="outline" onClick={() => { navigator.clipboard.writeText(tvUrl); toast.success('Link disalin'); }}><Copy className="h-4 w-4" /></Button>
                    <Button variant="outline" onClick={() => window.open(tvUrl, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
              <div className="border-t pt-5 space-y-3">
                <h2 className="text-lg font-bold">Konten Tengah TV</h2>
                <p className="text-sm text-muted-foreground">Tambahkan beberapa konten — TV memutarnya bergiliran. Mendukung YouTube (video, Shorts, Live), file Google Drive, link .mp4, gambar banner, dan playlist Spotify.</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="auto">Deteksi otomatis</option>
                    {(Object.keys(TV_MEDIA_LABEL) as TvMediaType[]).map((t) => <option key={t} value={t}>{TV_MEDIA_LABEL[t]}</option>)}
                  </select>
                  <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} placeholder="Tempel link YouTube / Drive / Spotify / gambar..." className="h-11" />
                  <Button onClick={addItem} className="h-11"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2">
                      <span className="text-xs font-bold w-6 text-center">{i + 1}</span>
                      <span className="text-xs rounded-full bg-muted px-2 py-1 font-semibold">{TV_MEDIA_LABEL[it.type]}</span>
                      <span className="flex-1 min-w-[160px] truncate text-xs font-mono">{it.url}</span>
                      {it.type !== 'video' && (
                        <label className="flex items-center gap-1 text-xs">Durasi
                          <Input type="number" min={3} value={it.duration ?? 60} onChange={(e) => updateItem(i, { duration: Number(e.target.value) || 10 })} className="h-9 w-20" /> dtk
                        </label>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => moveUp(i)} title="Naikkan"><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} title="Hapus"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  {!items.length && <p className="text-xs text-muted-foreground">Belum ada konten. {videoUrl ? 'TV memakai video lama: ' + videoUrl : 'TV menampilkan logo brand.'}</p>}
                </div>
                <p className="text-xs text-muted-foreground">Tips: YouTube Live untuk musik/ambience 24 jam. Spotify tanpa login Premium di TV hanya memutar cuplikan 30 detik. Durasi YouTube/Drive diatur manual karena TV tidak bisa membaca panjang videonya.</p>
                <div><Label>Teks berjalan (opsional)</Label>
                  <Input value={runningText} onChange={(e) => setRunningText(e.target.value)} placeholder="Promo hari ini: Beli 2 Kopi Aren gratis 1!" /></div>
                <Button onClick={saveTv} disabled={saving} className="h-11 px-6">{saving ? 'Menyimpan...' : 'Simpan Pengaturan TV'}</Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default POSSettings;
