import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, Truck, Wallet, Users, Ruler, Network, PackageCheck } from 'lucide-react';

const db = supabase as any;
const HO = ['ho_admin', 'ho_owner', 'ho_staff', '1_HO_Admin', '1_HO_Owner', '1_HO_Staff', 'finance'];
const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const num = (n: number) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const daysTo = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000);

export default function ProcurementInvoice({ tab = 'new' }: { tab?: string }) {
  const { userProfile } = useAuth();
  const isHO = HO.includes(userProfile?.role || '');
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.branch_id && !branchId) setBranchId(userProfile.branch_id);
    if (isHO) supabase.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      setBranches(data || []);
      if (!userProfile?.branch_id && data?.[0]) setBranchId(data[0].id);
    });
  }, [userProfile?.branch_id, isHO]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const [m, u, s] = await Promise.all([
      db.from('raw_materials').select('*').eq('is_active', true).order('name'),
      db.from('material_units').select('*'),
      db.from('suppliers').select('*').eq('is_active', true).order('name'),
    ]);
    setMaterials(m.data || []); setUnits(u.data || []); setSuppliers(s.data || []);
    if (branchId) {
      const { data } = await db.from('purchase_orders').select('*, suppliers(name), purchase_order_items(*)').eq('branch_id', branchId).order('created_at', { ascending: false });
      setPos(data || []);
    }
  }, [branchId]);
  useEffect(() => { load(); }, [load]);

  const unpaid = pos.filter((p) => p.status === 'received' && p.total_amount - p.paid_amount > 0);
  const totalDebt = unpaid.reduce((s, p) => s + p.total_amount - p.paid_amount, 0);
  const overdue = unpaid.filter((p) => p.due_date && daysTo(p.due_date) < 0);
  const due7 = unpaid.filter((p) => p.due_date && daysTo(p.due_date) >= 0 && daysTo(p.due_date) <= 7);

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">PO & Invoice Pembelian</h1>
          <p className="text-sm text-muted-foreground">Pesan ke supplier → terima barang (stok bahan masuk otomatis) → invoice & jatuh tempo → bayar.</p>
        </div>
        {isHO && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">PO Menunggu Barang</p><p className="text-2xl font-bold">{pos.filter((p) => p.status === 'ordered').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Hutang</p><p className="text-2xl font-bold">{rp(totalDebt)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Jatuh Tempo ≤ 7 hari</p><p className="text-2xl font-bold">{rp(due7.reduce((s, p) => s + p.total_amount - p.paid_amount, 0))}</p></CardContent></Card>
        <Card className={overdue.length ? 'border-destructive/50' : ''}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lewat Jatuh Tempo</p><p className={`text-2xl font-bold ${overdue.length ? 'text-destructive' : ''}`}>{rp(overdue.reduce((s, p) => s + p.total_amount - p.paid_amount, 0))}</p></CardContent></Card>
      </div>

      <Tabs key={tab} defaultValue={tab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="new"><Plus className="h-4 w-4 mr-1" />PO Baru</TabsTrigger>
          <TabsTrigger value="list"><Truck className="h-4 w-4 mr-1" />Daftar PO & Penerimaan</TabsTrigger>
          <TabsTrigger value="debt"><Wallet className="h-4 w-4 mr-1" />Invoice & Jatuh Tempo</TabsTrigger>
          <TabsTrigger value="supplier"><Users className="h-4 w-4 mr-1" />Supplier</TabsTrigger>
          <TabsTrigger value="units"><Ruler className="h-4 w-4 mr-1" />Konversi Satuan</TabsTrigger>
          <TabsTrigger value="bom"><Network className="h-4 w-4 mr-1" />Peta BOM</TabsTrigger>
        </TabsList>
        <TabsContent value="new"><NewPO branchId={branchId} materials={materials} units={units} suppliers={suppliers} reload={load} userId={userProfile?.user_id} /></TabsContent>
        <TabsContent value="list"><POList pos={pos} materials={materials} reload={load} /></TabsContent>
        <TabsContent value="debt"><DebtTab pos={pos.filter((p) => p.status === 'received')} reload={load} /></TabsContent>
        <TabsContent value="supplier"><SupplierTab suppliers={suppliers} reload={load} /></TabsContent>
        <TabsContent value="units"><UnitsTab materials={materials} units={units} reload={load} /></TabsContent>
        <TabsContent value="bom"><BomMap materials={materials} /></TabsContent>
      </Tabs>
    </div>
  );
}

