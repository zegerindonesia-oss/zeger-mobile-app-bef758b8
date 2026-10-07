import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Store } from 'lucide-react';
import { ALL_ORDER_MODES } from '@/lib/pos-order-modes';
import { fetchBranchSettings, type POSBranchSettings } from '@/hooks/usePOSBranchSettings';
import { useAuth } from '@/hooks/useAuth';

const TagEditor = ({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) => {
  const [v, setV] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">{c}
            <button onClick={() => onChange(items.filter((x) => x !== c))}><X className="h-3 w-3" /></button></span>
        ))}
      </div>
      <div className="flex gap-2 max-w-sm">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Tambah kategori" />
        <Button variant="outline" onClick={() => { const t = v.trim(); if (t && !items.includes(t)) onChange([...items, t]); setV(''); }}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

/** Back Office: per-branch POS configuration (modes, menu availability, cash categories). */
const POSBranchConfig = () => {
  const { userProfile } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [s, setS] = useState<POSBranchSettings | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; category: string | null }[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      setBranches(data || []);
      setBranchId(userProfile?.branch_id || data?.[0]?.id || '');
    });
    supabase.from('products').select('id,name,category').eq('is_active', true).order('name').then(({ data }) => setProducts(data || []));
  }, [userProfile?.branch_id]);
  useEffect(() => { if (branchId) fetchBranchSettings(branchId).then(setS); }, [branchId]);

  const filtered = useMemo(() => products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const up = (patch: Partial<POSBranchSettings>) => setS((x) => (x ? { ...x, ...patch } : x));
  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const save = async () => {
    if (!s) return;
    if (!s.order_modes.length) return toast.error('Minimal satu mode transaksi');
    setSaving(true);
    const { error } = await (supabase as any).from('pos_branch_settings').upsert({ ...s, updated_by: userProfile?.id });
    setSaving(false);
    error ? toast.error(error.message) : toast.success('Pengaturan POS cabang disimpan — kasir otomatis mengikuti');
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Pengaturan POS Cabang</h1>
          <p className="text-sm text-muted-foreground">Atur mode transaksi, menu yang dijual, dan kategori kas untuk tiap cabang.</p></div>
        <div className="flex gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={save} disabled={saving || !s}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </div>
      {s && <>
        <Card><CardHeader><CardTitle>Mode Transaksi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ALL_ORDER_MODES.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-xl border p-3 cursor-pointer">
                <Checkbox checked={s.order_modes.includes(m.id)} onCheckedChange={() => up({ order_modes: toggle(s.order_modes, m.id) })} /> {m.label}
              </label>
            ))}
          </CardContent></Card>
        <div className="grid md:grid-cols-2 gap-4">
          <Card><CardHeader><CardTitle>Kategori Kas Masuk</CardTitle></CardHeader><CardContent><TagEditor items={s.cash_in_categories} onChange={(v) => up({ cash_in_categories: v })} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Kategori Kas Keluar</CardTitle></CardHeader><CardContent><TagEditor items={s.cash_out_categories} onChange={(v) => up({ cash_out_categories: v })} /></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Menu Dijual di Cabang Ini ({products.length - s.hidden_product_ids.length}/{products.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-xs" placeholder="Cari menu..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button variant="outline" onClick={() => up({ hidden_product_ids: [] })}>Centang semua</Button>
              <Button variant="outline" onClick={() => up({ hidden_product_ids: products.map((p) => p.id) })}>Kosongkan</Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto">
              {filtered.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer">
                  <Checkbox checked={!s.hidden_product_ids.includes(p.id)} onCheckedChange={() => up({ hidden_product_ids: toggle(s.hidden_product_ids, p.id) })} />
                  <span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted-foreground">{p.category}</span>
                </label>
              ))}
            </div>
          </CardContent></Card>
      </>}
    </div>
  );
};

export default POSBranchConfig;
