import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Product {
  id: string;
  code: string | null;
  name: string;
  price: number;
  category: string | null;
}

interface OrderItem {
  product_id: string;
  product_code: string | null;
  product_name: string;
  category: string | null;
  price: number;
  qty: number;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  branchId: string | null;
  shiftId: string | null;
}

const platforms = [
  { value: 'gofood', label: 'GoFood', defaultPay: 'transfer' },
  { value: 'grabfood', label: 'GrabFood', defaultPay: 'transfer' },
  { value: 'shopeefood', label: 'ShopeeFood', defaultPay: 'transfer' },
  { value: 'zeger_app', label: 'Zeger App', defaultPay: 'qris' },
];

export const POSOnlineOrderForm = ({ open, onClose, onCreated, branchId, shiftId }: Props) => {
  const { userProfile } = useAuth();
  const [platform, setPlatform] = useState('gofood');
  const [externalId, setExternalId] = useState('');
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [totalOverride, setTotalOverride] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('products')
      .select('id, code, name, price, category')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts((data || []) as Product[]));
  }, [open]);

  useEffect(() => {
    const p = platforms.find((x) => x.value === platform);
    if (p) setPaymentMethod(p.defaultPay);
  }, [platform]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 8);
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)).slice(0, 12);
  }, [search, products]);

  const addProduct = (p: Product) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.product_id === p.id);
      if (ex) return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product_id: p.id, product_code: p.code, product_name: p.name, category: p.category, price: Number(p.price), qty: 1, notes: '' }];
    });
    setSearch('');
  };

  const updateQty = (id: string, qty: number) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.product_id !== id) : prev.map((i) => (i.product_id === id ? { ...i, qty } : i))));
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const finalTotal = totalOverride === '' ? subtotal : Number(totalOverride);

  const reset = () => {
    setExternalId('');
    setCustomer('');
    setItems([]);
    setSearch('');
    setTotalOverride('');
  };

  const submit = async () => {
    if (!branchId || !userProfile?.id || !shiftId) {
      toast.error('Shift belum dibuka');
      return;
    }
    if (items.length === 0) {
      toast.error('Tambahkan minimal 1 item');
      return;
    }
    setSubmitting(true);
    try {
      const d = new Date();
      const y = d.getFullYear().toString().slice(-2);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const t = String(d.getTime()).slice(-6);
      const txNum = `ON${y}${m}${day}-${t}`;

      const { data: tx, error } = await supabase
        .from('pos_transactions')
        .insert({
          transaction_number: txNum,
          branch_id: branchId,
          kasir_id: userProfile.id,
          shift_id: shiftId,
          order_type: platform,
          external_order_id: externalId || null,
          customer_name: customer || null,
          subtotal,
          discount_item: 0,
          discount_bill: Math.max(0, subtotal - finalTotal),
          service_charge: 0,
          tax: 0,
          total: finalTotal,
          payment_method_1: paymentMethod,
          amount_1: finalTotal,
          status: 'preparing',
        })
        .select()
        .single();
      if (error) throw error;

      const itemsPayload = items.map((i) => ({
        transaction_id: tx.id,
        product_id: i.product_id,
        product_code: i.product_code,
        product_name: i.product_name,
        category: i.category,
        price: i.price,
        qty: i.qty,
        discount_item: 0,
        subtotal_item: i.price * i.qty,
        notes: i.notes || null,
      }));
      const { error: itErr } = await supabase.from('pos_transaction_items').insert(itemsPayload);
      if (itErr) throw itErr;

      toast.success('Order online dikirim ke dapur');
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Gagal membuat order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Online Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metode Bayar</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="platform">Platform (settle nanti)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nomor Order Platform</Label>
              <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="GF-12345" />
            </div>
            <div>
              <Label>Nama Customer</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Opsional" />
            </div>
          </div>

          <div>
            <Label>Cari & Tambah Produk</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ketik nama produk..." />
            {filtered.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto border rounded">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between border-b last:border-b-0"
                    onClick={() => addProduct(p)}
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">Rp{Number(p.price).toLocaleString('id-ID')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border rounded">
            <div className="px-3 py-2 bg-muted text-sm font-medium">Item ({items.length})</div>
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada item</div>
            ) : (
              items.map((i) => (
                <div key={i.product_id} className="px-3 py-2 border-t flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.product_name}</div>
                    <div className="text-xs text-muted-foreground">Rp{i.price.toLocaleString('id-ID')}</div>
                  </div>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product_id, i.qty - 1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm">{i.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product_id, i.qty + 1)}><Plus className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(i.product_id, 0)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-sm">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="font-semibold">Rp{subtotal.toLocaleString('id-ID')}</div>
            </div>
            <div>
              <Label>Total Akhir (override)</Label>
              <Input
                type="number"
                value={totalOverride}
                onChange={(e) => setTotalOverride(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`Default ${subtotal}`}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Mengirim...' : 'Kirim ke Dapur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};