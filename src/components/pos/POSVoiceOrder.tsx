import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Mic, MicOff, Loader2, Sparkles, Phone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { allModifierNames, getModifierGroups, modifierPrice, normalizeSelection } from '@/lib/pos-modifiers';
import type { AddItemOptions, POSCartItem } from '@/hooks/usePOSCart';
import type { LoyaltyMember } from '@/components/loyalty/MemberScanDialog';

type CartProduct = Omit<POSCartItem, 'qty' | 'discount_item' | 'notes' | 'line_id' | 'modifiers'>;
interface Product { id: string; code: string; name: string; category: string | null; price: number; image_url: string | null; custom_options?: any }
interface Props {
  onAdd: (p: CartProduct, opts?: AddItemOptions) => void;
  onMember?: (m: LoyaltyMember) => void;
}
interface LogEntry { id: number; text: string; kind: 'item' | 'member' | 'warn' }

const getRecognition = () => {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return SR ? new SR() : null;
};

/** Pause (ms) after the last spoken words before auto mode sends the chunk to AI. */
const AUTO_PAUSE_MS = 2200;

export const POSVoiceOrder = ({ onAdd, onMember }: Props) => {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [auto, setAuto] = useState(() => localStorage.getItem('pos_voice_auto') !== '0');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const recRef = useRef<any>(null);
  const finalRef = useRef('');
  const pendingRef = useRef(''); // text not yet sent to AI (auto mode)
  const wantRef = useRef(false); // keep listening across browser auto-stops
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const addedRef = useRef<string[]>([]); // summary of items added this session
  const memberDoneRef = useRef(false);
  const busyRef = useRef(false);
  const autoRef = useRef(auto);
  autoRef.current = auto;

  useEffect(() => {
    supabase.from('products').select('id, code, name, category, price, image_url, custom_options')
      .eq('is_active', true).then(({ data }) => setProducts((data || []) as Product[]));
  }, []);

  const pushLog = (text: string, kind: LogEntry['kind']) =>
    setLog((l) => [{ id: Date.now() + Math.random(), text, kind }, ...l].slice(0, 30));

  const resetSession = () => {
    setTranscript(''); setInterim(''); finalRef.current = ''; pendingRef.current = '';
    addedRef.current = []; memberDoneRef.current = false; setLog([]);
  };

  const registerMember = async (phone: string, name: string) => {
    if (!onMember || memberDoneRef.current || phone.length < 10) return;
    memberDoneRef.current = true;
    const { data, error } = await (supabase as any).rpc('pos_quick_member', { _phone: phone, _name: name || null });
    if (error) { memberDoneRef.current = false; pushLog(`Gagal daftar member ${phone}`, 'warn'); return; }
    const m = Array.isArray(data) ? data[0] : data;
    if (!m) return;
    onMember(m);
    pushLog(`${m.is_new ? 'Member baru' : 'Member'}: ${m.name || phone} (${phone})`, 'member');
    toast.success(m.is_new ? `Member baru terdaftar: ${phone}` : `Member: ${m.name}`);
  };

  const parse = useCallback(async (text: string, silent: boolean) => {
    if (!text.trim()) return 0;
    busyRef.current = true;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-voice-parse', {
        body: {
          transcript: text,
          products: products.map((p) => ({ id: p.id, name: p.name })),
          modifiers: allModifierNames(),
          already: addedRef.current,
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
        const qty = Number(it.qty) || 1;
        const groups = getModifierGroups(p);
        const mods = normalizeSelection(groups, Array.isArray(it.modifiers) ? it.modifiers : []);
        onAdd(
          { product_id: p.id, product_code: p.code, product_name: p.name, category: p.category, price: Number(p.price), image_url: p.image_url },
          { qty, modifiers: mods, notes: it.notes || '', extraPrice: modifierPrice(groups, mods) },
        );
        const label = `${p.name} ×${qty}${mods.length ? ` (${mods.join(', ')})` : ''}${it.notes ? ` – ${it.notes}` : ''}`;
        addedRef.current.push(label);
        pushLog(label, 'item');
        added += qty;
      }
      if (data.phone) await registerMember(String(data.phone), data.customer_name || '');
      if (data.unmatched?.length) pushLog(`Tidak dikenali: ${data.unmatched.join(', ')}`, 'warn');
      if (added > 0) toast.success(`${added} item masuk keranjang`);
      else if (!silent && !data.phone) toast.error('Tidak ada menu yang cocok');
      return added;
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses suara');
      return 0;
    } finally {
      busyRef.current = false;
      setProcessing(false);
    }
  }, [products, onAdd, onMember]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushAuto = useCallback(async () => {
    if (busyRef.current) { timerRef.current = setTimeout(flushAuto, 500); return; }
    const chunk = pendingRef.current.trim();
    pendingRef.current = '';
    if (chunk.split(/\s+/).length < 2 && !/\d/.test(chunk)) return; // ignore tiny noise
    await parse(chunk, true);
  }, [parse]);

  const stop = useCallback(() => {
    wantRef.current = false;
    clearTimeout(timerRef.current);
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      toast.error('Perangkat tidak mendukung input suara. Gunakan Chrome / Edge, atau ketik pesanan.');
      return;
    }
    wantRef.current = true;
    rec.lang = 'id-ID';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalRef.current += r[0].transcript + ' ';
          pendingRef.current += r[0].transcript + ' ';
        } else inter += r[0].transcript;
      }
      setTranscript(finalRef.current.trim());
      setInterim(inter);
      if (autoRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flushAuto, AUTO_PAUSE_MS);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Izin mikrofon ditolak. Aktifkan mikrofon di pengaturan.');
        wantRef.current = false;
      }
    };
    rec.onend = () => {
      setInterim('');
      // Browsers stop recognition after silence; restart while the cashier keeps it on.
      if (wantRef.current) { try { rec.start(); return; } catch { /* fallthrough */ } }
      setListening(false);
    };
    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
    setListening(true);
  }, [flushAuto]);

  useEffect(() => () => { wantRef.current = false; recRef.current?.stop(); clearTimeout(timerRef.current); }, []);

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

  const manualProcess = async () => {
    const text = (transcript + ' ' + interim).trim();
    if (!text) return toast.error('Belum ada ucapan pesanan');
    if (!auto) stop();
    pendingRef.current = '';
    const added = await parse(text, false);
    if (added > 0 && !auto) { resetSession(); setOpen(false); }
  };

  const toggleAuto = (v: boolean) => { setAuto(v); localStorage.setItem('pos_voice_auto', v ? '1' : '0'); };

  return (
    <>
      <Button size="sm" variant={listening ? 'destructive' : 'secondary'} onClick={() => { setOpen(true); if (!listening) setTimeout(start, 150); }} title="Pesan via suara (F2)">
        <Mic className={`h-4 w-4 mr-1 ${listening ? 'animate-pulse' : ''}`} /> Voice
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !auto) stop(); setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Voice Order AI</DialogTitle>
          </DialogHeader>
          <label className="flex items-center justify-between rounded-xl border p-3 gap-3">
            <div className="text-sm">
              <div className="font-semibold">Mode Otomatis (dengar percakapan)</div>
              <div className="text-xs text-muted-foreground">Ngobrol biasa dengan pelanggan — menu & nomor HP langsung masuk sendiri.</div>
            </div>
            <Switch checked={auto} onCheckedChange={toggleAuto} />
          </label>
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              onClick={listening ? stop : start}
              className={`h-20 w-20 rounded-full flex items-center justify-center transition shadow-lg ${listening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-primary text-primary-foreground hover:scale-105'}`}
              aria-label={listening ? 'Berhenti merekam' : 'Mulai merekam'}
            >
              {listening ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
            </button>
            <p className="text-sm text-muted-foreground text-center">
              {processing ? 'Memahami pesanan…' : listening ? (auto ? 'Mendengarkan… pesanan dimasukkan otomatis' : 'Mendengarkan… ucapkan pesanan') : 'Tekan mic atau F2 untuk mulai'}
              <br /><span className="text-xs italic">"Silakan kak, pesan apa? — Aren latte dua, satu less sugar. Nomornya 0812 3456 7890."</span>
            </p>
          </div>
          <Textarea
            rows={3}
            value={transcript + (interim ? ' ' + interim : '')}
            onChange={(e) => { setTranscript(e.target.value); setInterim(''); finalRef.current = e.target.value + ' '; }}
            placeholder="Transkrip muncul di sini (bisa juga diketik / dikoreksi)"
          />
          {log.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border divide-y text-sm">
              {log.map((l) => (
                <div key={l.id} className={`flex items-center gap-2 px-3 py-1.5 ${l.kind === 'warn' ? 'text-warning' : ''}`}>
                  {l.kind === 'member' ? <Phone className="h-4 w-4 text-primary shrink-0" /> : <CheckCircle2 className={`h-4 w-4 shrink-0 ${l.kind === 'warn' ? '' : 'text-success'}`} />}
                  <span className="truncate">{l.text}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetSession}>Pelanggan Baru</Button>
            <Button className="flex-1" onClick={manualProcess} disabled={processing}>
              {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses…</> : auto ? 'Proses Sekarang' : 'Masukkan ke Keranjang'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
