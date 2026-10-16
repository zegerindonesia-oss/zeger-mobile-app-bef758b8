import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Plus, Trash2, FileText, Truck, Wallet, Users, Ruler, Network, PackageCheck, MessageCircle, Mail, Camera, Upload, Sparkles, Loader2 } from 'lucide-react';
import { waPhone } from '@/pages/invoicing/SalesInvoicing';

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
      const { data } = await db.from('purchase_orders').select('*, suppliers(name, phone, email), purchase_order_items(*)').eq('branch_id', branchId).order('created_at', { ascending: false });
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

const fileToBase64 = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = rej;
  r.readAsDataURL(file);
});
// Compress to ~1400px JPEG q0.72 (typically 150–300 KB) for both AI reading and storage.
const shrinkImage = async (file: File): Promise<{ data: string; mime: string; blob: Blob }> => {
  if (file.type === 'application/pdf' || !file.type.startsWith('image/')) return { data: await fileToBase64(file), mime: file.type || 'application/pdf', blob: file };
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 1400; const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.72));
    return { data: c.toDataURL('image/jpeg', 0.72).split(',')[1], mime: 'image/jpeg', blob };
  } finally { URL.revokeObjectURL(url); }
};
const aliasKey = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const invoiceImageUrl = async (path?: string | null) => {
  if (!path) return '';
  const { data } = await supabase.storage.from('product-images').createSignedUrl(path, 3600);
  return data?.signedUrl || supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
};

