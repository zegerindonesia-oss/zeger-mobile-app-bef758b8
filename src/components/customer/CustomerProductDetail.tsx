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

/** Taste dots (1–5): manual custom_options.taste wins, else inferred from the menu name. */
function tasteProfile(product: { name: string }, opts: any): [string, number][] {
  const t = opts?.taste || {};
  const n = product.name.toLowerCase();
  const coffee = /americano|espresso|kopi|latte|mocha|coffee/.test(n);
  const milk = /latte|milk|creamy|susu|chocomalt|matcha|cookies/.test(n);
  const sweet = /aren|caramel|baileys|butterscotch|dolce|mocha|choco|cookies|lychee|lemonade|peach|sahabat/.test(n);
  const strength = t.strength ?? (/americano|espresso/.test(n) ? 4 : coffee ? 3 : 0);
  const rows: [string, number][] = [];
  if (strength) rows.push(['Coffee Strength', strength]);
  rows.push(['Sweetness', t.sweetness ?? (sweet ? 4 : 2)]);
  const cream = t.creaminess ?? (milk ? 3 : 0);
  if (cream) rows.push(['Creaminess', cream]);
  return rows;
}

export function CustomerProductDetail({ product, onBack, onAddToCart, cartItemCount, onViewCart }: CustomerProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState<'hot' | 'cold'>('cold');
  const [notes, setNotes] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => { loadMasterModifierGroups(supabase).catch(() => null).finally(() => setReady(true)); }, []);
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const collapsed = scrollY > 300;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white pb-36">
      {/* Sticky top bar: transparent over the photo, solid with the menu name once scrolled */}
      <div className={cn('fixed inset-x-0 top-0 z-40 mx-auto max-w-md transition-colors duration-200', collapsed ? 'border-b border-[hsl(var(--cx-line))] bg-white/95 backdrop-blur-xl' : 'bg-transparent')}>
        <div className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={onBack} aria-label="Kembali" className={cn('h-9 w-9 shrink-0', collapsed ? 'flex items-center justify-center' : 'cx-icon-btn')}><ChevronLeft className="h-5 w-5" /></button>
          <h2 className={cn('flex-1 truncate text-center text-[15px] font-semibold transition-all duration-200', collapsed ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0')}>{product.name}</h2>
          <button onClick={onViewCart} aria-label="Keranjang" className={cn('relative h-9 w-9 shrink-0', collapsed ? 'flex items-center justify-center' : 'cx-icon-btn')}>
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zeger px-1 text-[9px] font-semibold text-zeger-foreground ring-2 ring-white">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Full drink photo (zoomed out) with parallax */}
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        <img
          key={hero}
          src={hero}
          onError={onArtError(artFallback)}
          alt={product.name}
          style={{ transform: `translateY(${Math.min(scrollY, 400) * 0.4}px) scale(${1 - Math.min(scrollY, 400) / 4000})`, opacity: 1 - Math.min(scrollY, 400) / 600 }}
          className="absolute inset-0 h-full w-full object-contain px-6 pb-2 pt-12 will-change-transform"
        />
      </div>

      <section className="relative z-10 bg-white px-5 pt-5">
        <h1 className="text-lg font-semibold leading-snug">{product.name}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{describeMenu(product.name, product.description)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="cx-num text-sm font-semibold text-zeger">{formatRupiah(unit)}</span>
          {pointsFor(total) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zeger-cream px-2 py-0.5 text-[10px] font-medium text-[hsl(30_60%_26%)]">
              <img src={cxArt.coin} alt="" aria-hidden className="h-3 w-3 object-contain" /> +{pointsFor(total)} Poin
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1.5">
          {tasteProfile(product, opts).map(([label, v]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-28 text-[11px] text-muted-foreground">{label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cn('h-2 w-2 rounded-full', i <= v ? 'bg-zeger' : 'bg-[hsl(var(--cx-line))]')} />
                ))}
              </div>
            </div>
          ))}
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
          <Group key={g.name} title={g.name} required={g.required} hint={g.required ? 'Wajib, Pilih 1' : g.multi ? 'Optional, Bisa lebih dari 1' : 'Optional, Maksimal 1'}>
            <div className="divide-y divide-dashed divide-[hsl(var(--cx-line))]">
              {g.options.map((o) => {
                const on = (picked[g.name] || []).includes(o.name);
                return (
                  <button key={o.name} onClick={() => pick(g, o.name)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="flex-1 text-xs">{o.name}</span>
                    {o.price > 0 && <span className="cx-num text-[11px] text-muted-foreground">+{formatRupiah(o.price)}</span>}
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center border-2', g.multi ? 'rounded-md' : 'rounded-full', on ? 'border-zeger bg-zeger' : 'border-[hsl(var(--cx-line))]')}>
                      {on && (g.multi ? <Check className="h-2.5 w-2.5 text-zeger-foreground" /> : <span className="h-1.5 w-1.5 rounded-full bg-zeger-foreground" />)}
                    </span>
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
