import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { allModifierNames, getModifierGroups, modifierPrice, normalizeSelection } from '@/lib/pos-modifiers';
import type { AddItemOptions, POSCartItem } from '@/hooks/usePOSCart';

type CartProduct = Omit<POSCartItem, 'qty' | 'discount_item' | 'notes' | 'line_id' | 'modifiers'>;
interface Product { id: string; code: string; name: string; category: string | null; price: number; image_url: string | null; custom_options?: any }
interface Props { onAdd: (p: CartProduct, opts?: AddItemOptions) => void }

const getRecognition = () => {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return SR ? new SR() : null;
};

export const POSVoiceOrder = ({ onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const recRef = useRef<any>(null);
  const finalRef = useRef('');

  useEffect(() => {
    supabase.from('products').select('id, code, name, category, price, image_url, custom_options')
      .eq('is_active', true).then(({ data }) => setProducts((data || []) as Product[]));
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      toast.error('Browser tidak mendukung input suara. Gunakan Chrome / Edge, atau ketik pesanan.');
      return;
    }
    finalRef.current = transcript ? transcript + ' ' : '';
    rec.lang = 'id-ID';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + ' ';
        else inter += r[0].transcript;
      }
      setTranscript(finalRef.current.trim());
      setInterim(inter);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') toast.error('Izin mikrofon ditolak. Aktifkan mikrofon di browser.');
      setListening(false);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [transcript]);

  // Spacebar shortcut (hold-free toggle) while dialog open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'F2') {
        e.preventDefault();
        if (!open) { setOpen(true); setTimeout(start, 150); }
        else listening ? stop() : start();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, listening, start, stop]);

  const process = async () => {
    stop();
    const text = (transcript + ' ' + interim).trim();
    if (!text) return toast.error('Belum ada ucapan pesanan');
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-voice-parse', {
        body: {
          transcript: text,
          products: products.map((p) => ({ id: p.id, name: p.name })),
          modifiers: allModifierNames(),
        },
      });
      if (error) {
        let msg = error.message;
        try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* noop */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      const byId = new Map(products.map((p) => [p.id, p]));
      let added = 0;
      for (const it of data.items || []) {
        const p = byId.get(it.product_id);
        if (!p) continue;
        const groups = getModifierGroups(p);
        const mods = normalizeSelection(groups, Array.isArray(it.modifiers) ? it.modifiers : []);
        onAdd(
          { product_id: p.id, product_code: p.code, product_name: p.name, category: p.category, price: Number(p.price), image_url: p.image_url },
          { qty: Number(it.qty) || 1, modifiers: mods, notes: it.notes || '', extraPrice: modifierPrice(groups, mods) },
        );
        added += Number(it.qty) || 1;
      }
      if (added > 0) toast.success(`${added} item ditambahkan ke keranjang`);
      if (data.unmatched?.length) toast.warning(`Tidak dikenali: ${data.unmatched.join(', ')}`);
      if (added === 0 && !data.unmatched?.length) toast.error('Tidak ada menu yang cocok');
      if (added > 0) { setTranscript(''); setInterim(''); setOpen(false); }
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses suara');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setTimeout(start, 150); }} title="Pesan via suara (F2)">
        <Mic className="h-4 w-4 mr-1" /> Voice
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) stop(); setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Voice Order AI</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              type="button"
              onClick={listening ? stop : start}
              className={`h-24 w-24 rounded-full flex items-center justify-center transition shadow-lg ${listening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-primary text-primary-foreground hover:scale-105'}`}
              aria-label={listening ? 'Berhenti merekam' : 'Mulai merekam'}
            >
              {listening ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
            </button>
            <p className="text-sm text-muted-foreground text-center">
              {listening ? 'Mendengarkan… ucapkan pesanan' : 'Tekan mic atau F2, lalu ucapkan pesanan'}
              <br /><span className="text-xs italic">"Kopi aren dua, satu less sugar, satu hot. Croissant satu dipanasin."</span>
            </p>
          </div>
          <Textarea
            rows={3}
            value={transcript + (interim ? ' ' + interim : '')}
            onChange={(e) => { setTranscript(e.target.value); setInterim(''); finalRef.current = e.target.value + ' '; }}
            placeholder="Transkrip muncul di sini (bisa juga diketik / dikoreksi)"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setTranscript(''); setInterim(''); finalRef.current = ''; }}>Hapus</Button>
            <Button className="flex-1" onClick={process} disabled={processing}>
              {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses…</> : 'Masukkan ke Keranjang'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
