import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, MessageCircle, CheckCircle } from 'lucide-react';

export interface ReceiptData {
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
}

export const POSReceipt = ({ open, data, onClose }: Props) => {
  if (!data) return null;
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

  const handlePrint = () => {
    window.print();
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
      'Terima kasih!',
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
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
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleWhatsApp}>
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-3 w-3" /> Print
          </Button>
          <Button onClick={onClose}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
