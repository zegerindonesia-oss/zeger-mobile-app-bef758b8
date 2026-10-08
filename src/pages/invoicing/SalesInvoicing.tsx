import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Printer, MessageCircle, Mail, FileText, ArrowRightLeft, Wallet } from 'lucide-react';

const db = supabase as any;
const HO = ['ho_admin', 'ho_owner', 'ho_staff', '1_HO_Admin', '1_HO_Owner', '1_HO_Staff', 'finance'];
const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return new Intl.DateTimeFormat('en-CA').format(x); };
const daysTo = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000);
export const waPhone = (p?: string) => { const d = (p || '').replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d; };

type Mode = 'invoice' | 'order' | 'customers';

export default function SalesInvoicing({ mode }: { mode: Mode }) {
  const { userProfile } = useAuth();
  const isHO = HO.includes(userProfile?.role || '');
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.branch_id && !branchId) setBranchId(userProfile.branch_id);
    if (isHO) supabase.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      setBranches(data || []);
      if (!userProfile?.branch_id && data?.[0]) setBranchId(data[0].id);
    });
  }, [userProfile?.branch_id, isHO]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      db.from('business_customers').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('id,name,price').eq('is_active', true).order('name'),
    ]);
    setCustomers(c.data || []); setProducts(p.data || []);
    if (branchId && mode !== 'customers') {
      const { data } = await db.from('sales_invoices').select('*, business_customers(*), sales_invoice_items(*)')
        .eq('branch_id', branchId).eq('doc_type', mode).order('created_at', { ascending: false }).limit(200);
      setDocs(data || []);
    }
  }, [branchId, mode]);
  useEffect(() => { load(); }, [load]);

  const title = mode === 'invoice' ? 'Invoice Penjualan' : mode === 'order' ? 'Pesanan Penjualan' : 'Pelanggan B2B';
  const subtitle = mode === 'invoice' ? 'Tagihan resmi untuk catering, kantor & big order — lengkap tempo, pajak, dan pembayaran.'
    : mode === 'order' ? 'Catat pre-order / pesanan catering, lalu ubah jadi invoice sekali klik.' : 'Data pelanggan korporat untuk invoice & pesanan.';
  const unpaid = docs.filter((d) => d.status !== 'cancelled' && d.total_amount - d.paid_amount > 0);

  return (
    <div className="space-y-5 p-1 bo-fade-up">
      <div className="bo-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
        {isHO && mode !== 'customers' && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-56 rounded-full"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {mode === 'customers' ? <CustomersTab customers={customers} reload={load} /> : (
        <>
          {mode === 'invoice' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Total Invoice', docs.length.toString()],
                ['Belum Dibayar', rp(unpaid.reduce((s, d) => s + d.total_amount - d.paid_amount, 0))],
                ['Lewat Tempo', rp(unpaid.filter((d) => d.due_date && daysTo(d.due_date) < 0).reduce((s, d) => s + d.total_amount - d.paid_amount, 0))],
                ['Sudah Diterima', rp(docs.reduce((s, d) => s + Number(d.paid_amount || 0), 0))],
              ].map(([l, v]) => <div key={l} className="bo-card bo-card-hover p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p><p className="text-xl font-bold mt-2">{v}</p></div>)}
            </div>
          )}
          <DocForm mode={mode} branchId={branchId} customers={customers} products={products} userId={userProfile?.user_id} reload={load} />
          <DocList mode={mode} docs={docs} reload={load} />
        </>
      )}
    </div>
  );
}

