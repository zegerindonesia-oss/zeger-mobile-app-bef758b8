import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2, ShoppingCart, Tag, Split, X, Gift, History, Armchair, Save } from 'lucide-react';
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
  member?: { id: string; name: string | null; member_code: string | null; points: number | null } | null;
  onScanMember?: () => void;
  onClearMember?: () => void;
  onRedeemPoints?: () => void;
  onShowMemberHistory?: () => void;
  redemption?: { code: string; discount: number; reward_name: string } | null;
  onClearRedemption?: () => void;
  memberMinTransaction?: number;
  onOpenTables?: () => void;
  onHoldToTable?: () => void;
}

export const POSCart = ({
  items, totals, orderType, setOrderType, tableNumber, setTableNumber,
  externalOrderId, setExternalOrderId, customerName, setCustomerName,
  discountBill, setDiscountBill, updateQty, updateNotes, setItemDiscount,
  removeItem, onClear, onPay, onSplit, branchId,
  appliedPromos, onApplyVoucher, onRemovePromo, totalPromoDiscount,
  member, onScanMember, onClearMember, onRedeemPoints, onShowMemberHistory,
  redemption, onClearRedemption, memberMinTransaction = 0, onOpenTables, onHoldToTable,
}: Props) => {
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
  const showExternal = ['gofood', 'grabfood', 'shopeefood'].includes(orderType);
  const showTable = orderType === 'dine_in';

  const [promoDialogScope, setPromoDialogScope] = useState<'item' | 'bill' | null>(null);
  const [promoDialogTarget, setPromoDialogTarget] = useState<POSCartItem | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  const voucher = appliedPromos.find((p) => p.source === 'voucher');
  const redemptionDiscount = redemption?.discount || 0;
  const finalTotal = Math.max(0, totals.total - totalPromoDiscount - redemptionDiscount);
  const memberBlocked = !!member && memberMinTransaction > 0 && finalTotal < memberMinTransaction;

  const handlePromoApply = (data: { type: 'percentage' | 'fixed'; value: number; computed: number; name: string }) => {
    if (promoDialogScope === 'item' && promoDialogTarget) {
      // discount per unit
      const perUnit = data.computed / promoDialogTarget.qty;
      setItemDiscount(promoDialogTarget.line_id, Math.round(perUnit));
    } else if (promoDialogScope === 'bill') {
      setDiscountBill(data.computed);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card/80 backdrop-blur-xl">
      <div className="shrink-0 p-3 md:p-4 border-b border-border/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ShoppingCart className="h-4 w-4" /></span>
              Pesanan Saat Ini
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">{totals.itemCount} item dipilih</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-bold">AKTIF</span>
            {items.length > 0 && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onClear} title="Kosongkan pesanan">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {showTable && onOpenTables && (
          <div className="flex gap-2">
            <Button size="sm" variant={tableNumber ? 'default' : 'outline'} className="flex-1 h-9 justify-start rounded-xl" onClick={onOpenTables}>
              <Armchair className="h-4 w-4 mr-1" /> {tableNumber ? `Meja ${tableNumber}` : 'Pilih Meja'}
            </Button>
          </div>
        )}
        {member && (
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{member.name || 'Member'}</div>
                <div className="text-[10px] text-muted-foreground">{member.member_code} • {member.points ?? 0} poin</div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onClearMember}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onRedeemPoints}>
                <Gift className="mr-1 h-3 w-3" /> Tukar Poin
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onShowMemberHistory}>
                <History className="mr-1 h-3 w-3" /> Riwayat
              </Button>
            </div>
            {memberBlocked && (
              <p className="mt-1 text-[10px] text-destructive">
                Minimal transaksi member {fmt(memberMinTransaction)}. Tambah item atau lepas member.
              </p>
            )}
            </div>
        )}
      </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
        {items.length === 0 ? (
           <div className="h-full min-h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
             <div className="h-14 w-14 rounded-2xl bg-muted/70 shadow-inner flex items-center justify-center mb-3"><ShoppingCart className="h-6 w-6 opacity-40" /></div>
             <div className="font-semibold text-foreground">Keranjang masih kosong</div>
             <div className="text-xs mt-1">Pilih menu dari katalog</div>
           </div>
        ) : (
          items.map((it) => (
             <div key={it.line_id} className="rounded-2xl border border-border/60 bg-background/75 p-3 space-y-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                   <div className="text-sm font-bold leading-tight">{it.product_name}</div>
                  {it.modifiers && it.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {it.modifiers.map((m) => (
                        <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{m}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{fmt(it.price)} × {it.qty}</div>
                  {it.discount_item > 0 && (
                    <div className="text-xs text-destructive">
                      Diskon: -{fmt(it.discount_item * it.qty)}
                    </div>
                  )}
                </div>
                 <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(it.line_id)}>
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
                 <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                   <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.line_id, it.qty - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                   <span className="w-8 text-center text-sm font-bold">{it.qty}</span>
                   <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.line_id, it.qty + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                 <div className="pos-number text-sm font-bold">{fmt(it.price * it.qty - it.discount_item * it.qty)}</div>
              </div>
              <Input
                 className="h-8 rounded-xl bg-muted/40 border-transparent text-xs focus-visible:bg-background"
                placeholder="Catatan (less sugar, no ice...)"
                value={it.notes}
                onChange={(e) => updateNotes(it.line_id, e.target.value)}
              />
            </div>
          ))
        )}
      </div>

       <div className="shrink-0 border-t border-border/60 p-3 md:p-4 space-y-2 bg-muted/40 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setShowAdjust((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl bg-background/70 px-3 h-9 text-xs font-semibold"
        >
          <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" /> Voucher & Diskon</span>
          <span className="text-muted-foreground">{showAdjust ? 'Tutup ▲' : 'Buka ▼'}</span>
        </button>
        {showAdjust && (<>
        <POSVoucherInput
          branchId={branchId}
          subtotal={totals.subtotal}
          voucher={voucher}
          onApply={onApplyVoucher}
          onRemove={onRemovePromo}
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs flex-shrink-0">Diskon Bill</Label>
          <Input
            type="number"
            className="h-8 text-sm"
            value={discountBill || ''}
            onChange={(e) => setDiscountBill(Number(e.target.value) || 0)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setPromoDialogTarget(null);
              setPromoDialogScope('bill');
            }}
          >
            <Tag className="h-3 w-3" />
          </Button>
        </div>
        </>)}

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
        {redemption && (
          <div className="flex justify-between text-sm text-destructive">
            <span className="flex items-center gap-1">
              Tukar Poin ({redemption.code})
              <Button size="icon" variant="ghost" className="h-4 w-4" onClick={onClearRedemption}>
                <X className="h-3 w-3" />
              </Button>
            </span>
            <span>-{fmt(redemption.discount)}</span>
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
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <Button variant="outline" className="h-12 rounded-2xl font-semibold" disabled={items.length === 0 || !onHoldToTable} onClick={onHoldToTable}>
            <Save className="h-4 w-4 mr-1.5" /> Simpan
          </Button>
          <Button variant="outline" className="h-12 rounded-2xl font-semibold" disabled={items.length < 2} onClick={onSplit}>
            <Split className="h-4 w-4 mr-1.5" /> Split Bill
          </Button>
        </div>
        <Button
          className="w-full h-16 rounded-2xl text-lg font-bold shadow-lg shadow-primary/30 flex items-center justify-between px-5"
          disabled={items.length === 0 || memberBlocked}
          onClick={onPay}
        >
          <span>Bayar</span>
          <span className="flex items-center gap-2"><span className="opacity-50">|</span><span className="pos-number text-xl">{fmt(finalTotal)}</span> ›</span>
        </Button>
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
