import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, MessageCircle, CheckCircle, Mail, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReceiptData {
  id?: string;
  transaction_number: string;
  branch_name: string;
  kasir_name: string;
  created_at: string;
  order_type: string;
  table_number?: string | null;
  customer_name?: string | null;
  items: { product_name: string; qty: number; price: number; subtotal: number; notes?: string }[];
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  total: number;
  payment_method_1: string;
  amount_1: number;
  payment_method_2?: string | null;
  amount_2?: number;
  cash_received: number;
  change_amount: number;
}

interface Props {
  open: boolean;
  data: ReceiptData | null;
  onClose: () => void;
  onPrint?: () => void;
  branchId?: string | null;
}

const toWa = (p: string) => { const d = p.replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('62') ? d : d ? '62' + d : ''; };

export const POSReceipt = ({ open, data, onClose, onPrint, branchId }: Props) => {
  const [cName, setCName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  useEffect(() => { if (open) { setCName(data?.customer_name || ''); setPhone(''); setEmail(''); } }, [open, data]);
  if (!data) return null;

  // Save/update the customer in CRM so returning customers can be found by phone.
  const saveCustomer = async () => {
    const wa = toWa(phone);
    if (!wa && !email.trim()) return;
    try {
      const { data: ex } = wa ? await supabase.from('customers').select('id').eq('phone', wa).limit(1).maybeSingle() : { data: null };
      const row: any = { name: cName.trim() || 'Customer', phone: wa || null, email: email.trim() || null, branch_id: branchId || null, is_active: true };
      if (ex?.id) await supabase.from('customers').update({ name: row.name, ...(row.email ? { email: row.email } : {}) }).eq('id', ex.id);
      else await supabase.from('customers').insert(row);
    } catch (e) { console.error('save customer failed', e); }
  };
  const lookup = async () => {
    const wa = toWa(phone);
    if (wa.length < 9) return;
    const { data: c } = await supabase.from('customers').select('name,email').eq('phone', wa).limit(1).maybeSingle();
    if (c) { if (!cName) setCName(c.name || ''); if (!email && (c as any).email) setEmail((c as any).email); toast.success('Customer lama ditemukan'); }
  };
  const link = data.id ? `${window.location.origin}/r/${data.id}` : '';
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

  const handlePrint = () => {
    if (onPrint) onPrint(); else window.print();
  };

  const handleWhatsApp = () => {
    const lines = [
      `*${data.branch_name}*`,
      `Struk: ${data.transaction_number}`,
      `${new Date(data.created_at).toLocaleString('id-ID')}`,
      `Kasir: ${data.kasir_name}`,
      `Tipe: ${data.order_type}`,
      '',
      ...data.items.map((i) => `${i.qty}x ${i.product_name} - ${fmt(i.subtotal)}`),
      '',
      `Subtotal: ${fmt(data.subtotal)}`,
      data.discount > 0 ? `Diskon: -${fmt(data.discount)}` : '',
      `*TOTAL: ${fmt(data.total)}*`,
      `Bayar: ${data.payment_method_1.toUpperCase()} ${fmt(data.amount_1)}`,
      data.change_amount > 0 ? `Kembalian: ${fmt(data.change_amount)}` : '',
      '',
      link ? `🧾 Struk digital: ${link}` : '',
      '',
      'Terima kasih!',
    ].filter(Boolean).join('\n');
    const wa = toWa(phone);
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(lines)}`, '_blank');
    saveCustomer();
  };
  const receiptText = () => [
    data.branch_name, `Struk: ${data.transaction_number}`, new Date(data.created_at).toLocaleString('id-ID'), `Kasir: ${data.kasir_name}`, '',
    ...data.items.map((i) => `${i.qty}x ${i.product_name}  ${fmt(i.subtotal)}`), '',
    `Subtotal: ${fmt(data.subtotal)}`, data.discount > 0 ? `Diskon: -${fmt(data.discount)}` : '', `TOTAL: ${fmt(data.total)}`,
    `Bayar: ${data.payment_method_1.toUpperCase()} ${fmt(data.amount_1)}`, '', link ? `Lihat struk digital: ${link}` : '', 'Terima kasih atas kunjungan Anda!',
  ].filter(Boolean).join('\n');
  const handleEmail = () => {
    if (!email.trim()) return toast.error('Isi email customer dulu');
    window.location.href = `mailto:${email.trim()}?subject=${encodeURIComponent(`Struk ${data.branch_name} - ${data.transaction_number}`)}&body=${encodeURIComponent(receiptText())}`;
    saveCustomer();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5 text-primary" /> Pembayaran Berhasil
          </DialogTitle>
        </DialogHeader>
        <div id="pos-receipt-print" className="font-mono text-xs leading-tight border rounded p-3 bg-card">
          <div className="text-center mb-2">
            <div className="font-bold text-sm">{data.branch_name}</div>
            <div>Struk: {data.transaction_number}</div>
            <div>{new Date(data.created_at).toLocaleString('id-ID')}</div>
            <div>Kasir: {data.kasir_name}</div>
            <div>Tipe: {data.order_type.toUpperCase()}</div>
            {data.table_number && <div>Meja: {data.table_number}</div>}
            {data.customer_name && <div>Customer: {data.customer_name}</div>}
          </div>
          <div className="border-t border-dashed py-2 space-y-1">
            {data.items.map((i, idx) => (
              <div key={idx}>
                <div className="flex justify-between">
                  <span>{i.qty}x {i.product_name}</span>
                  <span>{fmt(i.subtotal)}</span>
                </div>
                {i.notes && <div className="text-muted-foreground italic">  &gt; {i.notes}</div>}
              </div>
            ))}
          </div>
          <div className="border-t border-dashed pt-2 space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(data.subtotal)}</span></div>
            {data.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{fmt(data.discount)}</span></div>}
            {data.service_charge > 0 && <div className="flex justify-between"><span>Service</span><span>{fmt(data.service_charge)}</span></div>}
            {data.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>{fmt(data.tax)}</span></div>}
            <div className="flex justify-between font-bold text-sm border-t pt-1"><span>TOTAL</span><span>{fmt(data.total)}</span></div>
            <div className="flex justify-between"><span>{data.payment_method_1.toUpperCase()}</span><span>{fmt(data.amount_1)}</span></div>
            {data.payment_method_2 && (
              <div className="flex justify-between"><span>{data.payment_method_2.toUpperCase()}</span><span>{fmt(data.amount_2 || 0)}</span></div>
            )}
            {data.change_amount > 0 && <div className="flex justify-between"><span>Kembalian</span><span>{fmt(data.change_amount)}</span></div>}
          </div>
          <div className="text-center mt-3 border-t border-dashed pt-2">
            Terima kasih atas kunjungan Anda!
          </div>
        </div>
        <div className="rounded-xl border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> Kirim struk & simpan customer</div>
          <Input placeholder="Nama customer" value={cName} onChange={(e) => setCName(e.target.value)} />
          <Input placeholder="No. WhatsApp (08…)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={lookup} />
          <Input placeholder="Email (opsional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={handleWhatsApp}>
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={handleEmail}>
            <Mail className="h-3 w-3" /> Email
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-3 w-3" /> Print
          </Button>
          {link && <Button variant="outline" onClick={() => window.open(link, '_blank')}>Struk Digital</Button>}
          <Button onClick={() => { saveCustomer(); onClose(); }}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
