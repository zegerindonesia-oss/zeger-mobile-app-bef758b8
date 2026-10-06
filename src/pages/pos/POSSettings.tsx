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

type Tab = 'printer' | 'tv';

/** Full-page POS settings: printers + TV queue pairing & promo video. */
const POSSettings = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const branchId = userProfile?.branch_id || null;
  const [tab, setTab] = useState<Tab>('printer');
  const [videoUrl, setVideoUrl] = useState('');
  const [runningText, setRunningText] = useState('');
  const [saving, setSaving] = useState(false);

  const tvUrl = branchId ? `${window.location.origin}/tv?branch=${branchId}` : '';
  const qr = tvUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tvUrl)}` : '';

  useEffect(() => {
    if (!branchId) return;
    (supabase as any).from('pos_display_settings').select('video_url,running_text').eq('branch_id', branchId).maybeSingle()
      .then(({ data }: any) => { setVideoUrl(data?.video_url || ''); setRunningText(data?.running_text || ''); });
  }, [branchId]);

  const saveTv = async () => {
    if (!branchId) return;
    setSaving(true);
    const { error } = await (supabase as any).from('pos_display_settings').upsert({
      branch_id: branchId, video_url: videoUrl.trim() || null, running_text: runningText.trim() || null,
      updated_at: new Date().toISOString(), updated_by: userProfile?.id,
    });
    setSaving(false);
    error ? toast.error(error.message) : toast.success('Pengaturan TV tersimpan — TV akan update otomatis');
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'tv', label: 'Layar TV Antrean', icon: Tv },
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
                <div><Label>Link video promo (YouTube atau file .mp4)</Label>
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></div>
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
