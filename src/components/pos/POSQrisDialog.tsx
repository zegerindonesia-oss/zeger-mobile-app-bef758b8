import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  amount: number;
  onClose: () => void;
  onPaid: (reference: string | null) => void;
}

// Dynamic QRIS for in-store POS bills; polls Duitku until paid, then hands back to the payment flow.
export const POSQrisDialog = ({ open, amount, onClose, onPaid }: Props) => {
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [left, setLeft] = useState(900);
  const ref = useRef<string>('');
  const done = useRef(false);

  const create = async () => {
    setQr(null); setError(null); setPaid(false); setLeft(900); done.current = false;
    ref.current = `POS-${crypto.randomUUID()}`;
    const { data, error } = await supabase.functions.invoke('duitku-qris', {
      body: { action: 'pos_create', ref: ref.current, amount: Math.round(amount) },
    });
    if (error || !data?.qr_string) { setError(data?.error || 'Gagal membuat QRIS. Coba lagi.'); return; }
    setQr(data.qr_string);
  };

  useEffect(() => { if (open) create(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  useEffect(() => {
    if (!open || !qr || paid) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const p = setInterval(async () => {
      const { data } = await supabase.functions.invoke('duitku-qris', { body: { action: 'pos_status', ref: ref.current } });
      if (data?.paid && !done.current) {
        done.current = true;
        setPaid(true);
        setTimeout(() => onPaid(data.reference || ref.current), 1200);
      }
    }, 3000);
    return () => { clearInterval(t); clearInterval(p); };
  }, [open, qr, paid, onPaid]);

  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !paid) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Scan QRIS</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="text-3xl font-bold text-primary">{fmt(amount)}</div>
          {paid ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CheckCircle2 className="h-20 w-20 text-primary" />
              <div className="text-xl font-semibold">Lunas!</div>
            </div>
          ) : error ? (
            <div className="text-sm text-destructive text-center py-8">{error}</div>
          ) : !qr ? (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground my-16" />
          ) : left === 0 ? (
            <div className="text-sm text-muted-foreground py-8">QR kedaluwarsa. Buat ulang.</div>
          ) : (
            <>
              <div className="rounded-xl bg-card p-3 border"><QRCodeSVG value={qr} size={240} /></div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Menunggu pembayaran… {mm}:{ss}
              </div>
            </>
          )}
        </div>
        {!paid && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Batal</Button>
            {(error || left === 0) && <Button onClick={create}>Buat Ulang QR</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
