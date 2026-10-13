import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Download, MapPin, Phone, Instagram, Star, Wifi, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type R = {
  transaction_number: string; created_at: string; order_type: string; table_number: string | null; customer_name: string | null;
  subtotal: number; discount: number; service_charge: number; tax: number; total: number;
  payment_method_1: string | null; amount_1: number; payment_method_2: string | null; amount_2: number; change_amount: number;
  status: string; branch_name: string; footer: string | null; layout: any;
  items: { product_name: string; qty: number; price: number; subtotal: number; notes: string | null }[];
};

const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const PM: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', bank_transfer: 'Transfer', debit: 'Debit', card: 'Kartu' };

export default function DigitalReceipt() {
  const { id } = useParams();
  const [r, setR] = useState<R | null>(null);
  const [state, setState] = useState<'load' | 'ok' | 'none'>('load');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Struk Digital';
    (supabase as any).rpc('get_public_receipt', { _id: id }).then(({ data }: any) => {
      if (data) { setR(data); setState('ok'); } else setState('none');
    });
  }, [id]);

  if (state === 'load') return <div className="dr-bg min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary-foreground" /></div>;
  if (state === 'none' || !r) return <div className="dr-bg min-h-screen grid place-items-center p-6 text-center text-primary-foreground"><div><p className="text-lg font-semibold">Struk tidak ditemukan</p><p className="text-sm opacity-80">Link mungkin salah atau transaksi belum tersinkron.</p></div></div>;

  const L = r.layout || {};
  const brand = L.brandName || r.branch_name;
  const voided = r.status === 'void';
  const qty = r.items.reduce((a, i) => a + Number(i.qty), 0);
  const date = new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="dr-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-sm">
        <div ref={ref} className="dr-paper">
          <div className="dr-head">
            {L.showLogo && L.logoUrl
              ? <div className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-background grid place-items-center overflow-hidden shadow-lg"><img src={L.logoUrl} alt={brand} className="max-h-12 max-w-12 object-contain" /></div>
              : <div className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-background grid place-items-center text-2xl font-extrabold text-primary shadow-lg">{brand.charAt(0)}</div>}
            <h1 className="text-xl font-extrabold tracking-tight">{brand}</h1>
            {L.brandName && <p className="text-sm opacity-85">{r.branch_name}</p>}
            <div className={`dr-badge ${voided ? 'dr-badge-void' : ''}`}><CheckCircle2 className="h-4 w-4" /> {voided ? 'Dibatalkan' : 'Lunas'}</div>
          </div>

          <div className="px-6 pb-6 pt-5 space-y-5">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Pembayaran</p>
              <p className="text-4xl font-extrabold text-primary tabular-nums mt-1">{rp(r.total)}</p>
            </div>

            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">No. Struk</dt><dd className="text-right font-medium">{r.transaction_number}</dd>
              <dt className="text-muted-foreground">Tanggal</dt><dd className="text-right">{date}</dd>
              <dt className="text-muted-foreground">Tipe</dt><dd className="text-right capitalize">{r.order_type.replace('_', ' ')}{r.table_number ? ` · Meja ${r.table_number}` : ''}</dd>
              {r.customer_name && <><dt className="text-muted-foreground">Customer</dt><dd className="text-right">{r.customer_name}</dd></>}
            </dl>

            <div className="dr-perf" />

            <ul className="space-y-3">
              {r.items.map((i, k) => (
                <li key={k} className="flex gap-3">
                  <span className="h-7 min-w-7 px-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold grid place-items-center">{i.qty}×</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{i.product_name}</p>
                    {i.notes && <p className="text-xs text-muted-foreground">{i.notes}</p>}
                    <p className="text-xs text-muted-foreground tabular-nums">@ {rp(i.price)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{rp(i.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="dr-perf" />

            <div className="space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({qty} item)</span><span>{rp(r.subtotal)}</span></div>
              {r.discount > 0 && <div className="flex justify-between text-success"><span>Diskon</span><span>-{rp(r.discount)}</span></div>}
              {r.service_charge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{rp(r.service_charge)}</span></div>}
              {r.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>{rp(r.tax)}</span></div>}
              <div className="flex justify-between text-base font-extrabold pt-2 border-t"><span>Total</span><span className="text-primary">{rp(r.total)}</span></div>
              {r.payment_method_1 && <div className="flex justify-between"><span className="text-muted-foreground">{PM[r.payment_method_1] || r.payment_method_1}</span><span>{rp(r.amount_1)}</span></div>}
              {r.payment_method_2 && <div className="flex justify-between"><span className="text-muted-foreground">{PM[r.payment_method_2] || r.payment_method_2}</span><span>{rp(r.amount_2)}</span></div>}
              {r.change_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>{rp(r.change_amount)}</span></div>}
            </div>

            <div className="dr-bars" aria-hidden>{Array.from({ length: 46 }, (_, i) => { const c = r.transaction_number.charCodeAt(i % r.transaction_number.length) + i * 7; return <i key={i} style={{ width: (c % 3) + 1, marginRight: ((c >> 2) % 2) + 1 }} />; })}</div>
            <p className="text-center text-xs tracking-[0.2em] text-muted-foreground -mt-3">#{r.transaction_number}#</p>

            <div className="rounded-2xl bg-muted p-4 text-center space-y-1.5 text-xs text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">{r.footer || 'Terima kasih atas kunjungan Anda!'}</p>
              {L.address && <p className="flex items-center justify-center gap-1"><MapPin className="h-3 w-3" />{L.address}</p>}
              {L.phone && <p className="flex items-center justify-center gap-1"><Phone className="h-3 w-3" />{L.phone}</p>}
              {L.instagram && <p className="flex items-center justify-center gap-1"><Instagram className="h-3 w-3" />{L.instagram}</p>}
              {L.wifiName && <p className="flex items-center justify-center gap-1"><Wifi className="h-3 w-3" />{L.wifiName}{L.wifiPass ? ` · ${L.wifiPass}` : ''}</p>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-2 print:hidden">
          {L.showQr && L.qrUrl && <Button size="lg" onClick={() => window.open(L.qrUrl, '_blank')}><Star className="h-4 w-4" /> {L.qrCaption || 'Beri ulasan'}</Button>}
          <Button size="lg" variant="secondary" onClick={() => window.print()}><Download className="h-4 w-4" /> Simpan / Cetak PDF</Button>
          <p className="text-center text-xs text-primary-foreground/70 mt-2">Powered by Flow F&B</p>
        </div>
      </div>
    </div>
  );
}
