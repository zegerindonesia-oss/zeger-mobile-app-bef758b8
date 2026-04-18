import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { POSCartItem } from '@/hooks/usePOSCart';

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
}

export const POSProductGrid = ({ branchId, onAdd }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: prods } = await supabase
        .from('products')
        .select('id, code, name, category, price, image_url, is_active')
        .eq('is_active', true)
        .order('name');
      setProducts((prods || []) as Product[]);

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
    return ['Semua', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCat === 'Semua' || p.category === activeCat;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCat, search]);

  const stockBadge = (qty: number) => {
    if (qty <= 0) return <Badge variant="destructive">HABIS</Badge>;
    if (qty <= 5) return <Badge variant="secondary">MENIPIS</Badge>;
    return <Badge variant="default">TERSEDIA</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2 bg-card">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari menu (nama / kode)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
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
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">Tidak ada menu</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map((p) => {
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
    </div>
  );
};
