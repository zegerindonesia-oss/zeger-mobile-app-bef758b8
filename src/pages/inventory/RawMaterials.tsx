import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Save, AlertTriangle, PackagePlus, ClipboardCheck, ChefHat, Wheat, History } from 'lucide-react';

const db = supabase as any;
const HO = ['ho_admin', 'ho_owner', 'ho_staff', '1_HO_Admin', '1_HO_Owner', '1_HO_Staff'];
const UNITS = ['gr', 'kg', 'ml', 'liter', 'pcs', 'pack', 'botol', 'cup'];
const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const num = (n: number) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const jkt = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' });

interface Material { id: string; code: string | null; name: string; category: string; unit: string; cost_per_unit: number; min_stock: number; is_active: boolean }

const RawMaterials = () => {
  const { userProfile } = useAuth();
  const isHO = HO.includes(userProfile?.role || '');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});

  useEffect(() => {
    if (userProfile?.branch_id && !branchId) setBranchId(userProfile.branch_id);
    if (isHO) supabase.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      setBranches(data || []);
      if (!userProfile?.branch_id && data?.[0]) setBranchId(data[0].id);
    });
  }, [userProfile?.branch_id, isHO]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const { data } = await db.from('raw_materials').select('*').eq('is_active', true).order('category').order('name');
    setMaterials(data || []);
    if (branchId) {
      const { data: s } = await db.from('raw_material_stock').select('material_id,quantity').eq('branch_id', branchId);
      setStock(Object.fromEntries((s || []).map((r: any) => [r.material_id, Number(r.quantity)])));
    }
  }, [branchId]);
  useEffect(() => { load(); }, [load]);

  const lowCount = materials.filter((m) => (stock[m.id] || 0) <= m.min_stock && m.min_stock > 0).length;
  const stockValue = materials.reduce((s, m) => s + (stock[m.id] || 0) * m.cost_per_unit, 0);

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bahan Baku & Resep</h1>
          <p className="text-sm text-muted-foreground">Master bahan, resep menu (HPP), stok masuk, opname & riwayat. Stok bahan terpotong otomatis saat kasir menjual.</p>
        </div>
        {isHO && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Jumlah Bahan</p><p className="text-2xl font-bold">{materials.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Nilai Stok Cabang</p><p className="text-2xl font-bold">{rp(stockValue)}</p></CardContent></Card>
        <Card className={lowCount ? 'border-destructive/50' : ''}><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Stok Menipis</p><p className={`text-2xl font-bold ${lowCount ? 'text-destructive' : ''}`}>{lowCount}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="materials">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="materials"><Wheat className="h-4 w-4 mr-1" />Bahan Baku</TabsTrigger>
          <TabsTrigger value="recipes"><ChefHat className="h-4 w-4 mr-1" />Resep & HPP</TabsTrigger>
          <TabsTrigger value="in"><PackagePlus className="h-4 w-4 mr-1" />Stok Masuk</TabsTrigger>
          <TabsTrigger value="opname"><ClipboardCheck className="h-4 w-4 mr-1" />Opname</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />Riwayat</TabsTrigger>
        </TabsList>
        <TabsContent value="materials"><MaterialsTab materials={materials} stock={stock} reload={load} /></TabsContent>
        <TabsContent value="recipes"><RecipesTab materials={materials} /></TabsContent>
        <TabsContent value="in"><MovementTab mode="in" materials={materials} stock={stock} branchId={branchId} reload={load} /></TabsContent>
        <TabsContent value="opname"><MovementTab mode="adjust" materials={materials} stock={stock} branchId={branchId} reload={load} /></TabsContent>
        <TabsContent value="history"><HistoryTab branchId={branchId} materials={materials} /></TabsContent>
      </Tabs>
    </div>
  );
};