function NewPO({ branchId, materials, units, suppliers, reload, userId }: any) {
  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [scan, setScan] = useState<{ preview: string; loading: boolean; invoice_number: string; invoice_date: string; due_date: string; supplier_name: string; total: number | null; file?: File } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const add = () => setItems([...items, { material_id: '', quantity: '', unit_name: '', factor: 1, unit_price: '' }]);
  const set = (i: number, patch: any) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const total = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const onFile = async (file?: File) => {
    if (!file) return;
    setScan({ preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '', loading: true, invoice_number: '', invoice_date: today(), due_date: '', supplier_name: '', total: null, file });
    try {
      const { data: b64, mime } = await shrinkImage(file);
      const { data, error } = await supabase.functions.invoke('parse-purchase-invoice', {
        body: { image: b64, mime, materials: materials.map((m: any) => ({ id: m.id, name: m.name, unit: m.unit, category: m.category })), suppliers: suppliers.map((s: any) => ({ id: s.id, name: s.name })) },
      });
      if (error || data?.error) {
        let msg = data?.error || error?.message;
        try { msg = (await (error as any)?.context?.json())?.error || msg; } catch { /* */ }
        throw new Error(msg || 'Gagal membaca nota');
      }
      const sup = suppliers.find((s: any) => s.id === data.supplier_match_id);
      if (sup) setSupplierId(sup.id);
      setScan((s) => s && ({ ...s, loading: false, invoice_number: data.invoice_number || '', invoice_date: data.invoice_date || today(), due_date: data.due_date || '', supplier_name: data.supplier_name || '', total: data.total ?? null }));
      setItems((data.items || []).map((it: any) => {
        const m = materials.find((x: any) => x.id === it.material_id);
        const o = m ? unitOptions(m, units).find((u: any) => u.unit_name?.toLowerCase() === String(it.unit || '').toLowerCase()) : null;
        return { material_id: m?.id || '', scanned_name: it.name, scanned_unit: it.unit, category: it.category, quantity: it.quantity || '', unit_name: o?.unit_name || m?.unit || it.unit || '', factor: o?.factor || 1, unit_price: it.unit_price || (it.quantity ? it.subtotal / it.quantity : '') };
      }));
      setNotes((n) => n || `Nota ${data.invoice_number || ''} ${data.supplier_name || ''}`.trim());
      toast.success(`Nota terbaca: ${(data.items || []).length} barang`);
    } catch (e: any) {
      toast.error(e.message || 'Gagal membaca nota');
      setScan((s) => s && ({ ...s, loading: false }));
    }
  };

  const createSupplier = async () => {
    if (!scan?.supplier_name) return;
    const { data, error } = await db.from('suppliers').insert({ name: scan.supplier_name, default_terms_days: 0 }).select().single();
    if (error) return toast.error(error.message);
    toast.success('Supplier ditambahkan'); await reload(); setSupplierId(data.id);
  };
  const createMaterial = async (i: number) => {
    const it = items[i];
    const { data, error } = await db.from('raw_materials').insert({ name: it.scanned_name, category: it.category || 'Umum', unit: it.scanned_unit || 'pcs', cost_per_unit: Number(it.unit_price) || 0, material_type: 'raw', yield_quantity: 1, track_stock: true }).select().single();
    if (error) return toast.error(error.message);
    toast.success(`Bahan "${data.name}" dibuat`); await reload();
    set(i, { material_id: data.id, unit_name: data.unit, factor: 1 });
  };

  const submit = async (receiveNow = false) => {
    if (!branchId) return toast.error('Pilih cabang');
    const valid = items.filter((i) => i.material_id && Number(i.quantity) > 0);
    if (!valid.length) return toast.error('Tambahkan minimal 1 bahan');
    if (valid.length < items.filter((i) => Number(i.quantity) > 0).length && !window.confirm('Ada barang yang belum dicocokkan ke bahan baku dan akan dilewati. Lanjut?')) return;
    const po_number = `PO-${today().replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const terms = scan?.due_date && scan.invoice_date ? Math.max(0, Math.round((new Date(scan.due_date).getTime() - new Date(scan.invoice_date).getTime()) / 86400000)) : (suppliers.find((s: any) => s.id === supplierId)?.default_terms_days || 0);
    const { data, error } = await db.from('purchase_orders').insert({ po_number, branch_id: branchId, supplier_id: supplierId || null, expected_date: expected || null, notes: notes || null, total_amount: total, created_by: userId, terms_days: terms }).select().single();
    if (error) return toast.error(error.message);
    const { data: rows, error: e2 } = await db.from('purchase_order_items').insert(valid.map((i) => ({ po_id: data.id, material_id: i.material_id, quantity: Number(i.quantity), unit_name: i.unit_name, factor: Number(i.factor) || 1, unit_price: Number(i.unit_price) || 0 }))).select();
    if (e2) return toast.error(e2.message);
    if (receiveNow) {
      const { error: e3 } = await db.rpc('receive_purchase_order', { _po_id: data.id, _items: (rows || []).map((r: any) => ({ id: r.id, received_quantity: Number(r.quantity) })), _invoice_number: scan?.invoice_number || null, _invoice_date: scan?.invoice_date || today(), _terms_days: terms });
      if (e3) return toast.error(e3.message);
      toast.success(`${po_number} diterima — stok bertambah & invoice tercatat`);
    } else toast.success(`${po_number} dibuat`);
    if (scan?.file) {
      const ext = scan.file.name.split('.').pop() || 'jpg';
      await supabase.storage.from('product-images').upload(`purchase-invoices/${data.id}.${ext}`, scan.file, { upsert: true }).catch(() => null);
    }
    setItems([]); setNotes(''); setExpected(''); setScan(null); reload();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Buat Purchase Order / Invoice Pembelian</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Foto Nota — isi otomatis dengan AI</p>
              <p className="text-xs text-muted-foreground">Barang datang? Foto nota supplier, sistem membaca no. invoice, supplier, barang, qty & harga.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => cameraRef.current?.click()} disabled={scan?.loading}><Camera className="h-4 w-4 mr-1" />Foto Nota</Button>
              <Button variant="outline" onClick={() => uploadRef.current?.click()} disabled={scan?.loading}><Upload className="h-4 w-4 mr-1" />Upload</Button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={uploadRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {scan && (
            <div className="flex flex-col md:flex-row gap-3">
              {scan.preview && <img src={scan.preview} alt="Nota" className="h-40 w-auto rounded-lg border object-contain bg-background" />}
              {scan.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />AI sedang membaca nota…</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2 flex-1 text-sm">
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">No. Invoice</span><Input value={scan.invoice_number} onChange={(e) => setScan({ ...scan, invoice_number: e.target.value })} /></label>
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">Supplier di nota</span>
                    <div className="flex gap-1"><Input value={scan.supplier_name} onChange={(e) => setScan({ ...scan, supplier_name: e.target.value })} />
                      {!supplierId && scan.supplier_name && <Button size="sm" variant="outline" onClick={createSupplier}>+ Supplier</Button>}</div></label>
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">Tanggal Invoice</span><Input type="date" value={scan.invoice_date} onChange={(e) => setScan({ ...scan, invoice_date: e.target.value })} /></label>
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">Jatuh Tempo</span><Input type="date" value={scan.due_date} onChange={(e) => setScan({ ...scan, due_date: e.target.value })} /></label>
                  {scan.total != null && <p className={`sm:col-span-2 text-xs ${Math.abs((scan.total || 0) - total) > 1 ? 'text-destructive' : 'text-muted-foreground'}`}>Total di nota {rp(scan.total)} · Total terhitung {rp(total)}{Math.abs((scan.total || 0) - total) > 1 ? ' — cek kembali (mungkin ada diskon/pajak/ongkir)' : ' ✓ cocok'}</p>}
                </div>
              )}
            </div>
          )}
        </div>
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
                  <TableCell className="min-w-48 space-y-1">
                    {it.scanned_name && <div className="text-xs text-muted-foreground">Nota: <span className="font-medium text-foreground">{it.scanned_name}</span>{it.category ? <Badge variant="outline" className="ml-1">{it.category}</Badge> : null}</div>}
                    <Select value={it.material_id} onValueChange={(v) => { const mm = materials.find((x: any) => x.id === v); set(i, { material_id: v, unit_name: mm?.unit, factor: 1, unit_price: it.scanned_name ? it.unit_price : mm?.cost_per_unit || '' }); }}>
                      <SelectTrigger className={it.scanned_name && !it.material_id ? 'border-destructive' : ''}><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                      <SelectContent>{materials.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {it.scanned_name && !it.material_id && <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => createMaterial(i)}>+ Jadikan bahan baru "{it.scanned_name}"</Button>}
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
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold">Total {rp(total)}</span>
            <Button variant="outline" onClick={() => submit(false)}><FileText className="h-4 w-4 mr-1" />Simpan sebagai PO</Button>
            <Button onClick={() => submit(true)}><PackageCheck className="h-4 w-4 mr-1" />Barang Diterima & Buat Invoice</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}

const poText = (po: any, matName: (id: string) => string) => `PURCHASE ORDER ${po.po_number}\nKepada: ${po.suppliers?.name || '-'}\nTanggal: ${po.order_date}${po.expected_date ? `\nMohon dikirim: ${po.expected_date}` : ''}\n\n${po.purchase_order_items.map((it: any) => `• ${matName(it.material_id)} ${num(it.quantity)} ${it.unit_name} @ ${rp(it.unit_price)}`).join('\n')}\n\nTOTAL: ${rp(po.total_amount)}${po.notes ? `\nCatatan: ${po.notes}` : ''}\n\nMohon konfirmasi. Terima kasih.`;

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
  const [f, setF] = useState({ name: '', contact_name: '', phone: '', email: '', default_terms_days: '' });
  const save = async () => {
    if (!f.name.trim()) return toast.error('Nama supplier wajib');
    const { error } = await db.from('suppliers').insert({ ...f, default_terms_days: Number(f.default_terms_days) || 0 });
    if (error) return toast.error(error.message);
    setF({ name: '', contact_name: '', phone: '', email: '', default_terms_days: '' }); reload();
  };
  return (
    <Card><CardContent className="p-3 space-y-3">
      <div className="grid md:grid-cols-6 gap-2">
        <Input placeholder="Nama supplier" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Kontak" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
        <Input placeholder="No. WhatsApp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input type="number" placeholder="Tempo default (hari)" value={f.default_terms_days} onChange={(e) => setF({ ...f, default_terms_days: e.target.value })} />
        <Button onClick={save}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kontak</TableHead><TableHead>WhatsApp</TableHead><TableHead>Email</TableHead><TableHead>Tempo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{suppliers.map((s: any) => (
          <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.contact_name}</TableCell><TableCell>{s.phone}</TableCell><TableCell>{s.email}</TableCell><TableCell>{s.default_terms_days} hari</TableCell>
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