const unitOptions = (m: any, units: any[]) => m ? [{ unit_name: m.unit, factor: 1 }, ...units.filter((u) => u.material_id === m.id && u.use_for_purchase)] : [];

function NewPO({ branchId, materials, units, suppliers, reload, userId }: any) {
  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const add = () => setItems([...items, { material_id: '', quantity: '', unit_name: '', factor: 1, unit_price: '' }]);
  const set = (i: number, patch: any) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const total = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const submit = async () => {
    if (!branchId) return toast.error('Pilih cabang');
    const valid = items.filter((i) => i.material_id && Number(i.quantity) > 0);
    if (!valid.length) return toast.error('Tambahkan minimal 1 bahan');
    const po_number = `PO-${today().replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { data, error } = await db.from('purchase_orders').insert({ po_number, branch_id: branchId, supplier_id: supplierId || null, expected_date: expected || null, notes: notes || null, total_amount: total, created_by: userId, terms_days: suppliers.find((s: any) => s.id === supplierId)?.default_terms_days || 0 }).select().single();
    if (error) return toast.error(error.message);
    const { error: e2 } = await db.from('purchase_order_items').insert(valid.map((i) => ({ po_id: data.id, material_id: i.material_id, quantity: Number(i.quantity), unit_name: i.unit_name, factor: Number(i.factor) || 1, unit_price: Number(i.unit_price) || 0 })));
    if (e2) return toast.error(e2.message);
    toast.success(`${po_number} dibuat`);
    setItems([]); setNotes(''); setExpected(''); reload();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Buat Purchase Order</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-3 gap-2">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
            <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} (tempo {s.default_terms_days} hr)</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} title="Estimasi tiba" />
          <Input placeholder="Catatan" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead>Qty</TableHead><TableHead>Satuan Beli</TableHead><TableHead>Harga / Satuan Beli</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {items.map((it, i) => {
              const m = materials.find((x: any) => x.id === it.material_id);
              const opts = unitOptions(m, units);
              return (
                <TableRow key={i}>
                  <TableCell className="min-w-48">
                    <Select value={it.material_id} onValueChange={(v) => { const mm = materials.find((x: any) => x.id === v); set(i, { material_id: v, unit_name: mm?.unit, factor: 1, unit_price: mm?.cost_per_unit || '' }); }}>
                      <SelectTrigger><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                      <SelectContent>{materials.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" className="w-24" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} /></TableCell>
                  <TableCell>
                    <Select value={it.unit_name || ''} onValueChange={(v) => { const o = opts.find((x: any) => x.unit_name === v); set(i, { unit_name: v, factor: o?.factor || 1, unit_price: m ? m.cost_per_unit * (o?.factor || 1) : it.unit_price }); }}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Satuan" /></SelectTrigger>
                      <SelectContent>{opts.map((o: any) => <SelectItem key={o.unit_name} value={o.unit_name}>{o.unit_name}{o.factor !== 1 ? ` (= ${num(o.factor)} ${m.unit})` : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" className="w-32" value={it.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} /></TableCell>
                  <TableCell className="text-right">{rp(Number(it.quantity || 0) * Number(it.unit_price || 0))}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={add}><Plus className="h-4 w-4 mr-1" />Tambah Bahan</Button>
          <div className="flex items-center gap-3"><span className="font-bold">Total {rp(total)}</span><Button onClick={submit}><FileText className="h-4 w-4 mr-1" />Kirim PO</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusBadge = (s: string) => s === 'ordered' ? <Badge variant="secondary">Menunggu Barang</Badge> : s === 'received' ? <Badge>Diterima</Badge> : <Badge variant="outline">Batal</Badge>;

function POList({ pos, materials, reload }: any) {
  const [open, setOpen] = useState<string | null>(null);
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [inv, setInv] = useState({ number: '', date: today(), terms: '' });
  const matName = (id: string) => materials.find((m: any) => m.id === id)?.name || '-';

  const receive = async (po: any) => {
    const items = po.purchase_order_items.map((it: any) => ({ id: it.id, received_quantity: recv[it.id] !== undefined ? Number(recv[it.id]) : Number(it.quantity) }));
    const { error } = await db.rpc('receive_purchase_order', { _po_id: po.id, _items: items, _invoice_number: inv.number || null, _invoice_date: inv.date || null, _terms_days: inv.terms === '' ? po.terms_days : Number(inv.terms) });
    if (error) return toast.error(error.message);
    toast.success('Barang diterima, stok bahan bertambah');
    setOpen(null); setRecv({}); reload();
  };
  const cancel = async (po: any) => {
    if (!window.confirm(`Batalkan ${po.po_number}?`)) return;
    const { error } = await db.from('purchase_orders').update({ status: 'cancelled' }).eq('id', po.id);
    if (error) toast.error(error.message); else reload();
  };

  return (
    <Card><CardContent className="p-3 space-y-2">
      {pos.map((po: any) => (
        <div key={po.id} className="rounded-xl border p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><span className="font-semibold">{po.po_number}</span> · {po.suppliers?.name || 'Tanpa supplier'} · {po.order_date} {statusBadge(po.status)}</div>
            <div className="flex items-center gap-2"><span className="font-bold">{rp(po.total_amount)}</span>
              <Button size="icon" variant="ghost" title="Kirim PO via WhatsApp" disabled={!waPhone(po.suppliers?.phone)} onClick={() => window.open(`https://wa.me/${waPhone(po.suppliers?.phone)}?text=${encodeURIComponent(poText(po, matName))}`, '_blank')}><MessageCircle className="h-4 w-4 text-success" /></Button>
              <Button size="icon" variant="ghost" title="Kirim PO via Email" disabled={!po.suppliers?.email} onClick={() => window.open(`mailto:${po.suppliers?.email}?subject=${encodeURIComponent('Purchase Order ' + po.po_number)}&body=${encodeURIComponent(poText(po, matName))}`)}><Mail className="h-4 w-4" /></Button>
              {po.status === 'ordered' && <><Button size="sm" onClick={() => { setOpen(open === po.id ? null : po.id); setInv({ number: '', date: today(), terms: String(po.terms_days) }); }}><PackageCheck className="h-4 w-4 mr-1" />Terima Barang</Button><Button size="sm" variant="ghost" onClick={() => cancel(po)}>Batal</Button></>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{po.purchase_order_items.map((it: any) => `${matName(it.material_id)} ${num(it.quantity)} ${it.unit_name}${it.received_quantity != null ? ` (diterima ${num(it.received_quantity)})` : ''}`).join(' · ')}</div>
          {open === po.id && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              {po.purchase_order_items.map((it: any) => (
                <div key={it.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{matName(it.material_id)} — dipesan {num(it.quantity)} {it.unit_name}</span>
                  <Input type="number" className="w-28" placeholder={String(it.quantity)} value={recv[it.id] ?? ''} onChange={(e) => setRecv({ ...recv, [it.id]: e.target.value })} />
                  <span className="w-16">{it.unit_name}</span>
                </div>
              ))}
              <div className="grid md:grid-cols-3 gap-2">
                <Input placeholder="No. Invoice supplier" value={inv.number} onChange={(e) => setInv({ ...inv, number: e.target.value })} />
                <Input type="date" value={inv.date} onChange={(e) => setInv({ ...inv, date: e.target.value })} />
                <Input type="number" placeholder="Tempo (hari)" value={inv.terms} onChange={(e) => setInv({ ...inv, terms: e.target.value })} />
              </div>
              <Button onClick={() => receive(po)}>Konfirmasi Penerimaan & Buat Invoice</Button>
            </div>
          )}
        </div>
      ))}
      {!pos.length && <p className="text-center text-muted-foreground py-8">Belum ada PO.</p>}
    </CardContent></Card>
  );
}

