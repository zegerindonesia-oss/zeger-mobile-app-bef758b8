import { describeMenu } from '@/lib/menu-descriptions';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getModifierGroups, loadMasterModifierGroups, type ModifierGroup } from '@/lib/pos-modifiers';
import { ChevronLeft, Minus, Plus, ShoppingBag, CupSoda, Coffee, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/image-url';
import { artworkFor, cxArt, formatRupiah, onArtError } from '@/lib/customer-art';
import { pointsFor } from '@/lib/customer-pricing';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  custom_options: any;
  brand?: string | null;
  sub_category?: string | null;
  code?: string;
}

interface CustomerProductDetailProps {
  product: Product;
  orderType: 'dine-in' | 'take-away' | 'delivery';
  onBack: () => void;
  onAddToCart: (product: Product, quantity: number, customizations: any) => void;
  cartItemCount: number;
  onViewCart: () => void;
}

const isTempGroup = (g: ModifierGroup) => /suhu|temperat|hot|iced?\b/i.test(g.name) && g.options.every((o) => /ice|iced|hot|panas|dingin/i.test(o.name));

export function CustomerProductDetail({ product, onBack, onAddToCart, cartItemCount, onViewCart }: CustomerProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState<'hot' | 'cold'>('cold');
  const [notes, setNotes] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => { loadMasterModifierGroups(supabase).catch(() => null).finally(() => setReady(true)); }, []);

  const allGroups = useMemo(() => (ready ? getModifierGroups(product as any) : []), [ready, product]);
  const groups = useMemo(() => allGroups.filter((g) => !isTempGroup(g)), [allGroups]);
  const opts = (product.custom_options && typeof product.custom_options === 'object') ? product.custom_options : {};
  const showTemp = allGroups.some(isTempGroup) || !!opts.image_hot;

  const [picked, setPicked] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const init: Record<string, string[]> = {};
    groups.forEach((g) => { init[g.name] = g.default ? [g.default] : []; });
    setPicked(init);
  }, [groups]);

  const pick = (g: ModifierGroup, name: string) => setPicked((prev) => {
    const cur = prev[g.name] || [];
    if (g.multi) return { ...prev, [g.name]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] };
    if (!g.required && cur[0] === name) return { ...prev, [g.name]: [] };
    return { ...prev, [g.name]: [name] };
  });

  const modifiers = useMemo(() => groups.flatMap((g) => (picked[g.name] || []).map((n) => ({
    group: g.name, name: n, price: g.options.find((o) => o.name === n)?.price || 0,
  }))), [groups, picked]);
  const missing = groups.filter((g) => g.required && !(picked[g.name] || []).length);

  const unit = product.price + modifiers.reduce((s, m) => s + m.price, 0);
  const total = unit * quantity;
  const artFallback = temperature === 'hot' ? cxArt.cupHot : artworkFor(product);
  const variantImg = temperature === 'hot' ? opts.image_hot : opts.image_iced;
  const hero = normalizeImageUrl(variantImg) || normalizeImageUrl(product.image_url) || artFallback;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-36">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-b-3xl bg-white">
        <img key={hero} src={hero} onError={onArtError(artFallback)} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[hsl(var(--cx-shadow)/0.3)] to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <button onClick={onBack} aria-label="Kembali" className="cx-icon-btn h-9 w-9"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={onViewCart} aria-label="Keranjang" className="cx-icon-btn relative h-9 w-9">
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zeger px-1 text-[9px] font-semibold text-zeger-foreground ring-2 ring-white">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>

      <section className="px-4 pt-4">
        <h1 className="text-base font-semibold leading-snug">{product.name}</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{describeMenu(product.name, product.description)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="cx-num text-sm font-semibold text-zeger">{formatRupiah(unit)}</span>
          {pointsFor(total) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zeger-cream px-2 py-0.5 text-[10px] font-medium text-[hsl(30_60%_26%)]">
              <img src={cxArt.coin} alt="" aria-hidden className="h-3 w-3 object-contain" /> +{pointsFor(total)} Poin
            </span>
          )}
        </div>
      </section>

      <div className="space-y-4 px-4 pt-4">
        {showTemp && (
          <div className="flex gap-2">
            <button onClick={() => setTemperature('cold')} data-active={temperature === 'cold'} aria-label="Iced" className="cx-opt flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs">
              <CupSoda className="h-3.5 w-3.5" /> Iced
            </button>
            <button onClick={() => setTemperature('hot')} data-active={temperature === 'hot'} aria-label="Hot" className="cx-opt flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs">
              <Coffee className="h-3.5 w-3.5" /> Hot
            </button>
          </div>
        )}

        {groups.map((g) => (
          <Group key={g.name} title={g.name} required={g.required} hint={g.multi ? 'Bisa pilih lebih dari satu' : undefined}>
            <div className="flex flex-wrap gap-2">
              {g.options.map((o) => {
                const on = (picked[g.name] || []).includes(o.name);
                return (
                  <button key={o.name} onClick={() => pick(g, o.name)} data-active={on} className="cx-opt flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs">
                    {g.multi && on && <Check className="h-3 w-3" />}
                    {o.name}
                    {o.price > 0 && <span className={cn('cx-num text-[10px]', on ? 'text-white/85' : 'text-muted-foreground')}>+{formatRupiah(o.price)}</span>}
                  </button>
                );
              })}
            </div>
          </Group>
        ))}

        <Group title="Catatan" hint="Opsional">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Contoh: es terpisah"
            className="w-full resize-none rounded-xl border border-[hsl(var(--cx-line))] bg-white p-3 text-xs outline-none placeholder:text-muted-foreground focus:border-zeger" />
        </Group>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[hsl(var(--cx-line))] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--cx-rail))] p-1">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Kurangi" className="cx-icon-btn h-8 w-8 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
            <span className="cx-num min-w-[1rem] text-center text-sm font-semibold">{quantity}</span>
            <button onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="Tambah" className="cx-icon-btn h-8 w-8"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <button
            disabled={missing.length > 0}
            onClick={() => onAddToCart(product, quantity, { temperature: showTemp ? temperature : undefined, modifiers, notes: notes || undefined })}
            className="cx-btn cx-btn-primary flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
          >
            {missing.length ? `Pilih ${missing[0].name}` : <>Tambah · <span className="cx-num">{formatRupiah(total)}</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, hint, required, children }: { title: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {required && <span className="rounded-full bg-zeger-soft px-2 py-0.5 text-[10px] font-bold text-zeger">Wajib</span>}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default CustomerProductDetail;
