import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, MessageCircle, CheckCircle, Mail, UserPlus, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { renderReceipt, type PrintSettings, type PaperWidth } from '@/lib/pos-printing';

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
  queue_number?: number | null;
}

interface Props {
  open: boolean;
  data: ReceiptData | null;
  onClose: () => void;
  onPrint?: () => void;
  onPrintStickers?: () => void;
  branchId?: string | null;
  defaultPhone?: string | null;
  printSettings?: PrintSettings;
}

const toWa = (p: string) => { const d = p.replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('62') ? d : d ? '62' + d : ''; };

export const POSReceipt = ({ open, data, onClose, onPrint, onPrintStickers, branchId, defaultPhone, printSettings }: Props) => {
  const [cName, setCName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  useEffect(() => { if (open) { setCName(data?.customer_name || ''); setPhone(defaultPhone || ''); setEmail(''); } }, [open, data]);
  if (!data) return null;

  // Save/update the customer in CRM so returning customers can be found by phone.
  const saveCustomer = async () => {
    const wa = toWa(phone);
    if (!wa && !email.trim()) return;
    if (wa.length < 9) return;
    try {
      // Save to CRM (customer_users) — phone-deduplicated, becomes a member automatically.
      const { data: res, error } = await (supabase as any).rpc('pos_quick_member', {
        _phone: wa, _name: cName.trim() || null, _branch_id: branchId || null, _cashier_name: data.kasir_name || null,
      });
      if (error) throw error;
      const m = Array.isArray(res) ? res[0] : res;
      if (m?.id && data.id) {
        await supabase.from('pos_transactions').update({ member_id: m.id, ...(cName.trim() ? { customer_name: cName.trim() } : {}) } as any)
          .eq('id', data.id).is('member_id', null);
      }
    } catch (e: any) { console.error('save customer failed', e); toast.error('Gagal simpan pelanggan ke CRM: ' + (e?.message || '')); }
  };
  const lookup = async () => {
    const wa = toWa(phone);
    if (wa.length < 9) return;
    const { data: r } = await (supabase as any).rpc('lookup_member', { _code: wa });
    const c = Array.isArray(r) ? r[0] : r;
    if (c) { if (!cName) setCName(c.name || ''); if (!email && c.email) setEmail(c.email); toast.success('Pelanggan lama ditemukan'); }
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
  // One tap: send receipt by WhatsApp, save the number as member, close for the next order.
  const quickWa = () => {
    if (toWa(phone).length < 10) return toast.error('Isi nomor WhatsApp customer dulu');
    handleWhatsApp();
    onClose();
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
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm max-h-[92dvh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5 text-primary" /> Pembayaran Berhasil
          </DialogTitle>
          <DialogDescription className="sr-only">Kirim struk ke WhatsApp customer</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <Input placeholder="No. WhatsApp customer (08…)" inputMode="tel" autoFocus value={phone}
            onChange={(e) => setPhone(e.target.value)} onBlur={lookup}
            onKeyDown={(e) => { if (e.key === 'Enter') quickWa(); }} className="h-12 text-base" />
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12 font-bold" onClick={quickWa}>
              <MessageCircle className="h-4 w-4" /> Kirim WA
            </Button>
            <Button variant="outline" className="h-12 font-bold" onClick={() => { saveCustomer(); onClose(); }}>Selesai</Button>
          </div>
        </div>
        {printSettings ? (() => {
          const paper = ((printSettings.printers.find((p) => p.role === 'receipt')?.paper as PaperWidth) || '80');
          return <iframe title="Pratinjau struk" srcDoc={renderReceipt(data as any, printSettings, paper === ('label' as any) ? '80' : paper)}
            className="w-full h-[420px] rounded-xl border bg-card" />;
        })() : null}
        <div className="rounded-xl border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> Kirim struk & simpan customer</div>
          <Input placeholder="Nama customer" value={cName} onChange={(e) => setCName(e.target.value)} />
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
          {onPrintStickers && <Button variant="outline" onClick={onPrintStickers}>
            <Tag className="h-3 w-3" /> Stiker Cup
          </Button>}
          {link && <Button variant="outline" onClick={() => window.open(link, '_blank')}>Struk Digital</Button>}
          <Button onClick={() => { saveCustomer(); onClose(); }}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
