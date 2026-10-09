import { useMemo, useState } from 'react';
import { ChevronLeft, Minus, Plus, ShoppingBag, Flame, Snowflake, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/image-url';
import { artworkFor, cxArt, formatRupiah, onArtError } from '@/lib/customer-art';
import { SIZE_UPCHARGE, TOPPING_PRICES, pointsFor } from '@/lib/customer-pricing';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  custom_options: any;
}

interface CustomerProductDetailProps {
  product: Product;
  orderType: 'dine-in' | 'take-away' | 'delivery';
  onBack: () => void;
  onAddToCart: (product: Product, quantity: number, customizations: any) => void;
  cartItemCount: number;
  onViewCart: () => void;
}

const SIZES = [
  { id: '200ml', label: '200 ml', hint: 'Standar' },
  { id: '1lt', label: '1 Liter', hint: 'Botol' },
  { id: 'small', label: 'Small', hint: 'Reguler' },
  { id: 'large', label: 'Large', hint: 'Lebih banyak' },
] as const;

const ICE = [
  { id: 'normal', label: 'Normal' },
  { id: 'less', label: 'Sedikit' },
  { id: 'no-ice', label: 'Tanpa Es' },
] as const;

const SUGAR = [
  { id: 'normal', label: 'Normal' },
  { id: 'less', label: 'Sedikit' },
  { id: 'no-sugar', label: 'Tanpa Gula' },
] as const;

const TOPPINGS = [
  { id: 'espresso', name: 'Extra Espresso Shot' },
  { id: 'oreo', name: 'Oreo Crumb' },
  { id: 'cheese', name: 'Cheese Cream' },
  { id: 'jelly', name: 'Jelly Pearl' },
  { id: 'icecream', name: 'Ice Cream' },
];

