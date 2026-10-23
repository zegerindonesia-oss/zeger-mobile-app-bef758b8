import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, Grid2x2, TrendingUp, RefreshCw } from 'lucide-react';
import { recipeCost, priceForTarget, classifyMenu, type MenuClass } from '@/lib/menu-engineering';

const db = supabase as any;
const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const CLS: Record<MenuClass, { label: string; role: string; tip: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  star: { label: 'Star', role: 'Profit Maker', tip: 'Laris & margin tinggi. Jaga resep, porsi, dan posisi utama di menu.', variant: 'default' },
  plowhorse: { label: 'Plowhorse', role: 'TC Driver', tip: 'Penarik transaksi, margin tipis. Nego supplier, cek porsi, naikkan harga bertahap, atau bundling.', variant: 'secondary' },
  puzzle: { label: 'Puzzle', role: 'Margin Protector', tip: 'Margin tinggi tapi kurang laku. Dorong upselling kasir, foto & posisi menu lebih menonjol.', variant: 'outline' },
  dog: { label: 'Dog', role: 'Beban Menu', tip: 'Kurang laku & margin rendah. Rombak resep atau keluarkan dari menu.', variant: 'destructive' },
};

export default function CogsCalculator() {
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [lastBuy, setLastBuy] = useState<Record<string, string>>({});
  const [wastage, setWastage] = useState(3);
  const [target, setTarget] = useState(30);

  const load = useCallback(async () => {
    const [p, m, r, mv] = await Promise.all([
      supabase.from('products').select('id,name,price,category').eq('is_active', true).order('name'),
      db.from('raw_materials').select('id,name,unit,cost_per_unit,category,material_type').eq('is_active', true).order('name'),
      db.from('product_recipes').select('product_id,material_id,quantity'),
      db.from('raw_material_movements').select('material_id,created_at').eq('movement_type', 'in').not('unit_cost', 'is', null).order('created_at', { ascending: false }).limit(1000),
    ]);
    setProducts(p.data || []); setMaterials(m.data || []); setRecipes(r.data || []);
    const lb: Record<string, string> = {};
    (mv.data || []).forEach((x: any) => { if (!lb[x.material_id]) lb[x.material_id] = x.created_at; });
    setLastBuy(lb);
  }, []);
  useEffect(() => { load(); }, [load]);

  const matMap = useMemo(() => Object.fromEntries(materials.map((m) => [m.id, m])), [materials]);
  const byProduct = useMemo(() => {
    const g: Record<string, any[]> = {};
    recipes.forEach((r) => { (g[r.product_id] ||= []).push(r); });
    return g;
  }, [recipes]);
  const costOf = useCallback((pid: string, ov: Record<string, number> = {}) => recipeCost(byProduct[pid] || [], matMap, wastage, ov), [byProduct, matMap, wastage]);

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kalkulator HPP & Menu Engineering</h1>
          <p className="text-sm text-muted-foreground">HPP dihitung dari resep × harga beli terbaru (otomatis ikut invoice supplier terakhir) + buffer susut. Analisa memakai metode Kasavana & Smith.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs">Susut / Waste %<Input type="number" className="w-24" value={wastage} onChange={(e) => setWastage(Number(e.target.value) || 0)} /></label>
          <label className="text-xs">Target Food Cost %<Input type="number" className="w-24" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} /></label>
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs defaultValue="calc">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="calc"><Calculator className="h-4 w-4 mr-1" />Kalkulator HPP</TabsTrigger>
          <TabsTrigger value="sim"><TrendingUp className="h-4 w-4 mr-1" />Simulasi Harga Bahan</TabsTrigger>
          <TabsTrigger value="matrix"><Grid2x2 className="h-4 w-4 mr-1" />Analisa Menu</TabsTrigger>
        </TabsList>
        <TabsContent value="calc"><CalcTab products={products} byProduct={byProduct} matMap={matMap} lastBuy={lastBuy} wastage={wastage} target={target} costOf={costOf} /></TabsContent>
        <TabsContent value="sim"><SimTab products={products} materials={materials} byProduct={byProduct} costOf={costOf} target={target} /></TabsContent>
        <TabsContent value="matrix"><MatrixTab products={products} costOf={costOf} target={target} /></TabsContent>
      </Tabs>
    </div>
  );
}