const MaterialsTab = ({ materials, stock, reload }: { materials: Material[]; stock: Record<string, number>; reload: () => void }) => {
  const empty = { code: '', name: '', category: 'Umum', unit: 'gr', cost_per_unit: '', min_stock: '' };
  const [f, setF] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const save = async () => {
    if (!f.name.trim()) return toast.error('Nama bahan wajib diisi');
    const row = { code: f.code || null, name: f.name.trim(), category: f.category || 'Umum', unit: f.unit, cost_per_unit: Number(f.cost_per_unit) || 0, min_stock: Number(f.min_stock) || 0 };
    const { error } = editId ? await db.from('raw_materials').update(row).eq('id', editId) : await db.from('raw_materials').insert(row);
    if (error) return toast.error(error.message);
    toast.success(editId ? 'Bahan diperbarui' : 'Bahan ditambahkan');
    setF(empty); setEditId(null); reload();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{editId ? 'Ubah Bahan' : 'Tambah Bahan Baku'}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <Input placeholder="Kode" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <Input className="md:col-span-2" placeholder="Nama (mis. Biji Kopi Arabica)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="Kategori" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" placeholder="Harga / satuan" value={f.cost_per_unit} onChange={(e) => setF({ ...f, cost_per_unit: e.target.value })} />
          <Input type="number" placeholder="Stok minimum" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <Button onClick={save}><Save className="h-4 w-4 mr-1" />{editId ? 'Simpan Perubahan' : 'Tambah'}</Button>
          {editId && <Button variant="ghost" onClick={() => { setF(empty); setEditId(null); }}>Batal</Button>}
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Kategori</TableHead><TableHead className="text-right">Harga/Satuan</TableHead><TableHead className="text-right">Stok</TableHead><TableHead className="text-right">Min</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {materials.map((m) => {
              const q = stock[m.id] || 0;
              const low = m.min_stock > 0 && q <= m.min_stock;
              return (
                <TableRow key={m.id}>
                  <TableCell>{m.code || '-'}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.category}</TableCell>
                  <TableCell className="text-right">{rp(m.cost_per_unit)}/{m.unit}</TableCell>
                  <TableCell className="text-right">{low ? <Badge variant="destructive">{num(q)} {m.unit}</Badge> : `${num(q)} ${m.unit}`}</TableCell>
                  <TableCell className="text-right">{num(m.min_stock)}</TableCell>
                  <TableCell className="text-right">{rp(q * m.cost_per_unit)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setEditId(m.id); setF({ code: m.code || '', name: m.name, category: m.category, unit: m.unit, cost_per_unit: m.cost_per_unit, min_stock: m.min_stock }); }}>Ubah</Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!window.confirm(`Nonaktifkan ${m.name}?`)) return;
                      const { error } = await db.from('raw_materials').update({ is_active: false }).eq('id', m.id);
                      if (error) toast.error(error.message); else reload();
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!materials.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada bahan baku.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const RecipesTab = ({ materials }: { materials: Material[] }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [matId, setMatId] = useState('');
  const [qty, setQty] = useState('');

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.from('products').select('id,name,price,category').eq('is_active', true).order('name'),
      db.from('product_recipes').select('*'),
    ]);
    setProducts(p.data || []);
    setRecipes(r.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const matMap = useMemo(() => Object.fromEntries(materials.map((m) => [m.id, m])), [materials]);
  const hpp = (pid: string) => recipes.filter((r) => r.product_id === pid).reduce((s, r) => s + Number(r.quantity) * (matMap[r.material_id]?.cost_per_unit || 0), 0);
  const current = recipes.filter((r) => r.product_id === productId);
  const product = products.find((p) => p.id === productId);

  const add = async () => {
    if (!productId || !matId || !Number(qty)) return toast.error('Pilih menu, bahan, dan takaran');
    const { error } = await db.from('product_recipes').upsert({ product_id: productId, material_id: matId, quantity: Number(qty) }, { onConflict: 'product_id,material_id' });
    if (error) return toast.error(error.message);
    setMatId(''); setQty(''); load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Atur Resep per Porsi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Pilih menu" /></SelectTrigger>
            <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {productId && (
            <>
              <div className="flex gap-2">
                <Select value={matId} onValueChange={setMatId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Bahan" /></SelectTrigger>
                  <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-28" type="number" placeholder="Takaran" value={qty} onChange={(e) => setQty(e.target.value)} />
                <Button onClick={add}><Plus className="h-4 w-4" /></Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead className="text-right">Takaran</TableHead><TableHead className="text-right">Biaya</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {current.map((r) => {
                    const m = matMap[r.material_id];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{m?.name || '-'}</TableCell>
                        <TableCell className="text-right">{num(r.quantity)} {m?.unit}</TableCell>
                        <TableCell className="text-right">{rp(Number(r.quantity) * (m?.cost_per_unit || 0))}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={async () => { await db.from('product_recipes').delete().eq('id', r.id); load(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                  {!current.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada bahan di resep ini.</TableCell></TableRow>}
                </TableBody>
              </Table>
              <div className="rounded-lg bg-muted p-3 text-sm grid grid-cols-3 gap-2">
                <div><p className="text-muted-foreground text-xs">HPP / porsi</p><p className="font-bold">{rp(hpp(productId))}</p></div>
                <div><p className="text-muted-foreground text-xs">Harga jual</p><p className="font-bold">{rp(product?.price)}</p></div>
                <div><p className="text-muted-foreground text-xs">% HPP</p><p className="font-bold">{product?.price ? `${((hpp(productId) / product.price) * 100).toFixed(1)}%` : '-'}</p></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Ringkasan HPP Semua Menu</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Menu</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">HPP</TableHead><TableHead className="text-right">%HPP</TableHead><TableHead className="text-right">Gross Profit</TableHead></TableRow></TableHeader>
            <TableBody>
              {products.map((p) => {
                const h = hpp(p.id);
                const has = recipes.some((r) => r.product_id === p.id);
                const pct = p.price ? (h / p.price) * 100 : 0;
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setProductId(p.id)}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{rp(p.price)}</TableCell>
                    <TableCell className="text-right">{has ? rp(h) : <span className="text-muted-foreground">belum ada resep</span>}</TableCell>
                    <TableCell className={`text-right ${pct > 40 ? 'text-destructive font-semibold' : has ? 'text-success' : ''}`}>{has ? `${pct.toFixed(1)}%` : '-'}</TableCell>
                    <TableCell className="text-right">{has ? rp(p.price - h) : '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const MovementTab = ({ mode, materials, stock, branchId, reload }: { mode: 'in' | 'adjust'; materials: Material[]; stock: Record<string, number>; branchId: string; reload: () => void }) => {
  const [rows, setRows] = useState<Record<string, { qty: string; cost: string }>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!branchId) return toast.error('Pilih cabang');
    const entries = Object.entries(rows).filter(([, v]) => v.qty !== '' && !isNaN(Number(v.qty)));
    if (!entries.length) return toast.error('Isi minimal satu bahan');
    setSaving(true);
    const ref = `${mode === 'in' ? 'IN' : 'OPN'}-${Date.now().toString().slice(-8)}`;
    try {
      for (const [mid, v] of entries) {
        if (mode === 'in' && Number(v.qty) <= 0) continue;
        const { error } = await db.rpc('record_material_movement', {
          _branch_id: branchId, _material_id: mid, _type: mode, _qty: Number(v.qty),
          _unit_cost: mode === 'in' && v.cost ? Number(v.cost) : null,
          _ref_type: mode === 'in' ? 'purchase' : 'opname', _ref_id: ref, _notes: notes || null,
        });
        if (error) throw error;
      }
      toast.success(mode === 'in' ? `Stok masuk tersimpan (${ref})` : `Opname tersimpan (${ref})`);
      setRows({}); setNotes(''); reload();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const set = (id: string, k: 'qty' | 'cost', v: string) => setRows((r) => ({ ...r, [id]: { qty: r[id]?.qty ?? '', cost: r[id]?.cost ?? '', [k]: v } }));
  const total = Object.entries(rows).reduce((s, [id, v]) => s + (Number(v.qty) || 0) * (Number(v.cost) || materials.find((m) => m.id === id)?.cost_per_unit || 0), 0);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{mode === 'in' ? 'Stok Masuk / Pembelian Bahan' : 'Stok Opname (hitung fisik)'}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {mode === 'in' ? 'Isi jumlah yang diterima. Harga beli baru akan memperbarui harga bahan (dipakai untuk HPP).' : 'Isi jumlah fisik hasil hitung. Selisih dengan stok sistem tercatat otomatis.'}
        </p>
        <Table>
          <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead className="text-right">Stok Sistem</TableHead><TableHead className="w-36">{mode === 'in' ? 'Jumlah Masuk' : 'Stok Fisik'}</TableHead>{mode === 'in' ? <TableHead className="w-36">Harga / satuan</TableHead> : <TableHead className="text-right">Selisih</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {materials.map((m) => {
              const sys = stock[m.id] || 0;
              const v = rows[m.id];
              const diff = v?.qty !== undefined && v.qty !== '' ? Number(v.qty) - sys : null;
              return (
                <TableRow key={m.id}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell className="text-right">{num(sys)} {m.unit}</TableCell>
                  <TableCell><Input type="number" value={v?.qty ?? ''} onChange={(e) => set(m.id, 'qty', e.target.value)} /></TableCell>
                  {mode === 'in'
                    ? <TableCell><Input type="number" placeholder={String(m.cost_per_unit)} value={v?.cost ?? ''} onChange={(e) => set(m.id, 'cost', e.target.value)} /></TableCell>
                    : <TableCell className={`text-right ${diff && diff < 0 ? 'text-destructive' : diff ? 'text-success' : ''}`}>{diff === null ? '-' : `${diff > 0 ? '+' : ''}${num(diff)} (${rp(diff * m.cost_per_unit)})`}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="flex-1 min-w-[200px]" placeholder={mode === 'in' ? 'Catatan (supplier / no. invoice)' : 'Catatan opname'} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {mode === 'in' && <span className="text-sm font-semibold">Total: {rp(total)}</span>}
          <Button onClick={submit} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

const HistoryTab = ({ branchId, materials }: { branchId: string; materials: Material[] }) => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!branchId) return;
    db.from('raw_material_movements').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(300).then(({ data }: any) => setRows(data || []));
  }, [branchId]);
  const mm = Object.fromEntries(materials.map((m) => [m.id, m]));
  const label: Record<string, string> = { purchase: 'Pembelian', sale: 'Terjual (resep)', opname: 'Opname', waste: 'Waste' };
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Bahan</TableHead><TableHead>Jenis</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead>Referensi</TableHead><TableHead>Catatan</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => {
              const signed = r.movement_type === 'out' ? -Number(r.quantity) : Number(r.quantity);
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{jkt(r.created_at)}</TableCell>
                  <TableCell>{mm[r.material_id]?.name || '-'}</TableCell>
                  <TableCell>{label[r.reference_type] || r.movement_type}</TableCell>
                  <TableCell className={`text-right ${signed < 0 ? 'text-destructive' : 'text-success'}`}>{signed > 0 ? '+' : ''}{num(signed)} {mm[r.material_id]?.unit}</TableCell>
                  <TableCell className="text-xs">{r.reference_type === 'sale' ? r.reference_id?.slice(0, 8) : r.reference_id}</TableCell>
                  <TableCell className="text-xs">{r.notes || '-'}</TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada riwayat.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RawMaterials;
