import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, Plus } from 'lucide-react';
import { POSCartItem } from '@/hooks/usePOSCart';
import { POSBundleCard, BundleData } from './POSBundleCard';
import { POSCustomItemDialog } from './POSCustomItemDialog';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
}

interface InventoryRow {
  product_id: string | null;
  stock_quantity: number | null;
}

interface Props {
  branchId: string | null;
  onAdd: (p: Omit<POSCartItem, 'qty' | 'discount_item' | 'notes'>) => void;
  onAddBundle: (b: BundleData) => void;
  onAddCustom: (d: { name: string; price: number; qty: number; notes: string }) => void;
}

export const POSProductGrid = ({ branchId, onAdd, onAddBundle, onAddCustom }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<BundleData[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [prodRes, bundleRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, code, name, category, price, image_url, is_active')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pos_bundles')
          .select('id, name, description, price, components, image_url, applicable_branch_ids')
          .eq('is_active', true),
      ]);

      setProducts((prodRes.data || []) as Product[]);

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    const cats = ['Semua', ...Array.from(set)];
    if (bundles.length > 0) cats.push('Bundle');
    return cats;
  }, [products, bundles]);

  const filteredProducts = useMemo(() => {
    if (activeCat === 'Bundle') return [];
    return products.filter((p) => {
      const matchCat = activeCat === 'Semua' || p.category === activeCat;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCat, search]);

  const filteredBundles = useMemo(() => {
    if (activeCat !== 'Semua' && activeCat !== 'Bundle') return [];
    return bundles.filter((b) =>
      !search || b.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [bundles, activeCat, search]);

  const stockBadge = (qty: number) => {
    if (qty <= 0) return <Badge variant="destructive">HABIS</Badge>;
    if (qty <= 5) return <Badge variant="secondary">MENIPIS</Badge>;
    return <Badge variant="default">TERSEDIA</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2 bg-card">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari menu (nama / kode)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setCustomOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Custom
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={activeCat === c ? 'default' : 'outline'}
              onClick={() => setActiveCat(c)}
              className="flex-shrink-0"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Memuat menu...</div>
        ) : filteredProducts.length === 0 && filteredBundles.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">Tidak ada menu</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredBundles.map((b) => (
              <POSBundleCard key={b.id} bundle={b} onAdd={onAddBundle} />
            ))}
            {filteredProducts.map((p) => {
              const qty = inventory[p.id] ?? 0;
              const disabled = branchId ? qty <= 0 : false;
              return (
                <Card
                  key={p.id}
                  className={`p-2 cursor-pointer hover:border-primary transition ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() =>
                    onAdd({
                      product_id: p.id,
                      product_code: p.code,
                      product_name: p.name,
                      category: p.category,
                      price: Number(p.price),
                      image_url: p.image_url,
                    })
                  }
                >
                  {p.image_url ? (
                    <div className="aspect-square w-full bg-muted rounded overflow-hidden mb-2">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="aspect-square w-full bg-muted rounded mb-2 flex items-center justify-center text-xs text-muted-foreground">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="text-xs font-medium line-clamp-2 leading-tight">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.category}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-sm font-bold text-primary">
                      Rp{Number(p.price).toLocaleString('id-ID')}
                    </div>
                  </div>
                  {branchId && <div className="mt-1">{stockBadge(qty)}</div>}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <POSCustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={onAddCustom}
      />
    </div>
  );
};