function DocForm({ mode, branchId, customers, products, userId, reload }: any) {
  const [customerId, setCustomerId] = useState('');
  const [issue, setIssue] = useState(today());
  const [terms, setTerms] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([{ product_id: '', description: '', quantity: '1', unit_price: '' }]);
  const set = (i: number, p: any) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const afterDisc = Math.max(0, subtotal - Number(discount || 0));
  const total = afterDisc + afterDisc * Number(tax || 0) / 100;

  const submit = async () => {
    if (!branchId) return toast.error('Pilih cabang');
    if (!customerId) return toast.error('Pilih pelanggan');
    const valid = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (!valid.length) return toast.error('Tambahkan minimal 1 item');
    const t = terms === '' ? customers.find((c: any) => c.id === customerId)?.default_terms_days || 0 : Number(terms);
    const doc_number = `${mode === 'invoice' ? 'INV' : 'SO'}-${issue.replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { data, error } = await db.from('sales_invoices').insert({
      doc_number, doc_type: mode, branch_id: branchId, customer_id: customerId, status: mode === 'invoice' ? 'sent' : 'confirmed',
      issue_date: issue, due_date: mode === 'invoice' ? addDays(issue, t) : null, event_date: eventDate || null,
      subtotal, discount_amount: Number(discount || 0), tax_percent: Number(tax || 0), total_amount: total, notes: notes || null, created_by: userId,
    }).select().single();
    if (error) return toast.error(error.message);
    const { error: e2 } = await db.from('sales_invoice_items').insert(valid.map((i) => ({ invoice_id: data.id, product_id: i.product_id || null, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price || 0) })));
    if (e2) return toast.error(e2.message);
    toast.success(`${doc_number} dibuat`);
    setItems([{ product_id: '', description: '', quantity: '1', unit_price: '' }]); setNotes(''); setDiscount(''); setTax(''); setEventDate(''); reload();
  };

  return (
    <div className="bo-card bo-card-hover p-5 space-y-3">
      <h3 className="font-semibold">{mode === 'invoice' ? 'Buat Invoice Baru' : 'Buat Pesanan Baru'}</h3>
      <div className="grid md:grid-cols-4 gap-2">
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder={customers.length ? 'Pilih pelanggan' : 'Tambah pelanggan B2B dulu'} /></SelectTrigger>
          <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} title="Tanggal terbit" />
        {mode === 'invoice' ? <Input type="number" placeholder="Tempo (hari)" value={terms} onChange={(e) => setTerms(e.target.value)} /> : <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} title="Tanggal acara / kirim" />}
        <Input placeholder="Catatan" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Menu / Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead>Qty</TableHead><TableHead>Harga</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{items.map((it, i) => (
          <TableRow key={i}>
            <TableCell className="min-w-44">
              <Select value={it.product_id} onValueChange={(v) => { const p = products.find((x: any) => x.id === v); set(i, { product_id: v, description: p?.name || '', unit_price: p?.price ?? '' }); }}>
                <SelectTrigger><SelectValue placeholder="Opsional" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </TableCell>
            <TableCell><Input value={it.description} placeholder="mis. Paket nasi box" onChange={(e) => set(i, { description: e.target.value })} /></TableCell>
            <TableCell><Input type="number" className="w-20" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} /></TableCell>
            <TableCell><Input type="number" className="w-32" value={it.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} /></TableCell>
            <TableCell className="text-right">{rp(Number(it.quantity || 0) * Number(it.unit_price || 0))}</TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Button variant="outline" onClick={() => setItems([...items, { product_id: '', description: '', quantity: '1', unit_price: '' }])}><Plus className="h-4 w-4 mr-1" />Tambah Item</Button>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Subtotal <b>{rp(subtotal)}</b></span>
          <Input type="number" className="w-28" placeholder="Diskon Rp" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <Input type="number" className="w-24" placeholder="Pajak %" value={tax} onChange={(e) => setTax(e.target.value)} />
          <span className="text-base">Total <b>{rp(total)}</b></span>
          <Button onClick={submit}><FileText className="h-4 w-4 mr-1" />Simpan</Button>
        </div>
      </div>
    </div>
  );
}

const docText = (d: any) => {
  const lines = (d.sales_invoice_items || []).map((it: any) => `• ${it.description} x${it.quantity} = ${rp(it.quantity * it.unit_price)}`).join('\n');
  return `${d.doc_type === 'invoice' ? 'INVOICE' : 'PESANAN'} ${d.doc_number}\nKepada: ${d.business_customers?.name || '-'}\nTanggal: ${d.issue_date}${d.due_date ? `\nJatuh tempo: ${d.due_date}` : ''}${d.event_date ? `\nTanggal acara: ${d.event_date}` : ''}\n\n${lines}\n\nTOTAL: ${rp(d.total_amount)}${d.paid_amount > 0 ? `\nSudah dibayar: ${rp(d.paid_amount)}\nSisa: ${rp(d.total_amount - d.paid_amount)}` : ''}\n\nTerima kasih.`;
};

const printDoc = (d: any) => {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return toast.error('Izinkan pop-up untuk mencetak');
  const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  const rows = (d.sales_invoice_items || []).map((it: any) => `<tr><td>${esc(it.description)}</td><td style="text-align:right">${it.quantity}</td><td style="text-align:right">${rp(it.unit_price)}</td><td style="text-align:right">${rp(it.quantity * it.unit_price)}</td></tr>`).join('');
  w.document.write(`<html><head><title>${esc(d.doc_number)}</title><style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}h1{color:#E5252A;margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}.r{text-align:right}</style></head><body>
  <div style="display:flex;justify-content:space-between"><div><h1>${d.doc_type === 'invoice' ? 'INVOICE' : 'PESANAN'}</h1><div>${esc(d.doc_number)}</div></div><div style="text-align:right"><b>Flow F&amp;B</b><br/>Tanggal: ${d.issue_date}${d.due_date ? `<br/>Jatuh tempo: ${d.due_date}` : ''}${d.event_date ? `<br/>Acara: ${d.event_date}` : ''}</div></div>
  <p style="margin-top:24px"><b>Kepada:</b><br/>${esc(d.business_customers?.name)}<br/>${esc(d.business_customers?.address)}<br/>${esc(d.business_customers?.phone)}</p>
  <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
  <table style="width:320px;margin-left:auto"><tr><td>Subtotal</td><td class="r">${rp(d.subtotal)}</td></tr><tr><td>Diskon</td><td class="r">-${rp(d.discount_amount)}</td></tr><tr><td>Pajak (${d.tax_percent}%)</td><td class="r">${rp(d.total_amount - Math.max(0, d.subtotal - d.discount_amount))}</td></tr><tr><td><b>Total</b></td><td class="r"><b>${rp(d.total_amount)}</b></td></tr><tr><td>Dibayar</td><td class="r">${rp(d.paid_amount)}</td></tr><tr><td><b>Sisa</b></td><td class="r"><b>${rp(d.total_amount - d.paid_amount)}</b></td></tr></table>
  ${d.notes ? `<p><b>Catatan:</b> ${esc(d.notes)}</p>` : ''}<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
};

function DocList({ mode, docs, reload }: any) {
  const [pay, setPay] = useState<Record<string, string>>({});
  const doPay = async (d: any) => {
    const amount = Number(pay[d.id]);
    if (!(amount > 0)) return toast.error('Isi nominal');
    const paid = Math.min(d.total_amount, Number(d.paid_amount) + amount);
    const { error } = await db.from('sales_invoices').update({ paid_amount: paid, status: paid >= d.total_amount ? 'paid' : 'partial' }).eq('id', d.id);
    if (error) return toast.error(error.message);
    toast.success('Pembayaran dicatat'); setPay({ ...pay, [d.id]: '' }); reload();
  };
  const toInvoice = async (d: any) => {
    const terms = d.business_customers?.default_terms_days || 0;
    const { error } = await db.from('sales_invoices').update({ doc_type: 'invoice', status: 'sent', doc_number: d.doc_number.replace(/^SO-/, 'INV-'), issue_date: today(), due_date: addDays(today(), terms) }).eq('id', d.id);
    if (error) return toast.error(error.message);
    toast.success('Pesanan diubah jadi invoice'); reload();
  };
  const cancel = async (d: any) => {
    if (!window.confirm(`Batalkan ${d.doc_number}?`)) return;
    const { error } = await db.from('sales_invoices').update({ status: 'cancelled' }).eq('id', d.id);
    if (error) toast.error(error.message); else reload();
  };
  const badge = (d: any) => {
    if (d.status === 'cancelled') return <Badge variant="outline">Batal</Badge>;
    if (mode === 'order') return <Badge variant="secondary">Dikonfirmasi</Badge>;
    const rest = d.total_amount - d.paid_amount;
    if (rest <= 0) return <Badge className="bg-success text-success-foreground">Lunas</Badge>;
    const dd = d.due_date ? daysTo(d.due_date) : 0;
    if (dd < 0) return <Badge variant="destructive">Telat {-dd} hr</Badge>;
    return <Badge variant="secondary">{d.paid_amount > 0 ? 'Sebagian · ' : ''}{dd} hr lagi</Badge>;
  };

  return (
    <div className="bo-card bo-card-hover p-5">
      <h3 className="font-semibold mb-3">{mode === 'invoice' ? 'Daftar Invoice' : 'Daftar Pesanan'}</h3>
      <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Pelanggan</TableHead><TableHead>{mode === 'invoice' ? 'Jatuh Tempo' : 'Tgl Acara'}</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>{mode === 'invoice' && <TableHead>Terima Bayar</TableHead>}<TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {docs.map((d: any) => {
              const rest = d.total_amount - d.paid_amount;
              const phone = waPhone(d.business_customers?.phone);
              const email = d.business_customers?.email;
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.doc_number}<div className="text-xs text-muted-foreground">{d.issue_date}</div></TableCell>
                  <TableCell>{d.business_customers?.name || '-'}</TableCell>
                  <TableCell>{mode === 'invoice' ? d.due_date : d.event_date || '-'}</TableCell>
                  <TableCell>{badge(d)}</TableCell>
                  <TableCell className="text-right font-semibold">{rp(d.total_amount)}{mode === 'invoice' && rest > 0 && d.paid_amount > 0 && <div className="text-xs text-muted-foreground">sisa {rp(rest)}</div>}</TableCell>
                  {mode === 'invoice' && <TableCell>{rest > 0 && d.status !== 'cancelled' && <div className="flex gap-1"><Input type="number" className="w-28 h-8" placeholder={String(rest)} value={pay[d.id] || ''} onChange={(e) => setPay({ ...pay, [d.id]: e.target.value })} /><Button size="sm" onClick={() => doPay(d)}><Wallet className="h-4 w-4" /></Button></div>}</TableCell>}
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Cetak / PDF" onClick={() => printDoc(d)}><Printer className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Kirim WhatsApp" disabled={!phone} onClick={() => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(docText(d))}`, '_blank')}><MessageCircle className="h-4 w-4 text-success" /></Button>
                    <Button size="icon" variant="ghost" title="Kirim Email" disabled={!email} onClick={() => window.open(`mailto:${email}?subject=${encodeURIComponent(d.doc_number)}&body=${encodeURIComponent(docText(d))}`)}><Mail className="h-4 w-4" /></Button>
                    {mode === 'order' && d.status !== 'cancelled' && <Button size="sm" variant="outline" onClick={() => toInvoice(d)}><ArrowRightLeft className="h-4 w-4 mr-1" />Jadikan Invoice</Button>}
                    {d.status !== 'cancelled' && d.paid_amount <= 0 && <Button size="sm" variant="ghost" onClick={() => cancel(d)}>Batal</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!docs.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CustomersTab({ customers, reload }: any) {
  const empty = { name: '', contact_name: '', phone: '', email: '', address: '', default_terms_days: '' };
  const [f, setF] = useState(empty);
  const save = async () => {
    if (!f.name.trim()) return toast.error('Nama pelanggan wajib');
    const { error } = await db.from('business_customers').insert({ ...f, default_terms_days: Number(f.default_terms_days) || 0 });
    if (error) return toast.error(error.message);
    setF(empty); toast.success('Pelanggan ditambahkan'); reload();
  };
  return (
    <div className="bo-card bo-card-hover p-5 space-y-3">
      <div className="grid md:grid-cols-7 gap-2">
        <Input placeholder="Nama perusahaan" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Kontak" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
        <Input placeholder="No. WhatsApp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Alamat" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <Input type="number" placeholder="Tempo (hari)" value={f.default_terms_days} onChange={(e) => setF({ ...f, default_terms_days: e.target.value })} />
        <Button onClick={save}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kontak</TableHead><TableHead>WhatsApp</TableHead><TableHead>Email</TableHead><TableHead>Tempo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{customers.map((c: any) => (
          <TableRow key={c.id}><TableCell className="font-medium">{c.name}<div className="text-xs text-muted-foreground">{c.address}</div></TableCell><TableCell>{c.contact_name}</TableCell><TableCell>{c.phone}</TableCell><TableCell>{c.email}</TableCell><TableCell>{c.default_terms_days} hari</TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={async () => { await db.from('business_customers').update({ is_active: false }).eq('id', c.id); reload(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
        ))}
        {!customers.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada pelanggan B2B.</TableCell></TableRow>}</TableBody>
      </Table>
    </div>
  );
}
