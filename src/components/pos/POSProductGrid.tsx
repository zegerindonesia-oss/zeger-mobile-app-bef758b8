import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, Plus, PackageOpen } from 'lucide-react';
import { POSCartItem } from '@/hooks/usePOSCart';
import { POSBundleCard, BundleData } from './POSBundleCard';
import { POSCustomItemDialog } from './POSCustomItemDialog';
import { POSModifierDialog } from './POSModifierDialog';
import { getModifierGroups, loadMasterModifierGroups } from '@/lib/pos-modifiers';
import type { AddItemOptions } from '@/hooks/usePOSCart';
import { Star3D } from './Star3D';

const FAV = '__favorit__';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  brand?: string | null;
  sub_category?: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  custom_options?: any;
  track_stock?: boolean | null;
  is_pos_favorite?: boolean | null;
}

interface InventoryRow {
  product_id: string | null;
  stock_quantity: number | null;
}

interface Props {
  branchId: string | null;
  onAdd: (p: Omit<POSCartItem, 'qty' | 'discount_item' | 'notes' | 'line_id' | 'modifiers'>, opts?: AddItemOptions) => void;
  onAddBundle: (b: BundleData) => void;
  onAddCustom: (d: { name: string; price: number; qty: number; notes: string }) => void;
  toolbar?: React.ReactNode;
  hiddenProductIds?: string[];
}

const toCartProduct = (p: Product) => ({
  product_id: p.id, product_code: p.code, product_name: p.name,
  category: p.category, price: Number(p.price), image_url: p.image_url,
});

