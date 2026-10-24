import { describeMenu } from '@/lib/menu-descriptions';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Search, ShoppingBag, Store, Heart, MapPin, Loader2 } from 'lucide-react';

import { ACTIVE_KEY, upsertAddress, reverseGeocode, useAddresses } from '@/lib/customer-addresses';
import { AddressBook } from './AddressBook';
export const ADDR_KEY = ACTIVE_KEY;
import { useFavorites } from '@/lib/customer-favorites';
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
  brand?: string | null;
  sub_category?: string | null;
  custom_options: any;
}

interface CustomerMenuProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  outletId?: string;
  outletName?: string;
  outletAddress?: string;
  outletDistance?: string;
  onChangeOutlet?: () => void;
  onBack?: () => void;
  orderMode?: 'pickup' | 'delivery';
  onOrderModeChange?: (mode: 'pickup' | 'delivery') => void;
  cartItemCount: number;
  onViewCart: () => void;
  cart: any[];
}

const brandOf = (p: Product) => (p.brand || '').trim() || 'Zeger';
const catOf = (p: Product) => (p.sub_category || p.category || 'Lainnya').trim();

export function CustomerMenu({
  products,
  onAddToCart,
  outletName,
  outletAddress,
  outletDistance,
  onChangeOutlet,
  onBack,
  orderMode = 'pickup',
  onOrderModeChange,
  onViewCart,
  cart = [],
}: CustomerMenuProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const { ids: favIds, isFav, toggle } = useFavorites();

  const brands = useMemo(() => {
    const seen: string[] = [];
    products.forEach((p) => { const b = brandOf(p); if (!seen.includes(b)) seen.push(b); });
    return ['all', ...seen];
  }, [products]);

  const categories = useMemo(() => {
    const seen: string[] = [];
    products.forEach((p) => {
      if (brand !== 'all' && brandOf(p) !== brand) return;
      const c = catOf(p);
      if (!seen.includes(c)) seen.push(c);
    });
    return ['all', ...seen];
  }, [products, brand]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const inBrand = brand === 'all' || brandOf(p) === brand;
      const inCat = category === 'all' || (category === 'fav' ? favIds.includes(p.id) : catOf(p) === category);
      const inSearch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      return inBrand && inCat && inSearch;
    });
  }, [products, search, category, brand, favIds]);

  const favProducts = useMemo(
    () => favIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [favIds, products],
  );
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    visible.forEach((p) => { const c = catOf(p); m.set(c, [...(m.get(c) || []), p]); });
    return Array.from(m.entries());
  }, [visible]);

  const totalItems = countItems(cart);
  const totalPrice = cartSubtotal(cart);

  const { active: addr } = useAddresses();
  const [locating, setLocating] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        upsertAddress({ label: 'Lokasi Saat Ini', address: await reverseGeocode(lat, lng), lat, lng }, true);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const switchMode = (m: 'pickup' | 'delivery') => {
    onOrderModeChange?.(m);
    if (m === 'delivery' && !addr) locate();
  };

  const [scrollY, setScrollY] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrollY(window.scrollY);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const collapsed = scrollY > 120;
  const modeLabel = orderMode === 'pickup' ? 'Pick Up' : 'Delivery';

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[hsl(var(--cx-canvas))] pb-40">
      <AddressBook open={bookOpen} onClose={() => setBookOpen(false)} />

      {/* Compact bar (appears after scrolling) */}
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-40 mx-auto max-w-md bg-card px-3 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] shadow-[0_2px_10px_hsl(var(--cx-shadow)/0.08)] transition-all duration-300',
          collapsed ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0',
        )}
      >
        <div className="flex items-center gap-1">
          {onBack && (
            <button onClick={onBack} aria-label="Kembali" className="flex h-9 w-9 shrink-0 items-center justify-center">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <button onClick={onChangeOutlet} className="min-w-0 flex-1 text-left">
            <span className="block text-[11px] text-muted-foreground">{modeLabel}</span>
            <span className="flex items-center gap-1 text-[15px] font-semibold leading-tight">
              <span className="truncate">{outletName || 'Pilih outlet'}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </span>
            {outletDistance && (
              <span className="block text-[11px] text-muted-foreground">{outletDistance} · <span className="font-semibold text-zeger">Terdekat</span></span>
            )}
          </button>
        </div>
      </div>

      {/* Hero with parallax */}
      <section className="relative overflow-hidden bg-zeger pb-12 pt-[calc(env(safe-area-inset-top)+12px)] text-primary-foreground">
        <div
          className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-primary-foreground/5"
          style={{ transform: `translateY(${scrollY * 0.4}px)` }}
        />
        <div
          className="relative px-4"
          style={{ transform: `translateY(${scrollY * 0.35}px)`, opacity: Math.max(0, 1 - scrollY / 140) }}
        >
          <div className="relative flex items-center justify-center">
            {onBack && (
              <button onClick={onBack} aria-label="Kembali" className="absolute left-0 flex h-9 w-9 items-center justify-center">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-base font-semibold">Zeger Coffee</h1>
          </div>
          <div className="mt-3 flex justify-center">
            <div className="flex rounded-full bg-card p-1">
              {(['pickup', 'delivery'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'rounded-full px-5 py-1.5 text-[13px] transition-all',
                    orderMode === m ? 'bg-zeger-soft font-semibold text-zeger ring-1 ring-zeger' : 'font-medium text-muted-foreground',
                  )}
                >
                  {m === 'pickup' ? 'Pick Up' : 'Delivery'}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-medium opacity-80">Grind the Essentials</p>
        </div>
      </section>

      {/* Outlet card overlapping hero */}
      <div className="relative z-10 -mt-8 px-4">
        <div className="rounded-2xl bg-card px-3 shadow-[0_4px_16px_hsl(var(--cx-shadow)/0.1)]">
          <button onClick={onChangeOutlet} className="flex w-full items-center gap-3 py-3 text-left">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zeger-soft">
              <Store className="h-[18px] w-[18px] text-zeger" />
              {orderMode === 'delivery' && <span className="absolute left-1/2 top-full h-6 -translate-x-1/2 border-l border-dotted border-muted-foreground/60" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{outletName || 'Pilih outlet'}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {outletDistance ? <>{outletDistance} · <span className="font-semibold text-zeger">Terdekat</span></> : outletAddress || 'Outlet terdekat'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          {orderMode === 'delivery' && (
            <button onClick={() => setBookOpen(true)} className="flex w-full items-center gap-3 border-t border-[hsl(var(--cx-line))] py-3 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                {locating ? <Loader2 className="h-[18px] w-[18px] animate-spin text-destructive" /> : <MapPin className="h-[18px] w-[18px] text-destructive" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight">{addr?.label || 'Atur alamat pengantaran'}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                  {locating ? 'Mendeteksi lokasimu…' : addr?.address || 'Ketuk untuk pilih / tambah alamat'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {brands.length > 2 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => { setBrand(b); setCategory('all'); }}
              data-active={brand === b}
              className="cx-chip shrink-0 px-3.5 py-1.5 text-xs font-medium"
            >
              {b === 'all' ? 'Semua Brand' : b}
            </button>
          ))}
        </div>
      )}

      {/* Sticky category chips */}
      <div className={cn('sticky z-30 bg-[hsl(var(--cx-canvas))] py-2 transition-[top] duration-300', collapsed ? 'top-[72px]' : 'top-0')}>
        {searchOpen ? (
          <div className="relative px-4">
            <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => { if (!search) setSearchOpen(false); }}
              placeholder="Cari menu favoritmu"
              className="h-10 w-full rounded-full border border-[hsl(var(--cx-line))] bg-card pl-10 pr-4 text-sm outline-none focus:border-zeger"
            />
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCategory(category === 'fav' ? 'all' : 'fav')}
              data-active={category === 'fav'}
              aria-label="Favoritku"
              className="cx-chip shrink-0 px-3.5 py-1.5"
            >
              <Heart className={cn('h-4 w-4', category === 'fav' ? 'fill-current' : 'fill-destructive text-destructive')} />
            </button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} data-active={category === c} className="cx-chip shrink-0 px-3.5 py-1.5 text-xs">
                {c === 'all' ? 'Semua' : c}
              </button>
            ))}
            <button onClick={() => setSearchOpen(true)} aria-label="Cari menu" className="cx-chip shrink-0 px-3.5 py-1.5">
              <Search className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* My Favorite */}
      {category !== 'fav' && !search && (
        <section className="pt-4">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-base font-semibold">My Favorite</h2>
            {favProducts.length > 0 && (
              <button onClick={() => setCategory('fav')} className="text-xs font-bold text-zeger">Lihat Semua</button>
            )}
          </div>
          {favProducts.length === 0 ? (
            <p className="mx-4 mt-2 rounded-2xl border border-dashed border-[hsl(var(--cx-line))] bg-white px-4 py-3 text-xs text-muted-foreground">
              Tekan ikon <Heart className="inline h-3.5 w-3.5 text-destructive" /> di menu untuk menyimpan favoritmu di sini.
            </p>
          ) : (
            <div className="mt-2.5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {favProducts.map((p) => (
                <div key={p.id} className="cx-card relative flex w-[78%] max-w-[290px] shrink-0 snap-start items-center gap-3 rounded-[20px] p-2.5">
                  <button onClick={() => onAddToCart(p)} className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-2xl bg-white">
                    <img src={normalizeImageUrl(p.image_url) || artworkFor(p)} onError={onArtError(artworkFor(p))} alt={p.name} loading="lazy" className="h-full w-full object-contain" />
                  </button>
                  <button onClick={() => onAddToCart(p)} className="min-w-0 flex-1 text-left">
                    <span className="line-clamp-2 block pr-6 text-[13px] font-medium leading-snug">{p.name}</span>
                    <span className="cx-num mt-1 block text-sm font-semibold">{formatRupiah(p.price)}</span>
                  </button>
                  <HeartBtn on onClick={() => toggle(p.id)} className="absolute right-2 top-2" />
                  <button onClick={() => onAddToCart(p)} aria-label={`Tambah ${p.name}`} className="cx-btn cx-btn-primary absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center">
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Menu grouped by category */}
      {visible.length === 0 ? (
        <div className="cx-card mx-4 mt-5 flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
          {category === 'fav' ? <Heart className="h-10 w-10 text-muted-foreground" /> : <Search className="h-10 w-10 text-muted-foreground" />}
          <p className="mt-3 text-sm font-bold">{category === 'fav' ? 'Belum ada favorit' : 'Menu tidak ditemukan'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{category === 'fav' ? 'Tekan ikon hati di menu yang kamu suka.' : 'Coba kata kunci atau kategori lain.'}</p>
        </div>
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="mt-3 border-t-[6px] border-[hsl(var(--cx-rail))] px-4 pt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{cat}</h2>
              <span className="text-xs text-muted-foreground">{items.length} item</span>
            </div>
            <div className="divide-y divide-dashed divide-[hsl(var(--cx-line))]">
              {items.map((p) => (
                <article key={p.id} className="flex gap-3 py-3.5">
                  <button onClick={() => onAddToCart(p)} className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm">
                    <img src={normalizeImageUrl(p.image_url) || artworkFor(p)} onError={onArtError(artworkFor(p))} alt={p.name} loading="lazy" className="h-full w-full object-contain" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-2">
                      <button onClick={() => onAddToCart(p)} className="min-w-0 flex-1 text-left">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
                      </button>
                      <HeartBtn on={isFav(p.id)} onClick={() => toggle(p.id)} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{describeMenu(p.name, p.description)}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="cx-num text-sm font-semibold">{formatRupiah(p.price)}</span>
                      <button onClick={() => onAddToCart(p)} aria-label={`Tambah ${p.name}`} className="cx-btn cx-btn-primary flex h-8 w-8 items-center justify-center">
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
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

function HeartBtn({ on, onClick, className }: { on: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={on ? 'Hapus dari favorit' : 'Tambah ke favorit'}
      aria-pressed={on}
      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90', className)}
    >
      <Heart className={cn('h-5 w-5', on ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
    </button>
  );
}

export default CustomerMenu;