function CalcTab({ products, byProduct, matMap, lastBuy, wastage, target, costOf }: any) {
  const [pid, setPid] = useState('');
  const withRecipe = products.filter((p: any) => byProduct[p.id]?.length);
  const p = products.find((x: any) => x.id === pid);
  const lines = byProduct[pid] || [];
  const raw = lines.reduce((s: number, l: any) => s + Number(l.quantity) * Number(matMap[l.material_id]?.cost_per_unit || 0), 0);
  const cost = costOf(pid);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Rincian HPP per Porsi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={pid} onValueChange={setPid}>
            <SelectTrigger><SelectValue placeholder="Pilih menu" /></SelectTrigger>
            <SelectContent>{withRecipe.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
          {p && (<>
            <Table>
              <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead className="text-right">Takaran</TableHead><TableHead className="text-right">Harga terbaru</TableHead><TableHead className="text-right">Biaya</TableHead><TableHead className="text-right">Porsi</TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l: any) => {
                  const m = matMap[l.material_id]; const c = Number(l.quantity) * Number(m?.cost_per_unit || 0);
                  return (
                    <TableRow key={l.material_id}>
                      <TableCell>{m?.name || '-'}<div className="text-[11px] text-muted-foreground">{lastBuy[l.material_id] ? `Beli terakhir ${new Date(lastBuy[l.material_id]).toLocaleDateString('id-ID')}` : 'Harga manual'}</div></TableCell>
                      <TableCell className="text-right">{Number(l.quantity)} {m?.unit}</TableCell>
                      <TableCell className="text-right">{rp(m?.cost_per_unit)}/{m?.unit}</TableCell>
                      <TableCell className="text-right">{rp(c)}</TableCell>
                      <TableCell className="text-right">{raw ? pct((c / raw) * 100) : '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <Stat k="Biaya bahan" v={rp(raw)} />
              <Stat k={`Susut ${wastage}%`} v={rp(cost - raw)} />
              <Stat k="HPP / porsi" v={rp(cost)} strong />
              <Stat k="Harga jual" v={rp(p.price)} />
              <Stat k="Food cost %" v={p.price ? pct((cost / p.price) * 100) : '-'} warn={p.price && (cost / p.price) * 100 > target} />
              <Stat k="Margin kontribusi" v={rp(p.price - cost)} />
              <Stat k={`Harga ideal (${target}%)`} v={rp(priceForTarget(cost, target))} strong />
            </div>
          </>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Semua Menu vs Target {target}%</CardTitle></CardHeader>
        <CardContent className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Menu</TableHead><TableHead className="text-right">HPP</TableHead><TableHead className="text-right">Jual</TableHead><TableHead className="text-right">FC%</TableHead><TableHead className="text-right">Harga ideal</TableHead></TableRow></TableHeader>
            <TableBody>
              {withRecipe.map((x: any) => { const c = costOf(x.id); const f = x.price ? (c / x.price) * 100 : 0; return (
                <TableRow key={x.id} className="cursor-pointer" onClick={() => setPid(x.id)}>
                  <TableCell>{x.name}</TableCell><TableCell className="text-right">{rp(c)}</TableCell><TableCell className="text-right">{rp(x.price)}</TableCell>
                  <TableCell className="text-right"><Badge variant={f > target ? 'destructive' : 'secondary'}>{pct(f)}</Badge></TableCell>
                  <TableCell className="text-right">{rp(priceForTarget(c, target))}</TableCell>
                </TableRow>); })}
              {!withRecipe.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada resep. Atur di Bahan Baku, WIP & Resep.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SimTab({ products, materials, byProduct, costOf, target }: any) {
  const [mid, setMid] = useState('');
  const [chg, setChg] = useState(10);
  const m = materials.find((x: any) => x.id === mid);
  const ov = m ? { [mid]: Number(m.cost_per_unit) * (1 + chg / 100) } : {};
  const hit = products.filter((p: any) => (byProduct[p.id] || []).some((l: any) => l.material_id === mid));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Simulasi: kalau harga bahan naik/turun, menu mana yang terdampak?</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <Select value={mid} onValueChange={setMid}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
            <SelectContent>{materials.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name} ({rp(x.cost_per_unit)}/{x.unit})</SelectItem>)}</SelectContent>
          </Select>
          <label className="text-xs">Perubahan harga %<Input type="number" className="w-28" value={chg} onChange={(e) => setChg(Number(e.target.value) || 0)} /></label>
          {m && <span className="text-sm text-muted-foreground">Harga baru {rp(ov[mid])}/{m.unit}</span>}
        </div>
        {m && (
          <Table>
            <TableHeader><TableRow><TableHead>Menu</TableHead><TableHead className="text-right">HPP sekarang</TableHead><TableHead className="text-right">HPP baru</TableHead><TableHead className="text-right">FC% baru</TableHead><TableHead className="text-right">Margin hilang</TableHead><TableHead className="text-right">Saran harga</TableHead></TableRow></TableHeader>
            <TableBody>
              {hit.map((p: any) => { const a = costOf(p.id); const b = costOf(p.id, ov); return (
                <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right">{rp(a)}</TableCell><TableCell className="text-right">{rp(b)}</TableCell>
                  <TableCell className="text-right">{p.price ? pct((b / p.price) * 100) : '-'}</TableCell><TableCell className="text-right">{rp(b - a)}</TableCell>
                  <TableCell className="text-right">{rp(Math.ceil(priceForTarget(b, target) / 500) * 500)}</TableCell></TableRow>); })}
              {!hit.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Bahan ini belum dipakai di resep mana pun.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MatrixTab({ products, costOf, target }: any) {
  const today = new Date(); const start = new Date(); start.setDate(start.getDate() - 29);
  const [from, setFrom] = useState(ymd(start));
  const [to, setTo] = useState(ymd(today));
  const [branchId, setBranchId] = useState('all');
  const [branches, setBranches] = useState<any[]>([]);
  const [sales, setSales] = useState<Record<string, { qty: number; rev: number }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { supabase.from('branches').select('id,name').order('name').then(({ data }) => setBranches(data || [])); }, []);

  const run = useCallback(async () => {
    setLoading(true);
    const ids: string[] = [];
    for (let i = 0; ; i += 1000) {
      let q = db.from('pos_transactions').select('id').eq('status', 'paid').gte('created_at', `${from}T00:00:00+07:00`).lte('created_at', `${to}T23:59:59+07:00`).range(i, i + 999);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data } = await q; ids.push(...(data || []).map((x: any) => x.id));
      if (!data || data.length < 1000) break;
    }
    const agg: Record<string, { qty: number; rev: number }> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from('pos_transaction_items').select('product_id,qty,subtotal_item').in('transaction_id', ids.slice(i, i + 200)).limit(5000);
      (data || []).forEach((r: any) => { if (!r.product_id) return; const a = (agg[r.product_id] ||= { qty: 0, rev: 0 }); a.qty += Number(r.qty) || 0; a.rev += Number(r.subtotal_item) || 0; });
    }
    setSales(agg); setLoading(false);
  }, [from, to, branchId]);
  useEffect(() => { run(); }, [run]);

  const res = useMemo(() => classifyMenu(products.map((p: any) => {
    const s = sales[p.id]; const avgPrice = s?.qty ? s.rev / s.qty : Number(p.price);
    return { id: p.id, name: p.name, qty: s?.qty || 0, price: avgPrice, cost: costOf(p.id) };
  })), [products, sales, costOf]);

  const revenue = res.items.reduce((s, r) => s + r.revenue, 0);
  const cogs = res.items.reduce((s, r) => s + r.cost * r.qty, 0);
  const top = (c: MenuClass, k: 'qty' | 'totalCm') => res.items.filter((r) => r.cls === c).sort((a, b) => b[k] - a[k]).slice(0, 3);
  const noRecipe = res.items.filter((r) => r.cost === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs">Dari<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs">Sampai<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua cabang</SelectItem>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        {loading && <span className="text-sm text-muted-foreground">Memuat penjualan…</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat k="Omzet menu" v={rp(revenue)} />
        <Stat k="HPP terpakai (teoritis)" v={rp(cogs)} />
        <Stat k="Food cost % rata-rata" v={revenue ? pct((cogs / revenue) * 100) : '-'} warn={revenue > 0 && (cogs / revenue) * 100 > target} />
        <Stat k="Total margin kontribusi" v={rp(res.totalCm)} strong />
        <Stat k="Rata-rata margin / porsi" v={rp(res.avgCm)} />
      </div>
      {noRecipe > 0 && <p className="text-xs text-destructive">{noRecipe} menu terjual belum punya resep, sehingga HPP-nya dianggap Rp0. Lengkapi resepnya agar analisa akurat.</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Ringkasan Keputusan</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {(['plowhorse', 'puzzle', 'star', 'dog'] as MenuClass[]).map((c) => (
            <div key={c} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2"><Badge variant={CLS[c].variant}>{CLS[c].role}</Badge><span className="text-xs text-muted-foreground">{CLS[c].label} · {res.items.filter((r) => r.cls === c).length} menu</span></div>
              <p className="text-xs text-muted-foreground">{CLS[c].tip}</p>
              <ul className="text-sm">{top(c, c === 'plowhorse' ? 'qty' : 'totalCm').map((r) => <li key={r.id}>• {r.name} — {r.qty} terjual, margin {rp(r.cm)}/porsi</li>)}</ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Matriks Menu (batas laris {pct(res.popThreshold)} porsi penjualan · batas margin {rp(res.avgCm)})</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Menu</TableHead><TableHead className="text-right">Terjual</TableHead><TableHead className="text-right">Mix %</TableHead><TableHead className="text-right">Harga rata²</TableHead><TableHead className="text-right">HPP</TableHead><TableHead className="text-right">FC%</TableHead><TableHead className="text-right">Margin/porsi</TableHead><TableHead className="text-right">Total margin</TableHead><TableHead>Kelas</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...res.items].sort((a, b) => b.totalCm - a.totalCm).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell><TableCell className="text-right">{r.qty}</TableCell><TableCell className="text-right">{pct(r.mixPct)}</TableCell>
                  <TableCell className="text-right">{rp(r.price)}</TableCell><TableCell className="text-right">{rp(r.cost)}</TableCell><TableCell className="text-right">{pct(r.foodCostPct)}</TableCell>
                  <TableCell className="text-right">{rp(r.cm)}</TableCell><TableCell className="text-right">{rp(r.totalCm)}</TableCell>
                  <TableCell><Badge variant={CLS[r.cls].variant}>{CLS[r.cls].role}</Badge></TableCell>
                </TableRow>
              ))}
              {!res.items.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Belum ada penjualan di periode ini.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ k, v, strong, warn }: { k: string; v: string; strong?: boolean; warn?: boolean }) {
  return <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{k}</p><p className={`${strong ? 'text-lg font-bold' : 'font-semibold'} ${warn ? 'text-destructive' : ''}`}>{v}</p></div>;
}