export function CustomerProductDetail({ product, onBack, onAddToCart, cartItemCount, onViewCart }: CustomerProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState<'hot' | 'cold'>('cold');
  const [size, setSize] = useState<string>('200ml');
  const [iceLevel, setIceLevel] = useState<string>('normal');
  const [sugarLevel, setSugarLevel] = useState<string>('normal');
  const [toppings, setToppings] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const unit = useMemo(() => {
    let p = product.price + (SIZE_UPCHARGE[size] || 0);
    toppings.forEach((t) => { p += TOPPING_PRICES[t] || 0; });
    return p;
  }, [product.price, size, toppings]);

  const total = unit * quantity;
  const artFallback = temperature === 'hot' ? cxArt.cupHot : artworkFor(product);
  const hero = normalizeImageUrl(product.image_url) || artFallback;

  const toggleTopping = (id: string) =>
    setToppings((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-44">
      {/* Hero */}
      <div className="cx-stage relative h-[300px] overflow-hidden rounded-b-[34px]">
        <img
          key={hero}
          src={hero}
          onError={onArtError(artFallback)}
          alt={product.name}
          className="cx-art cx-float absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 object-contain"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <button onClick={onBack} aria-label="Kembali" className="cx-icon-btn h-11 w-11">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={onViewCart} aria-label="Keranjang" className="cx-icon-btn relative h-11 w-11">
            <ShoppingBag className="h-[18px] w-[18px]" />
            {cartItemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zeger px-1 text-[10px] font-bold text-zeger-foreground ring-2 ring-white">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Title */}
      <section className="px-4 pt-5">
        <h1 className="text-2xl font-extrabold leading-tight">{product.name}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {product.description || 'Racikan kopi berkualitas khas Zeger, diseduh segar untukmu.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="cx-num text-xl font-extrabold text-zeger">{formatRupiah(unit)}</span>
          {pointsFor(total) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zeger-cream px-3 py-1 text-[11px] font-bold text-[hsl(30_60%_26%)]">
              <img src={cxArt.coin} alt="" aria-hidden className="h-4 w-4 object-contain" width={640} height={640} />
              Dapat {pointsFor(total)} Zeger Poin
            </span>
          )}
        </div>
      </section>

      <div className="space-y-5 px-4 pt-6">
        {/* Temperature */}
        <Group title="Suhu" required>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setTemperature('cold')} data-active={temperature === 'cold'} className="cx-opt flex items-center justify-center gap-2 py-3.5 text-sm">
              <Snowflake className="h-[18px] w-[18px]" /> Iced
            </button>
            <button onClick={() => setTemperature('hot')} data-active={temperature === 'hot'} className="cx-opt flex items-center justify-center gap-2 py-3.5 text-sm">
              <Flame className="h-[18px] w-[18px]" /> Hot
            </button>
          </div>
        </Group>

        {/* Size */}
        <Group title="Ukuran" required>
          <div className="grid grid-cols-2 gap-2.5">
            {SIZES.map((s) => (
              <button key={s.id} onClick={() => setSize(s.id)} data-active={size === s.id} className="cx-opt px-3 py-3 text-left">
                <span className="block text-sm font-bold leading-tight">{s.label}</span>
                <span className={cn('mt-0.5 block text-[11px] leading-tight', size === s.id ? 'text-white/80' : 'text-muted-foreground')}>
                  {SIZE_UPCHARGE[s.id] ? `+${formatRupiah(SIZE_UPCHARGE[s.id])}` : s.hint}
                </span>
              </button>
            ))}
          </div>
        </Group>

        {/* Ice */}
        {temperature === 'cold' && (
          <Group title="Level Es">
            <div className="grid grid-cols-3 gap-2.5">
              {ICE.map((o) => (
                <button key={o.id} onClick={() => setIceLevel(o.id)} data-active={iceLevel === o.id} className="cx-opt py-3 text-xs">
                  {o.label}
                </button>
              ))}
            </div>
          </Group>
        )}

        {/* Sugar */}
        <Group title="Level Gula">
          <div className="grid grid-cols-3 gap-2.5">
            {SUGAR.map((o) => (
              <button key={o.id} onClick={() => setSugarLevel(o.id)} data-active={sugarLevel === o.id} className="cx-opt py-3 text-xs">
                {o.label}
              </button>
            ))}
          </div>
        </Group>

        {/* Toppings */}
        <Group title="Topping" hint="Opsional, bisa pilih lebih dari satu">
          <div className="space-y-2.5">
            {TOPPINGS.map((t) => {
              const on = toppings.includes(t.id);
              return (
                <button key={t.id} onClick={() => toggleTopping(t.id)} data-active={on} className="cx-opt flex w-full items-center gap-3 px-3.5 py-3 text-left">
                  <span
                    className={cn(
                      'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
                      on ? 'border-white bg-white text-zeger' : 'border-[hsl(var(--cx-line))] bg-white',
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                  </span>
                  <span className="flex-1 text-sm font-semibold">{t.name}</span>
                  <span className={cn('cx-num text-xs font-bold', on ? 'text-white' : 'text-zeger')}>
                    +{formatRupiah(TOPPING_PRICES[t.id])}
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        {/* Notes */}
        <Group title="Catatan untuk barista" hint="Opsional">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Contoh: gula sedikit saja, es terpisah"
            className="w-full resize-none rounded-2xl border border-[hsl(var(--cx-line))] bg-white p-3.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-zeger focus:shadow-[0_0_0_4px_hsl(var(--zeger)/0.12)]"
          />
        </Group>
      </div>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[hsl(var(--cx-line))] bg-white/92 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full bg-[hsl(var(--cx-rail))] p-1">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Kurangi"
              className="cx-icon-btn h-9 w-9 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="cx-num min-w-[1.25rem] text-center text-base font-extrabold">{quantity}</span>
            <button onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="Tambah" className="cx-icon-btn h-9 w-9">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => onAddToCart(product, quantity, { temperature, size, iceLevel, sugarLevel, toppings, notes })}
            className="cx-btn cx-btn-primary flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm"
          >
            Tambah · <span className="cx-num">{formatRupiah(total)}</span>
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
        <h2 className="text-sm font-extrabold">{title}</h2>
        {required && <span className="rounded-full bg-zeger-soft px-2 py-0.5 text-[10px] font-bold text-zeger">Wajib</span>}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default CustomerProductDetail;
