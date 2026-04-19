import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Package, X } from 'lucide-react';
import { toast } from 'sonner';

interface BundleComponent { product_id: string; qty: number; product_name?: string; }
interface Bundle {
  id: string;
  name: string;
  description: string | null;
  price: number;
  components: BundleComponent[];
  applicable_branch_ids: string[];
  is_active: boolean;
}
interface Product { id: string; name: string; price: number; }
interface Branch { id: string; name: string; }

const BundleManagement = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bundle | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    components: [] as BundleComponent[],
    applicable_branch_ids: [] as string[],
    is_active: true,
  });
  const [pickProduct, setPickProduct] = useState('');
  const [pickQty, setPickQty] = useState('1');

  const load = async () => {
    setLoading(true);
    const [b, p, br] = await Promise.all([
      supabase.from('pos_bundles').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, price').eq('is_active', true).order('name'),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ]);
    const productMap: Record<string, string> = {};
    (p.data || []).forEach((x: any) => (productMap[x.id] = x.name));
    setBundles(
      ((b.data || []) as any[]).map((x) => ({
        ...x,
        components: (Array.isArray(x.components) ? x.components : []).map((c: any) => ({
          ...c,
          product_name: productMap[c.product_id] || 'Item',
        })),
      }))
    );
    setProducts((p.data || []) as Product[]);
    setBranches((br.data || []) as Branch[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', components: [], applicable_branch_ids: [], is_active: true });
    setEditing(null);
    setPickProduct('');
    setPickQty('1');
  };

  const handleEdit = (b: Bundle) => {
    setEditing(b);
    setForm({
      name: b.name,
      description: b.description || '',
      price: String(b.price),
      components: b.components,
      applicable_branch_ids: b.applicable_branch_ids || [],
      is_active: b.is_active,
    });
    setOpen(true);
  };

  const addComponent = () => {
    if (!pickProduct) return;
    const prod = products.find((p) => p.id === pickProduct);
    if (!prod) return;
    if (form.components.some((c) => c.product_id === pickProduct)) {
      toast.error('Produk sudah ada dalam paket');
      return;
    }
    setForm({
      ...form,
      components: [
        ...form.components,
        { product_id: pickProduct, qty: Math.max(1, Number(pickQty) || 1), product_name: prod.name },
      ],
    });
    setPickProduct('');
    setPickQty('1');
  };

  const removeComponent = (pid: string) => {
    setForm({ ...form, components: form.components.filter((c) => c.product_id !== pid) });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || form.components.length === 0) {
      toast.error('Nama, harga, dan minimal 1 komponen wajib');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      components: form.components.map(({ product_id, qty }) => ({ product_id, qty })),
      applicable_branch_ids: form.applicable_branch_ids,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('pos_bundles').update(payload).eq('id', editing.id)
      : await supabase.from('pos_bundles').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Bundle tersimpan');
    setOpen(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus bundle ini?')) return;
    const { error } = await supabase.from('pos_bundles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Dihapus');
    load();
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" /> Manajemen Bundle POS
          </h1>
          <p className="text-sm text-muted-foreground">Buat paket produk dengan harga khusus</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Bundle
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat...</div>
      ) : bundles.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Belum ada bundle</Card>
      ) : (
        <div className="grid gap-3">
          {bundles.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{b.name}</h3>
                    <Badge variant={b.is_active ? 'default' : 'secondary'}>
                      {b.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  {b.description && <p className="text-sm text-muted-foreground mb-2">{b.description}</p>}
                  <div className="text-sm font-bold text-primary mb-2">
                    Rp{Number(b.price).toLocaleString('id-ID')}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {b.components.map((c) => (
                      <Badge key={c.product_id} variant="outline" className="text-xs">
                        {c.product_name} × {c.qty}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(b)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Bundle' : 'Tambah Bundle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Bundle</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Harga Bundle (Rp) *</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label>Komponen Produk *</Label>
              <div className="flex gap-2 mb-2">
                <select
                  className="flex-1 h-9 border rounded px-2 text-sm bg-background"
                  value={pickProduct}
                  onChange={(e) => setPickProduct(e.target.value)}
                >
                  <option value="">— Pilih produk —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  className="w-16"
                  value={pickQty}
                  onChange={(e) => setPickQty(e.target.value)}
                />
                <Button size="sm" onClick={addComponent}>+</Button>
              </div>
              <div className="space-y-1">
                {form.components.map((c) => (
                  <div key={c.product_id} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                    <span>{c.product_name} × {c.qty}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeComponent(c.product_id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Cabang Berlaku (kosong = semua)</Label>
              <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.applicable_branch_ids.includes(b.id)}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          applicable_branch_ids: e.target.checked
                            ? [...form.applicable_branch_ids, b.id]
                            : form.applicable_branch_ids.filter((x) => x !== b.id),
                        });
                      }}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Aktif</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Batal</Button>
              <Button onClick={handleSave} className="flex-1">Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BundleManagement;
