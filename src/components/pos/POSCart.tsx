import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Trash2, ShoppingCart, Tag, Split, X } from 'lucide-react';
import { POSCartItem } from '@/hooks/usePOSCart';
import { AppliedPromo } from '@/hooks/usePOSPromo';
import { POSPromoDialog } from './POSPromoDialog';
import { POSVoucherInput } from './POSVoucherInput';

interface Totals {
  subtotal: number;
  discountItem: number;
  discountBill: number;
  serviceCharge: number;
  tax: number;
  total: number;
  itemCount: number;
}

interface Props {
  items: POSCartItem[];
  totals: Totals;
  orderType: string;
  setOrderType: (s: string) => void;
  tableNumber: string;
  setTableNumber: (s: string) => void;
  externalOrderId: string;
  setExternalOrderId: (s: string) => void;
  customerName: string;
  setCustomerName: (s: string) => void;
  discountBill: number;
  setDiscountBill: (n: number) => void;
  updateQty: (id: string, qty: number) => void;
  updateNotes: (id: string, notes: string) => void;
  setItemDiscount: (id: string, d: number) => void;
  removeItem: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
  onSplit: () => void;
  branchId: string | null;
  appliedPromos: AppliedPromo[];
  onApplyVoucher: (code: string) => Promise<{ ok: boolean; message: string }>;
  onRemovePromo: (id: string) => void;
  totalPromoDiscount: number;
}

export const POSCart = ({
  items, totals, orderType, setOrderType, tableNumber, setTableNumber,
  externalOrderId, setExternalOrderId, customerName, setCustomerName,
  discountBill, setDiscountBill, updateQty, updateNotes, setItemDiscount,
  removeItem, onClear, onPay, onSplit, branchId,
  appliedPromos, onApplyVoucher, onRemovePromo, totalPromoDiscount,
}: Props) => {
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
  const showExternal = ['gofood', 'grabfood', 'shopeefood'].includes(orderType);
  const showTable = orderType === 'dine_in';

  const [promoDialogScope, setPromoDialogScope] = useState<'item' | 'bill' | null>(null);
  const [promoDialogTarget, setPromoDialogTarget] = useState<POSCartItem | null>(null);

  const voucher = appliedPromos.find((p) => p.source === 'voucher');
  const finalTotal = Math.max(0, totals.total - totalPromoDiscount);

  const handlePromoApply = (data: { type: 'percentage' | 'fixed'; value: number; computed: number; name: string }) => {
    if (promoDialogScope === 'item' && promoDialogTarget) {
      // discount per unit
      const perUnit = data.computed / promoDialogTarget.qty;
      setItemDiscount(promoDialogTarget.product_id, Math.round(perUnit));
    } else if (promoDialogScope === 'bill') {
      setDiscountBill(data.computed);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Pesanan ({totals.itemCount})
          </h3>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onClear}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={orderType} onValueChange={setOrderType}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dine_in">Dine In</SelectItem>
            <SelectItem value="take_away">Take Away</SelectItem>
            <SelectItem value="gofood">GoFood</SelectItem>
            <SelectItem value="grabfood">GrabFood</SelectItem>
            <SelectItem value="shopeefood">ShopeeFood</SelectItem>
            <SelectItem value="zeger_app">Zeger App</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
          </SelectContent>
        </Select>
        {showTable && (
          <Input className="mt-2 h-8" placeholder="Nomor meja" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
        )}
        {showExternal && (
          <Input className="mt-2 h-8" placeholder="Nomor order platform" value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} />
        )}
        <Input className="mt-2 h-8" placeholder="Nama customer (opsional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Belum ada item</div>
        ) : (
          items.map((it) => (
            <div key={it.product_id} className="border rounded p-2 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(it.price)} × {it.qty}</div>
                  {it.discount_item > 0 && (
                    <div className="text-xs text-destructive">
                      Diskon: -{fmt(it.discount_item * it.qty)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(it.product_id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {!it.bundle_id && it.price > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Diskon item"
                      onClick={() => {
                        setPromoDialogTarget(it);
                        setPromoDialogScope('item');
                      }}
                    >
                      <Tag className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(it.product_id, it.qty - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm">{it.qty}</span>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(it.product_id, it.qty + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-sm font-semibold">{fmt(it.price * it.qty - it.discount_item * it.qty)}</div>
              </div>
              <Input
                className="h-7 text-xs"
                placeholder="Catatan (less sugar, no ice...)"
                value={it.notes}
                onChange={(e) => updateNotes(it.product_id, e.target.value)}
              />
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3 space-y-2 bg-muted/30">
        {/* Voucher */}
        <POSVoucherInput
          branchId={branchId}
          subtotal={totals.subtotal}
          voucher={voucher}
          onApply={onApplyVoucher}
          onRemove={onRemovePromo}
        />

        {/* Bill discount + button promo */}
        <div className="flex items-center gap-2">
          <Label className="text-xs flex-shrink-0">Diskon Bill</Label>
          <Input
            type="number"
            className="h-7 text-sm"
            value={discountBill || ''}
            onChange={(e) => setDiscountBill(Number(e.target.value) || 0)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              setPromoDialogTarget(null);
              setPromoDialogScope('bill');
            }}
          >
            <Tag className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{fmt(totals.subtotal)}</span>
        </div>
        {totals.discountItem > 0 && (
          <div className="flex justify-between text-sm text-destructive">
            <span>Diskon Item</span>
            <span>-{fmt(totals.discountItem)}</span>
          </div>
        )}
        {totals.discountBill > 0 && (
          <div className="flex justify-between text-sm text-destructive">
            <span>Diskon Bill</span>
            <span>-{fmt(totals.discountBill)}</span>
          </div>
        )}
        {voucher && (
          <div className="flex justify-between text-sm text-destructive">
            <span>Voucher ({voucher.voucher_code})</span>
            <span>-{fmt(voucher.computed_amount)}</span>
          </div>
        )}
        {totals.serviceCharge > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service ({Math.round((totals.serviceCharge / Math.max(1, totals.subtotal - totals.discountItem - totals.discountBill)) * 100)}%)</span>
            <span>{fmt(totals.serviceCharge)}</span>
          </div>
        )}
        {totals.tax > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pajak</span>
            <span>{fmt(totals.tax)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="font-semibold">TOTAL</span>
          <span className="text-2xl font-bold text-primary">{fmt(finalTotal)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-12"
            disabled={items.length < 2}
            onClick={onSplit}
          >
            <Split className="h-4 w-4 mr-1" />
            Split
          </Button>
          <Button className="h-12 text-lg" disabled={items.length === 0} onClick={onPay}>
            BAYAR
          </Button>
        </div>
      </div>

      <POSPromoDialog
        open={promoDialogScope !== null}
        scope={promoDialogScope || 'bill'}
        baseAmount={
          promoDialogScope === 'item' && promoDialogTarget
            ? promoDialogTarget.price * promoDialogTarget.qty
            : Math.max(0, totals.subtotal - totals.discountItem)
        }
        itemName={promoDialogTarget?.product_name}
        onClose={() => setPromoDialogScope(null)}
        onApply={handlePromoApply}
      />
    </div>
  );
};
