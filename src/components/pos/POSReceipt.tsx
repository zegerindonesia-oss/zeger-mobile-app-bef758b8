import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, MessageCircle, CheckCircle, Mail, UserPlus, Tag, ChefHat, FileDown, RotateCcw, Undo2 } from 'lucide-react';
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
  onPrintKitchen?: () => void;
  onVoid?: () => void;
  branchId?: string | null;
  defaultPhone?: string | null;
  printSettings?: PrintSettings;
}

const toWa = (p: string) => { const d = p.replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('62') ? d : d ? '62' + d : ''; };

export const POSReceipt = ({ open, data, onClose, onPrint, onPrintStickers, onPrintKitchen, onVoid, branchId, defaultPhone, printSettings }: Props) => {
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

  const receiptHtml = printSettings ? (() => {
    const paper = ((printSettings.printers.find((p) => p.role === 'receipt')?.paper as PaperWidth) || '80');
    return renderReceipt(data as any, printSettings, paper === ('label' as any) ? '80' : paper);
  })() : '';
  const savePdf = () => {
    if (!receiptHtml) return link ? window.open(link, '_blank') : toast.error('Struk belum siap');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Izinkan pop-up untuk simpan PDF');
    w.document.write(receiptHtml); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };
  const actions = [
    { label: 'Cetak Struk', icon: Printer, onClick: handlePrint, show: true },
    { label: 'Cetak Dapur', icon: ChefHat, onClick: onPrintKitchen, show: !!onPrintKitchen },
    { label: 'Cetak Stiker', icon: Tag, onClick: onPrintStickers, show: !!onPrintStickers },
    { label: 'Simpan PDF', icon: FileDown, onClick: savePdf, show: true },
    { label: 'Pesan Lagi', icon: RotateCcw, onClick: () => { saveCustomer(); onClose(); }, show: true },
    { label: 'Void / Refund', icon: Undo2, onClick: onVoid, show: !!onVoid, danger: true },
  ].filter((a) => a.show);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] md:w-[80vw] max-w-none max-h-[90dvh] overflow-y-auto rounded-3xl p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
            <CheckCircle className="h-6 w-6 text-primary" /> Pembayaran Berhasil
            <span className="ml-auto mr-6 text-base font-extrabold text-primary">{fmt(data.total)}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Kirim struk ke WhatsApp customer</DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-3 min-w-0">
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-3 space-y-2 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary"><UserPlus className="h-3.5 w-3.5" /> Kirim struk WA & simpan pelanggan</div>
              <Input placeholder="No. WhatsApp customer (08…)" inputMode="tel" autoFocus value={phone}
                onChange={(e) => setPhone(e.target.value)} onBlur={lookup}
                onKeyDown={(e) => { if (e.key === 'Enter') quickWa(); }} className="h-12 text-base border-2 border-primary/50" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nama customer" value={cName} onChange={(e) => setCName(e.target.value)} className="h-11" />
                <Input placeholder="Email (opsional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="pos-3d-btn pos-3d-primary h-12" onClick={quickWa}>
                  <MessageCircle className="h-4 w-4" /> Kirim WA
                </button>
                <button type="button" className="pos-3d-btn h-12" onClick={handleEmail}>
                  <Mail className="h-4 w-4 text-primary" /> Email
                </button>
              </div>
            </div>
            {receiptHtml && <iframe title="Pratinjau struk" srcDoc={receiptHtml} className="w-full h-[300px] md:h-[46vh] rounded-2xl border bg-card shadow-inner" />}
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {actions.map((a) => (
                <button key={a.label} type="button" onClick={a.onClick}
                  className={`pos-3d-btn flex-col h-24 md:h-28 text-sm ${a.danger ? 'pos-3d-danger' : ''}`}>
                  <span className="pos-3d-icon"><a.icon className="h-5 w-5" /></span>
                  {a.label}
                </button>
              ))}
            </div>
            <button type="button" className="pos-3d-btn pos-3d-primary h-14 text-base mt-auto" onClick={() => { saveCustomer(); onClose(); }}>
              Selesai
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