function DebtTab({ pos, reload }: any) {
  const [pay, setPay] = useState<Record<string, string>>({});
  const doPay = async (po: any) => {
    const amount = Number(pay[po.id]);
    if (!(amount > 0)) return toast.error('Isi nominal');
    const { error } = await db.from('purchase_payments').insert({ po_id: po.id, amount });
    if (error) return toast.error(error.message);
    toast.success('Pembayaran dicatat'); setPay({ ...pay, [po.id]: '' }); reload();
  };
  const sorted = [...pos].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  return (
    <Card><CardContent className="p-3">
      <Table>
        <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Tgl Invoice</TableHead><TableHead>Jatuh Tempo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead>Bayar</TableHead></TableRow></TableHeader>
        <TableBody>
          {sorted.map((po) => {
            const rest = po.total_amount - po.paid_amount;
            const d = po.due_date ? daysTo(po.due_date) : 0;
            const st = rest <= 0 ? <Badge>Lunas</Badge> : d < 0 ? <Badge variant="destructive">Telat {-d} hr</Badge> : po.paid_amount > 0 ? <Badge variant="secondary">Sebagian · {d} hr lagi</Badge> : <Badge variant="outline">{d} hr lagi</Badge>;
            return (
              <TableRow key={po.id}>
                <TableCell>{po.invoice_number || po.po_number}</TableCell>
                <TableCell>{po.suppliers?.name || '-'}</TableCell>
                <TableCell>{po.invoice_date}</TableCell>
                <TableCell>{po.due_date} <span className="text-xs text-muted-foreground">({po.terms_days} hr)</span></TableCell>
                <TableCell>{st}</TableCell>
                <TableCell className="text-right">{rp(po.total_amount)}</TableCell>
                <TableCell className="text-right font-semibold">{rp(rest)}</TableCell>
                <TableCell>{rest > 0 && <div className="flex gap-1"><Input type="number" className="w-28" placeholder={String(rest)} value={pay[po.id] || ''} onChange={(e) => setPay({ ...pay, [po.id]: e.target.value })} /><Button size="sm" onClick={() => doPay(po)}>Bayar</Button></div>}</TableCell>
              </TableRow>
            );
          })}
          {!sorted.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada invoice.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function SupplierTab({ suppliers, reload }: any) {
  const [f, setF] = useState({ name: '', contact_name: '', phone: '', default_terms_days: '' });
  const save = async () => {
    if (!f.name.trim()) return toast.error('Nama supplier wajib');
    const { error } = await db.from('suppliers').insert({ ...f, default_terms_days: Number(f.default_terms_days) || 0 });
    if (error) return toast.error(error.message);
    setF({ name: '', contact_name: '', phone: '', default_terms_days: '' }); reload();
  };
  return (
    <Card><CardContent className="p-3 space-y-3">
      <div className="grid md:grid-cols-5 gap-2">
        <Input placeholder="Nama supplier" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Kontak" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
        <Input placeholder="Telepon" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input type="number" placeholder="Tempo default (hari)" value={f.default_terms_days} onChange={(e) => setF({ ...f, default_terms_days: e.target.value })} />
        <Button onClick={save}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kontak</TableHead><TableHead>Telepon</TableHead><TableHead>Tempo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{suppliers.map((s: any) => (
          <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.contact_name}</TableCell><TableCell>{s.phone}</TableCell><TableCell>{s.default_terms_days} hari</TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={async () => { await db.from('suppliers').update({ is_active: false }).eq('id', s.id); reload(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
        ))}</TableBody>
      </Table>
    </CardContent></Card>
  );
}

function UnitsTab({ materials, units, reload }: any) {
  const [matId, setMatId] = useState('');
  const [name, setName] = useState('');
  const [factor, setFactor] = useState('');
  const m = materials.find((x: any) => x.id === matId);
  const add = async () => {
    if (!matId || !name.trim() || !(Number(factor) > 0)) return toast.error('Lengkapi bahan, nama satuan, dan isi');
    const { error } = await db.from('material_units').insert({ material_id: matId, unit_name: name.trim(), factor: Number(factor) });
    if (error) return toast.error(error.message);
    setName(''); setFactor(''); reload();
  };
  const toggle = async (u: any, field: string, v: boolean) => { await db.from('material_units').update({ [field]: v }).eq('id', u.id); reload(); };
  return (
    <Card><CardContent className="p-3 space-y-3">
      <p className="text-sm text-muted-foreground">Satuan dasar dipakai untuk resep (mis. gr). Tambahkan satuan kemasan agar pembelian & opname bisa pakai pack/kg/karton dan otomatis dikonversi.</p>
      <div className="grid md:grid-cols-4 gap-2 items-center">
        <Select value={matId} onValueChange={setMatId}><SelectTrigger><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
          <SelectContent>{materials.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name} ({x.unit})</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Satuan baru (mis. pack)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" placeholder={`Isi dalam ${m?.unit || 'satuan dasar'}`} value={factor} onChange={(e) => setFactor(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Tambah Konversi</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead>Konversi</TableHead><TableHead>Pembelian</TableHead><TableHead>Opname</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{units.map((u: any) => {
          const mm = materials.find((x: any) => x.id === u.material_id);
          return (
            <TableRow key={u.id}><TableCell>{mm?.name}</TableCell><TableCell>1 {u.unit_name} = {num(u.factor)} {mm?.unit}</TableCell>
              <TableCell><Checkbox checked={u.use_for_purchase} onCheckedChange={(v) => toggle(u, 'use_for_purchase', !!v)} /></TableCell>
              <TableCell><Checkbox checked={u.use_for_opname} onCheckedChange={(v) => toggle(u, 'use_for_opname', !!v)} /></TableCell>
              <TableCell><Button size="icon" variant="ghost" onClick={async () => { await db.from('material_units').delete().eq('id', u.id); reload(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
          );
        })}</TableBody>
      </Table>
    </CardContent></Card>
  );
}

function BomMap({ materials }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [view, setView] = useState<'menu' | 'bahan'>('menu');
  useEffect(() => {
    Promise.all([supabase.from('products').select('id,name,price').eq('is_active', true).order('name'), db.from('product_recipes').select('*')])
      .then(([p, r]: any) => { setProducts(p.data || []); setRecipes(r.data || []); });
  }, []);
  const mat = useMemo(() => Object.fromEntries(materials.map((m: any) => [m.id, m])), [materials]);
  const withRecipe = products.filter((p) => recipes.some((r) => r.product_id === p.id));
  return (
    <Card><CardContent className="p-3 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'menu' ? 'default' : 'outline'} onClick={() => setView('menu')}>Menu → Bahan</Button>
        <Button size="sm" variant={view === 'bahan' ? 'default' : 'outline'} onClick={() => setView('bahan')}>Bahan → Menu</Button>
      </div>
      {view === 'menu' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {withRecipe.map((p) => {
            const rs = recipes.filter((r) => r.product_id === p.id);
            const hpp = rs.reduce((s, r) => s + Number(r.quantity) * (mat[r.material_id]?.cost_per_unit || 0), 0);
            return (
              <div key={p.id} className="rounded-xl border p-3">
                <div className="flex justify-between font-semibold"><span>{p.name}</span><span className="text-sm">{rp(p.price)}</span></div>
                <ul className="mt-2 space-y-1 text-sm border-l-2 border-primary/40 pl-3">
                  {rs.map((r) => <li key={r.id} className="flex justify-between"><span>{mat[r.material_id]?.name}</span><span className="text-muted-foreground">{num(r.quantity)} {mat[r.material_id]?.unit}</span></li>)}
                </ul>
                <div className="mt-2 text-xs flex justify-between"><span>HPP {rp(hpp)}</span><span>Margin {p.price ? Math.round((1 - hpp / p.price) * 100) : 0}%</span></div>
              </div>
            );
          })}
          {!withRecipe.length && <p className="text-muted-foreground">Belum ada resep. Atur di Bahan Baku & Resep.</p>}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {materials.filter((m: any) => recipes.some((r) => r.material_id === m.id)).map((m: any) => (
            <div key={m.id} className="rounded-xl border p-3">
              <div className="font-semibold">{m.name}</div>
              <ul className="mt-2 space-y-1 text-sm border-l-2 border-primary/40 pl-3">
                {recipes.filter((r) => r.material_id === m.id).map((r) => <li key={r.id} className="flex justify-between"><span>{products.find((p) => p.id === r.product_id)?.name}</span><span className="text-muted-foreground">{num(r.quantity)} {m.unit}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}