export const POSProductGrid = ({ branchId, onAdd, onAddBundle, onAddCustom, toolbar, hiddenProductIds = [] }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<BundleData[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Semua');
  const [activeBrand, setActiveBrand] = useState<string>('Semua Brand');
  const [loading, setLoading] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [modProduct, setModProduct] = useState<Product | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadMasterModifierGroups(supabase).catch(() => null);
      const [prodRes, bundleRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, code, name, category, brand, sub_category, price, image_url, is_active, custom_options, track_stock, is_pos_favorite, modifier_group_ids' as any)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pos_bundles')
          .select('id, name, description, price, components, image_url, applicable_branch_ids')
          .eq('is_active', true),
      ]);

      setProducts((prodRes.data || []) as unknown as Product[]);

      // Filter bundles for branch + enrich component names
      const allBundles = (bundleRes.data || []) as any[];
      const validBundles = allBundles.filter((b) => {
        if (!branchId) return true;
        const arr = Array.isArray(b.applicable_branch_ids) ? b.applicable_branch_ids : [];
        return arr.length === 0 || arr.includes(branchId);
      });

      // Get product names for components
      const allComponentIds = Array.from(
        new Set(
          validBundles.flatMap((b) =>
            Array.isArray(b.components) ? b.components.map((c: any) => c.product_id) : []
          )
        )
      );
      let nameMap: Record<string, string> = {};
      if (allComponentIds.length > 0) {
        const { data: compProds } = await supabase
          .from('products')
          .select('id, name')
          .in('id', allComponentIds);
        compProds?.forEach((p) => (nameMap[p.id] = p.name));
      }

      setBundles(
        validBundles.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          price: Number(b.price),
          image_url: b.image_url,
          components: (Array.isArray(b.components) ? b.components : []).map((c: any) => ({
            product_id: c.product_id,
            qty: c.qty,
            product_name: nameMap[c.product_id] || 'Item',
          })),
        }))
      );

      if (branchId) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('product_id, stock_quantity')
          .eq('branch_id', branchId);
        const map: Record<string, number> = {};
        (inv as InventoryRow[] | null)?.forEach((r) => {
          if (r.product_id) map[r.product_id] = r.stock_quantity || 0;
        });
        setInventory(map);
      }
      setLoading(false);
    };
    load();
  }, [branchId]);

  // Favorites: master flag from Data Master + per-branch cashier overrides (stored on this device)
  const favKey = `pos_fav_overrides_${branchId || 'all'}`;
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setFavOverrides(JSON.parse(localStorage.getItem(favKey) || '{}')); } catch { setFavOverrides({}); }
  }, [favKey]);
  const isFav = useCallback(
    (p: Product) => (p.id in favOverrides ? favOverrides[p.id] : !!p.is_pos_favorite),
    [favOverrides]
  );
  const toggleFav = (p: Product) => {
    const next = { ...favOverrides, [p.id]: !isFav(p) };
    if (next[p.id] === !!p.is_pos_favorite) delete next[p.id];
    setFavOverrides(next);
    localStorage.setItem(favKey, JSON.stringify(next));
  };

  const visible = useMemo(
    () => products.filter((p) => !hiddenProductIds.includes(p.id)),
    [products, hiddenProductIds]
  );
  const catOf = (p: Product) => p.sub_category || p.category || 'Lainnya';
  const brands = useMemo(() => {
    const set = new Set<string>();
    visible.forEach((p) => p.brand && set.add(p.brand));
    return Array.from(set).sort();
  }, [visible]);
  const brandProducts = useMemo(
    () => (activeBrand === 'Semua Brand' ? visible : visible.filter((p) => p.brand === activeBrand)),
    [visible, activeBrand]
  );
  const catCounts = useMemo(() => {
    const m: Record<string, number> = { Semua: brandProducts.length };
    brandProducts.forEach((p) => { const c = catOf(p); m[c] = (m[c] || 0) + 1; });
    return m;
  }, [brandProducts]);
  const categories = useMemo(() => {
    const cats = ['Semua', ...Object.keys(catCounts).filter((c) => c !== 'Semua')];
    if (bundles.length > 0 && activeBrand === 'Semua Brand') cats.push('Bundle');
    return cats;
  }, [catCounts, bundles, activeBrand]);

  const favCount = useMemo(() => brandProducts.filter(isFav).length, [brandProducts, isFav]);

  const filteredProducts = useMemo(() => {
    if (activeCat === 'Bundle') return [];
    const q = search.toLowerCase();
    // Search spans all brands so cashiers can find anything instantly
    const base = search ? visible : brandProducts;
    return base.filter((p) => {
      const matchCat = search || activeCat === 'Semua' || (activeCat === FAV ? isFav(p) : catOf(p) === activeCat);
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [visible, brandProducts, activeCat, search, isFav]);

  const filteredBundles = useMemo(() => {
    if (activeCat !== 'Semua' && activeCat !== 'Bundle') return [];
    return bundles.filter((b) =>
      !search || b.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [bundles, activeCat, search]);

  const stockBadge = (qty: number) => {
    if (qty <= 0) return <Badge variant="destructive" className="rounded-lg text-[9px]">Habis</Badge>;
    if (qty <= 5) return <Badge variant="secondary" className="rounded-lg text-[9px]">Sisa {qty}</Badge>;
    return <Badge className="rounded-lg bg-success/10 text-success hover:bg-success/15 text-[9px] shadow-none">Tersedia</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 md:p-4 border-b border-border/60 space-y-3 bg-card/70 backdrop-blur-xl">
        {toolbar}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari menu (nama / kode)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background/80 border-border/70 shadow-inner"
            />
          </div>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setCustomOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Custom
          </Button>
        </div>
        {brands.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
            {['Semua Brand', ...brands].map((b) => (
              <Button
                key={b}
                size="sm"
                variant={activeBrand === b ? 'default' : 'outline'}
                onClick={() => { setActiveBrand(b); setActiveCat('Semua'); }}
                className="flex-shrink-0 px-5 h-10 rounded-full font-semibold"
              >
                {b}
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
          <Button
            size="sm"
            variant={activeCat === FAV ? 'default' : 'outline'}
            onClick={() => setActiveCat(FAV)}
            className="pos-fav-tab flex-shrink-0 px-4 rounded-full gap-1.5"
          >
            <Star3D key={String(activeCat === FAV)} size={18} />
            Favorit
            <span className="text-[10px] opacity-70">{favCount}</span>
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={activeCat === c ? 'default' : 'outline'}
              onClick={() => setActiveCat(c)}
              className="flex-shrink-0 px-4 rounded-full"
            >
              {c}
              {catCounts[c] != null && <span className="ml-1.5 text-[10px] opacity-70">{catCounts[c]}</span>}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scroll">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Memuat menu...</div>
        ) : filteredProducts.length === 0 && filteredBundles.length === 0 ? (
          <div className="h-full min-h-52 flex flex-col items-center justify-center text-muted-foreground">
            <PackageOpen className="h-8 w-8 mb-2 opacity-40" />
            <span>Tidak ada menu</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5">
            {filteredBundles.map((b) => (
              <POSBundleCard key={b.id} bundle={b} onAdd={onAddBundle} />
            ))}
            {filteredProducts.map((p) => {
              const qty = inventory[p.id] ?? 0;
              const unlimited = p.track_stock === false;
              const disabled = branchId && !unlimited ? qty <= 0 : false;
              return (
                <Card
                  key={p.id}
                  className={`pos-product-card group relative p-2 cursor-pointer rounded-2xl overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => {
                    if (getModifierGroups(p).length > 0) return setModProduct(p);
                    onAdd(toCartProduct(p));
                  }}
                >
                  <button
                    type="button"
                    aria-label={isFav(p) ? 'Hapus dari favorit' : 'Tandai favorit'}
                    onClick={(e) => { e.stopPropagation(); toggleFav(p); }}
                    className={`pos-fav-pin pointer-events-auto absolute top-3 right-3 z-10 h-8 w-8 rounded-full flex items-center justify-center bg-card/85 backdrop-blur shadow-md transition-opacity ${isFav(p) ? 'opacity-100' : 'opacity-70 md:opacity-0 group-hover:opacity-100'}`}
                  >
                    <Star3D key={String(isFav(p))} size={20} active={isFav(p)} />
                  </button>
                  {p.image_url ? (
                    <div className="h-20 w-full bg-muted rounded-xl overflow-hidden mb-2">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    </div>
                  ) : (
                    <div className="h-20 w-full bg-muted/70 rounded-xl mb-2 flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="text-xs font-bold line-clamp-2 leading-snug min-h-8">{p.name}</div>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <div className="pos-number text-xs font-bold text-primary">
                      Rp{Number(p.price).toLocaleString('id-ID')}
                    </div>
                    <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  {branchId && <div className="mt-1">{unlimited ? <span className="text-[10px] font-semibold text-muted-foreground">∞ Unlimited</span> : stockBadge(qty)}</div>}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <POSModifierDialog
        product={modProduct}
        onClose={() => setModProduct(null)}
        onConfirm={(opts) => { if (modProduct) onAdd(toCartProduct(modProduct), opts); setModProduct(null); }}
      />

      <POSCustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={onAddCustom}
      />
    </div>
  );
};
