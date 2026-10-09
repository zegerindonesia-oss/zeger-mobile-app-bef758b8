import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, Search, ShoppingBag, Store, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/image-url';
import { artworkFor, formatRupiah, onArtError } from '@/lib/customer-art';
import { cartItemCount as countItems, cartSubtotal } from '@/lib/customer-pricing';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  custom_options: any;
}

interface CustomerMenuProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  outletId?: string;
  outletName?: string;
  outletAddress?: string;
  onChangeOutlet?: () => void;
  onBack?: () => void;
  orderMode?: 'pickup' | 'delivery';
  cartItemCount: number;
  onViewCart: () => void;
  cart: any[];
}

export function CustomerMenu({
  products,
  onAddToCart,
  outletName,
  outletAddress,
  onChangeOutlet,
  onBack,
  orderMode = 'pickup',
  onViewCart,
  cart = [],
}: CustomerMenuProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categories = useMemo(() => {
    const seen: string[] = [];
    products.forEach((p) => {
      const c = (p.category || 'Lainnya').trim();
      if (!seen.includes(c)) seen.push(c);
    });
    return ['all', ...seen];
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const inCat = category === 'all' || (p.category || 'Lainnya').trim() === category;
      const inSearch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      return inCat && inSearch;
    });
  }, [products, search, category]);

  const featured = useMemo(() => products.find((p) => p.image_url) || products[0], [products]);
  const totalItems = countItems(cart);
  const totalPrice = cartSubtotal(cart);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-40">
      {/* Header */}
      <header className="cx-bar sticky top-0 z-20 px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} aria-label="Kembali" className="cx-icon-btn h-10 w-10 shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onChangeOutlet}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left shadow-[0_1px_2px_hsl(var(--cx-shadow)/0.06)] transition-transform active:scale-[0.98]"
          >
            <Store className="h-[18px] w-[18px] shrink-0 text-zeger" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold leading-tight">{outletName || 'Pilih outlet'}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {orderMode === 'delivery' ? 'Delivery' : 'Pick Up'}{outletAddress ? ` · ${outletAddress}` : ''}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-zeger">Ubah</span>
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu favoritmu"
            className="h-11 w-full rounded-2xl border border-[hsl(var(--cx-line))] bg-white pl-11 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-zeger focus:shadow-[0_0_0_4px_hsl(var(--zeger)/0.12)]"
          />
        </div>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              data-active={category === c}
              className="cx-chip shrink-0 px-4 py-2 text-xs"
            >
              {c === 'all' ? 'Semua' : c}
            </button>
          ))}
        </div>
      </header>

      {/* Daily special */}
      {featured && category === 'all' && !search && (
        <section className="px-4 pt-4">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold">
            Pilihan Hari Ini <Sparkles className="h-4 w-4 text-zeger-gold" />
          </h2>
          <div className="cx-card cx-stage-dark cx-rise mt-2.5 flex items-center gap-3 overflow-hidden rounded-[26px] p-4">
            <div className="min-w-0 flex-1 text-white">
              <p className="truncate text-lg font-extrabold leading-tight">{featured.name}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-white/80">
                {featured.description || 'Racikan spesial Zeger, nikmat disajikan kapan saja.'}
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="cx-num text-base font-extrabold">{formatRupiah(featured.price)}</span>
                <button onClick={() => onAddToCart(featured)} className="cx-btn cx-btn-gold px-4 py-1.5 text-xs">
                  Pesan
                </button>
              </div>
            </div>
            <img
              src={normalizeImageUrl(featured.image_url) || artworkFor(featured)}
              onError={onArtError(artworkFor(featured))}
              alt={featured.name}
              loading="lazy"
              className="cx-art cx-float h-[104px] w-[86px] shrink-0 object-contain"
            />
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="px-4 pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-extrabold">{category === 'all' ? 'Semua Menu' : category}</h2>
          <span className="text-xs text-muted-foreground">{visible.length} item</span>
        </div>

        {visible.length === 0 ? (
          <div className="cx-card mt-3 flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Menu tidak ditemukan</p>
            <p className="mt-1 text-xs text-muted-foreground">Coba kata kunci atau kategori lain.</p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {visible.map((p) => (
              <article key={p.id} className="cx-card flex flex-col overflow-hidden rounded-[22px]">
                <button onClick={() => onAddToCart(p)} className="cx-stage block aspect-square overflow-hidden text-left">
                  <img
                    src={normalizeImageUrl(p.image_url) || artworkFor(p)}
                    onError={onArtError(artworkFor(p))}
                    alt={p.name}
                    loading="lazy"
                    className="cx-art cx-tilt h-full w-full object-contain p-3"
                  />
                </button>
                <div className="flex flex-1 flex-col p-3">
                  <button onClick={() => onAddToCart(p)} className="text-left">
                    <h3 className="line-clamp-2 min-h-[2.2rem] text-[13px] font-extrabold leading-snug">{p.name}</h3>
                  </button>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2.5">
                    <span className="cx-num text-sm font-extrabold text-zeger">{formatRupiah(p.price)}</span>
                    <button
                      onClick={() => onAddToCart(p)}
                      aria-label={`Tambah ${p.name}`}
                      className="cx-btn cx-btn-primary flex h-9 w-9 items-center justify-center"
                    >
                      <Plus className="h-[18px] w-[18px]" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Floating cart bar */}
      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-[78px] z-30 px-4 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={onViewCart}
            className="cx-btn cx-btn-primary cx-pop-in mx-auto flex w-full max-w-md items-center gap-3 rounded-[22px] px-4 py-3 text-left"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/18">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-zeger">
                {totalItems}
              </span>
            </span>
            <span className="flex-1">
              <span className="block text-[11px] font-semibold opacity-85">Total belanja</span>
              <span className="cx-num block text-base font-extrabold">{formatRupiah(totalPrice)}</span>
            </span>
            <span className="rounded-full bg-white/18 px-4 py-2 text-xs font-extrabold">Lihat Pesanan</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerMenu;
