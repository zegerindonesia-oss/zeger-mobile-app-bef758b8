import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { customerCategory, moveCustomerCategory, orderCustomerCategories } from '@/lib/customer-category-order';

export function CategoryOrderSettings({ order, onChange }: { order: string[]; onChange: (order: string[]) => void }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const all: string[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from('products').select('category, sub_category').eq('is_active', true).eq('show_in_customer_app', true).order('id').range(offset, offset + 999);
          if (error) throw error;
          all.push(...data.map(customerCategory));
          if (data.length < 1000) break;
        }
        if (alive) setCategories([...new Set(all)]);
      } catch {
        if (alive) setError('Kategori belum dapat dimuat. Silakan buka kembali halaman ini.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);
  const rows = useMemo(() => orderCustomerCategories(categories, order), [categories, order]);
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Memuat kategori" />;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  return (
    <section className="space-y-4 py-4">
      <h2 className="text-lg font-semibold">Urutan Kategori Menu</h2>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kategori menu aktif di aplikasi customer.</p>}
      <ol className="divide-y border-y">
        {rows.map((category, index) => (
          <li key={category} className="flex items-center gap-3 py-3">
            <span className="w-7 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1 break-words text-sm font-medium">{category}</span>
            <Button type="button" variant="outline" size="icon" disabled={index === 0} title={`Naikkan ${category}`} aria-label={`Naikkan ${category}`} onClick={() => onChange(moveCustomerCategory(rows, category, -1))}><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" disabled={index === rows.length - 1} title={`Turunkan ${category}`} aria-label={`Turunkan ${category}`} onClick={() => onChange(moveCustomerCategory(rows, category, 1))}><ArrowDown className="h-4 w-4" /></Button>
          </li>
        ))}
      </ol>
    </section>
  );
}