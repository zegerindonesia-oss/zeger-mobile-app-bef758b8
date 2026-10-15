import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cn } from '@/lib/utils';
import { renderStickers } from '@/lib/pos-printing';
import { Sticker, STICKER_CSS } from '@/components/stock/CupStickerPrint';

const today = new Date();
const RIDER_SAMPLE = [
  { name: 'Aren Latte', short_name: 'Aren', price: 18000, shelf_life_days: 5, qty: 1 },
  { name: 'Matcha Latte', short_name: 'Matcha', price: 20000, shelf_life_days: 4, qty: 1 },
  { name: 'Lychee Refresher', short_name: 'Lychee', price: 16000, shelf_life_days: 3, qty: 1 },
];

/** Live preview of both sticker formats: customer cup label vs rider stock label. */
export const StickerPreview = () => {
  const [mode, setMode] = useState<'customer' | 'rider'>('customer');
  const customerHtml = renderStickers({
    station: 'Stiker', ref: 'POS-0015', order_type: 'take_away', created_at: today.toISOString(), customer_name: 'Budi',
    items: [
      { product_name: 'Aren Latte Large', qty: 1, notes: 'Less Ice, 50% Sugar' },
      { product_name: 'Americano', qty: 1, notes: 'Hot, Extra Shot' },
    ],
  });
  const labels = customerHtml.split('<div class="lbl">').slice(1).map((l) => '<div class="lbl">' + l.replace(/<\/body>.*$/s, ''));
  const head = customerHtml.match(/<style>(.*)<\/style>/s)?.[1] || '';

  return (
    <section className="space-y-3 rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Preview Label Stiker</h3>
          <p className="text-xs text-muted-foreground">Format berbeda untuk pesanan customer dan order stok rider.</p>
        </div>
        <div className="flex gap-2">
          {([['customer', 'Stiker Customer'], ['rider', 'Stiker Rider']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} className={cn('h-9 px-3 rounded-lg border text-sm font-semibold', mode === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background')}>{l}</button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-muted p-5 flex flex-wrap gap-4 justify-center">
        {mode === 'customer' ? labels.map((l, i) => (
          <iframe key={i} title={`Stiker ${i}`} className="bg-card shadow-lg rounded border-0" style={{ width: 200, height: 125 }}
            srcDoc={`<html><head><style>${head}body{zoom:1.05}.lbl{page-break-after:auto}</style></head><body>${l}</body></html>`} />
        )) : RIDER_SAMPLE.map((it, i) => (
          <div key={i} className="text-center space-y-1">
            <iframe title={`Rider ${i}`} className="bg-card shadow-lg rounded border-0" style={{ width: 290, height: 135 }}
              srcDoc={`<html><head><style>${STICKER_CSS.replace(/@page[^}]*}/, '')}body{zoom:2.2;padding:1mm}</style></head><body>${renderToStaticMarkup(<Sticker it={it} rider="Z-001 Agus" sd={today} qr="https://shorturl.at/d5luh" />)}</body></html>`} />
            <p className="text-xs text-muted-foreground">Masa simpan H+{it.shelf_life_days}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === 'customer'
          ? 'Customer: nomor antrean/meja, urutan cup, nama menu, catatan (es/gula/topping), nama & tipe pesanan, jam. Keluar otomatis atau via tombol "Stiker" setelah bayar.'
          : 'Rider: nama menu, nama singkat, harga jual, SD (produksi) & ED otomatis sesuai masa simpan menu, nama rider, QR. Cetak 1-klik dari antrean Order Stok Rider di Hub.'}
      </p>
    </section>
  );
};
