import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePOSShift } from '@/hooks/usePOSShift';
import { usePOSCart } from '@/hooks/usePOSCart';
import { usePOSPromo } from '@/hooks/usePOSPromo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { Menu, Wifi, WifiOff, Monitor, Armchair, ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { POSTableMap } from '@/components/pos/POSTableMap';
import type { POSTable } from '@/hooks/usePOSTables';
import { POSProductGrid } from '@/components/pos/POSProductGrid';
import { POSCart } from '@/components/pos/POSCart';
import { POSPayment } from '@/components/pos/POSPayment';
import { POSReceipt, ReceiptData } from '@/components/pos/POSReceipt';
import { OpenShiftModal, CloseShiftModal, CashMovementModal } from '@/components/pos/POSShiftModal';
import { POSSplitBillDialog, SplitResult } from '@/components/pos/POSSplitBillDialog';
import { POSOnlineOrderPanel } from '@/components/pos/POSOnlineOrderPanel';
import { MemberScanDialog, awardLoyaltyPoints, type LoyaltyMember } from '@/components/loyalty/MemberScanDialog';
import { LoyaltyRedeemDialog, type AppliedRedemption } from '@/components/loyalty/LoyaltyRedeemDialog';
import { PointsHistoryList } from '@/components/loyalty/PointsHistoryList';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getLoyaltyEarnSettings, useRedemption, DEFAULT_EARN_SETTINGS, type LoyaltyEarnSettings } from '@/lib/loyalty';

import { POSPrinterSettings } from '@/components/pos/POSPrinterSettings';
import { POSShiftReport } from '@/components/pos/POSShiftReport';
import { loadPrintSettings, printReceipt, printKitchen, DEFAULT_SETTINGS, type PrintSettings } from '@/lib/pos-printing';
import { POSVoiceOrder } from '@/components/pos/POSVoiceOrder';
import type { POSCartItem } from '@/hooks/usePOSCart';

/** Modifiers + free notes combined for receipt, KDS, and reports. */
const lineNotes = (i: POSCartItem) =>
  [(i.modifiers || []).join(', '), i.notes].filter((x) => x && x.trim()).join(' • ');

const POSMain = () => {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { activeShift, loading: shiftLoading, openShift, closeShift, addCashMovement } = usePOSShift();
  const cart = usePOSCart();
  const promo = usePOSPromo();

  const [branchName, setBranchName] = useState('Cabang');
  const [orderType, setOrderType] = useState('take_away');
  const [tableNumber, setTableNumber] = useState('');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [collapsed, setCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [statsKey, setStatsKey] = useState(0);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [pendingSplit, setPendingSplit] = useState<SplitResult | null>(null);
  const [splitIndex, setSplitIndex] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [member, setMember] = useState<LoyaltyMember | null>(null);
  const [memberScanOpen, setMemberScanOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [redemption, setRedemption] = useState<AppliedRedemption | null>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltyEarnSettings>(DEFAULT_EARN_SETTINGS);
  const [tableMapOpen, setTableMapOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<POSTable | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [report, setReport] = useState<{ kind: 'X' | 'Z'; shift: any } | null>(null);
  useEffect(() => { loadPrintSettings(userProfile?.branch_id || null).then(setPrintSettings); }, [userProfile?.branch_id]);
  const safePrint = (fn: () => Promise<void>) => fn().catch((e) => console.error('print failed', e));
  const sentLineIds = useRef<Set<string>>(new Set());
  const sentQty = useRef<Record<string, number>>({});
  const canManageTables = ['ho_admin','ho_owner','1_HO_Admin','1_HO_Owner','branch_manager','sb_branch_manager','2_Hub_Branch_Manager','3_SB_Branch_Manager'].includes(userProfile?.role || '');

  useEffect(() => {
    getLoyaltyEarnSettings().then(setLoyaltySettings);
  }, []);

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  useEffect(() => {
    const loadBranch = async () => {
      if (!userProfile?.branch_id) return;
      const { data } = await supabase
        .from('branches')
        .select('name, pos_tax_percent, pos_service_charge_percent')
        .eq('id', userProfile.branch_id)
        .maybeSingle();
      if (data?.name) setBranchName(data.name);
      if (data?.pos_tax_percent != null) cart.setTaxPercent(Number(data.pos_tax_percent));
      if (data?.pos_service_charge_percent != null)
        cart.setServiceChargePercent(Number(data.pos_service_charge_percent));
    };
    loadBranch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.branch_id]);

  const generateTxNumber = (suffix?: string) => {
    const d = new Date();
    const y = d.getFullYear().toString().slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const t = String(d.getTime()).slice(-6);
    return `POS${y}${m}${day}-${t}${suffix || ''}`;
  };

  const decrementInventory = async (branchId: string, itemsToDecrement: { product_id: string; qty: number; is_custom?: boolean }[]) => {
    for (const it of itemsToDecrement) {
      if (it.is_custom) continue;
      const { data: invRow } = await supabase
        .from('inventory')
        .select('id, stock_quantity')
        .eq('branch_id', branchId)
        .eq('product_id', it.product_id)
        .is('rider_id', null)
        .maybeSingle();
      if (invRow) {
        await supabase
          .from('inventory')
          .update({
            stock_quantity: Math.max(0, (invRow.stock_quantity || 0) - it.qty),
            last_updated: new Date().toISOString(),
          })
          .eq('id', invRow.id);
      }
    }
  };

  const markVoucherUsed = async (voucherId: string, transactionId: string) => {
    await supabase
      .from('pos_vouchers')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_by_transaction_id: transactionId,
      })
      .eq('id', voucherId);
  };

  const handlePay = async (payload: {
    method1: string;
    amount1: number;
    method2: string | null;
    amount2: number;
    cashReceived: number;
    change: number;
  }) => {
    if (!userProfile?.id || !userProfile?.branch_id || !activeShift) {
      toast.error('Shift atau profil tidak valid');
      return;
    }
    try {
      const txNum = generateTxNumber();
      const voucher = promo.appliedPromos.find((p) => p.source === 'voucher');
      const voucherDiscount = voucher?.computed_amount || 0;
      const redemptionDiscount = redemption?.discount || 0;
      const finalTotal = Math.max(0, cart.totals.total - voucherDiscount - redemptionDiscount);

      if (member && loyaltySettings.min_transaction > 0 && finalTotal < loyaltySettings.min_transaction) {
        toast.error(
          `Minimal transaksi member Rp${loyaltySettings.min_transaction.toLocaleString('id-ID')}`
        );
        return;
      }

      const tableTxnId: string | undefined = selectedTable?.open_bill?.txn_id;
      if (tableTxnId && selectedTable) {
        const unsent = cart.items
          .map((i) => ({ i, add: i.qty - (sentQty.current[i.line_id] || 0) }))
          .filter((x) => x.add > 0);
        await sendToKitchen(tableTxnId, selectedTable.table_number, unsent);
      }

      const { data: tx, error: txErr } = await supabase
        .from('pos_transactions')
        .insert({
          ...(tableTxnId ? { id: tableTxnId } : {}),
          transaction_number: txNum,
          branch_id: userProfile.branch_id,
          kasir_id: userProfile.id,
          shift_id: activeShift.id,
          order_type: orderType,
          external_order_id: externalOrderId || null,
          table_number: tableNumber || null,
          customer_name: customerName || null,
          subtotal: cart.totals.subtotal,
          discount_item: cart.totals.discountItem,
          discount_bill: cart.totals.discountBill + voucherDiscount + redemptionDiscount,
          service_charge: cart.totals.serviceCharge,
          tax: cart.totals.tax,
          total: finalTotal,
          payment_method_1: payload.method1,
          amount_1: payload.amount1,
          payment_method_2: payload.method2,
          amount_2: payload.amount2,
          cash_received: payload.cashReceived,
          change_amount: payload.change,
          status: 'paid',
          paid_at: new Date().toISOString(),
          member_id: member?.id || null,
        })
        .select()
        .single();
      if (txErr) throw txErr;

      const itemsPayload = cart.items.map((i) => ({
        transaction_id: tx.id,
        product_id: i.is_custom ? null : i.product_id,
        product_code: i.product_code,
        product_name: i.product_name,
        category: i.category,
        price: i.price,
        qty: i.qty,
        discount_item: i.discount_item,
        subtotal_item: i.price * i.qty - i.discount_item * i.qty,
        notes: lineNotes(i) || null,
      }));
      const { error: itemErr } = await supabase.from('pos_transaction_items').insert(itemsPayload);
      if (itemErr) throw itemErr;

      // Sync: kurangi stok inventory
      await decrementInventory(
        userProfile.branch_id,
        cart.items.map((i) => ({ product_id: i.product_id, qty: i.qty, is_custom: i.is_custom }))
      );

      // Potong stok bahan baku sesuai resep (BOM)
      try {
        await (supabase as any).rpc('deduct_recipe_for_transaction', { _transaction_id: tx.id });
      } catch (err) {
        console.error('deduct recipe failed', err);
      }

      // Mark voucher as used
      if (voucher?.voucher_id) {
        await markVoucherUsed(voucher.voucher_id, tx.id);
      }

      // Consume loyalty redemption code
      if (redemption?.code) {
        try {
          await useRedemption(redemption.code, cart.totals.total - voucherDiscount, 'pos', tx.id);
        } catch (err) {
          console.error('use_redemption failed', err);
        }
      }

      // Build receipt
      const receiptData: ReceiptData = {
        transaction_number: txNum,
        branch_name: branchName,
        kasir_name: userProfile.full_name,
        created_at: new Date().toISOString(),
        order_type: orderType,
        table_number: tableNumber || null,
        customer_name: customerName || null,
        items: cart.items.map((i) => ({
          product_name: i.product_name,
          qty: i.qty,
          price: i.price,
          subtotal: i.price * i.qty - i.discount_item * i.qty,
          notes: lineNotes(i),
        })),
        subtotal: cart.totals.subtotal,
        discount: cart.totals.discountItem + cart.totals.discountBill + voucherDiscount + redemptionDiscount,
        service_charge: cart.totals.serviceCharge,
        tax: cart.totals.tax,
        total: finalTotal,
        payment_method_1: payload.method1,
        amount_1: payload.amount1,
        payment_method_2: payload.method2,
        amount_2: payload.amount2,
        cash_received: payload.cashReceived,
        change_amount: payload.change,
      };
      setReceipt(receiptData);
      const printItems = cart.items.map((i) => ({
        product_id: i.is_custom ? null : i.product_id, product_name: i.product_name, category: i.category,
        qty: i.qty, price: i.price, subtotal: i.price * i.qty - i.discount_item * i.qty, notes: lineNotes(i),
      }));
      safePrint(async () => {
        await printReceipt(printSettings, { ...receiptData, items: printItems }, true);
        // Table orders already went to kitchen when held; others print kitchen tickets now
        if (!tableTxnId) {
          await printKitchen(printSettings, {
            ref: txNum, order_type: orderType, table_number: tableNumber || null,
            customer_name: customerName || null, created_at: new Date().toISOString(), items: printItems,
          });
        }
      });

      // Auto-release table (and merged tables) after payment
      if (selectedTable) {
        const db = supabase as any;
        await db.from('pos_tables').update({
          status: 'available', guest_name: null, guest_count: null, occupied_at: null,
          current_total: 0, open_bill: null, merged_into: null,
        }).or(`id.eq.${selectedTable.id},merged_into.eq.${selectedTable.id}`);
        setSelectedTable(null);
        sentQty.current = {};
      }

      setPaymentOpen(false);
      cart.clear();
      promo.clearPromos();
      setRedemption(null);
      setTableNumber('');
      setExternalOrderId('');
      setCustomerName('');
      if (member?.id) {
        const pts = await awardLoyaltyPoints({
          memberId: member.id,
          amount: finalTotal,
          source: 'pos',
          referenceId: tx.id,
          description: `Poin dari transaksi ${txNum}`,
        });
        if (pts > 0) {
          await supabase.from('pos_transactions').update({ point_earned: pts } as any).eq('id', tx.id);
          toast.success(`${member.name || 'Member'} mendapat ${pts} poin`);
        }
        setMember(null);
      }
      setStatsKey((k) => k + 1);
      toast.success('Pembayaran berhasil');
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses pembayaran');
    }
  };

  const handleCloseShift = async (closingCash: number, notes: string) => {
    try {
      const closed = await closeShift(closingCash, notes);
      toast.success('Shift berhasil ditutup');
      setCloseOpen(false);
      setReport({ kind: 'Z', shift: closed });
    } catch (e: any) {
      toast.error(e.message || 'Gagal menutup shift');
    }
  };

  const handleOpenShift = async (shiftType: string, openingCash: number) => {
    try {
      await openShift(shiftType, openingCash);
      toast.success('Shift dibuka');
    } catch (e: any) {
      toast.error(e.message || 'Gagal buka shift');
    }
  };

  const handleSelectTable = (t: POSTable) => {
    setSelectedTable(t);
    sentQty.current = {};
    setTableNumber(t.table_number);
    setOrderType('dine_in');
    if (t.guest_name && !customerName) setCustomerName(t.guest_name);
  };

  const handleRecallTable = (t: POSTable) => {
    if (cart.items.length > 0 && selectedTable?.id !== t.id && !window.confirm('Keranjang saat ini akan diganti dengan bill meja. Lanjutkan?')) return;
    handleSelectTable(t);
    cart.loadItems(t.open_bill?.items || [], Number(t.open_bill?.discount_bill || 0));
    setCustomerName(t.guest_name || '');
    sentLineIds.current = new Set((t.open_bill?.items || []).map((i: POSCartItem) => i.line_id));
    sentQty.current = Object.fromEntries((t.open_bill?.items || []).map((i: POSCartItem) => [i.line_id, i.qty]));
  };

  const sendToKitchen = async (txnId: string, tableNo: string, lines: { i: POSCartItem; add: number }[]) => {
    if (!lines.length || !userProfile?.branch_id) return;
    const db = supabase as any;
    const { data: ticket, error } = await db.from('pos_kds_tickets').insert({
      transaction_id: txnId,
      branch_id: userProfile.branch_id,
      status: 'queued',
      order_type: 'dine_in',
      table_number: tableNo,
      customer_name: customerName || null,
      transaction_number: `MEJA ${tableNo}`,
    }).select().single();
    if (error) throw error;
    await db.from('pos_kds_ticket_items').insert(lines.map(({ i, add }) => ({
      ticket_id: ticket.id, product_id: i.is_custom ? null : i.product_id,
      product_name: i.product_name, qty: add, notes: lineNotes(i) || null,
    })));
    safePrint(() => printKitchen(printSettings, {
      ref: `MEJA ${tableNo}`, order_type: 'dine_in', table_number: tableNo, customer_name: customerName || null,
      created_at: new Date().toISOString(), addition: sentQty.current && Object.keys(sentQty.current).length > 0,
      items: lines.map(({ i, add }) => ({ product_id: i.is_custom ? null : i.product_id, product_name: i.product_name, category: i.category, qty: add, notes: lineNotes(i) })),
    }));
  };

  const handleHoldToTable = async () => {
    if (!selectedTable || !userProfile?.branch_id) return;
    const db = supabase as any;
    try {
      // New / increased lines go to kitchen
      const newLines = cart.items
        .map((i) => ({ i, add: i.qty - (sentQty.current[i.line_id] || 0) }))
        .filter((x) => x.add > 0);
      const txnId = selectedTable.open_bill?.txn_id || crypto.randomUUID();
      await db.from('pos_tables').update({
        status: 'occupied',
        guest_name: customerName || selectedTable.guest_name || null,
        occupied_at: selectedTable.occupied_at || new Date().toISOString(),
        current_total: cart.totals.total,
        open_bill: { items: cart.items, discount_bill: cart.discountBill, txn_id: txnId },
      }).eq('id', selectedTable.id);
      if (newLines.length) {
        await sendToKitchen(txnId, selectedTable.table_number, newLines);
      }
      toast.success(`Pesanan disimpan ke Meja ${selectedTable.table_number}${newLines.length ? ' & dikirim ke dapur' : ''}`);
      cart.clear();
      setSelectedTable(null);
      setTableNumber('');
      setCustomerName('');
      sentLineIds.current = new Set();
      sentQty.current = {};
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan ke meja');
    }
  };

  const handleSplitConfirm = (result: SplitResult) => {
    setPendingSplit(result);
    setSplitIndex(0);
    setSplitOpen(false);
    setPaymentOpen(true);
    toast.info(`Split bill ${result.splits.length} bagian. Bayar Bill A dulu.`);
  };

  const handleApplyVoucher = async (code: string) => {
    return await promo.applyVoucher(code, userProfile?.branch_id || null, cart.totals.subtotal);
  };

  const totalPromoDiscount = promo.totalPromoDiscount;
  const paymentTotal = pendingSplit
    ? pendingSplit.splits[splitIndex]?.amount || 0
    : Math.max(0, cart.totals.total - totalPromoDiscount - (redemption?.discount || 0));

  if (shiftLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Memuat POS...</p>
        </div>
      </div>
    );
  }

  const sidebarProps = {
    role: userProfile?.role,
    userName: userProfile?.full_name || 'Kasir',
    branchName,
    onCashMovement: () => { setMobileNavOpen(false); setCashOpen(true); },
    onCloseShift: () => { setMobileNavOpen(false); setCloseOpen(true); },
    onPrinterSettings: () => { setMobileNavOpen(false); navigate('/pos/settings'); },
    onXReport: () => { setMobileNavOpen(false); activeShift ? setReport({ kind: 'X', shift: activeShift }) : toast.error('Tidak ada shift aktif'); },
    onLogout: signOut,
  };
  const fmtRp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

  return (
    <div className="h-[100dvh] flex pos-canvas pos-touch overflow-hidden">
      <div className="hidden md:flex">
        <POSSidebar collapsed={collapsed} {...sidebarProps} />
      </div>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-[260px] border-0 [&>button]:hidden">
          <POSSidebar collapsed={false} {...sidebarProps} />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 flex flex-col gap-2 md:gap-3 p-2 md:p-3 overflow-hidden">
        <header className="pos-command-header rounded-2xl min-h-14 md:min-h-16 px-2 md:px-4 py-2 flex items-center gap-1.5 md:gap-3">
          <button
            onClick={() => (window.innerWidth < 768 ? setMobileNavOpen(true) : setCollapsed((c) => !c))}
            className="pos-raised-control h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
            title="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 leading-tight">
            <h1 className="text-base md:text-lg font-bold truncate">Terminal Kasir</h1>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">{branchName}{activeShift?.shift_type ? ` · Shift ${activeShift.shift_type}` : ''}</p>
          </div>
          <span className={`hidden lg:flex rounded-xl px-3 py-2 text-xs font-semibold items-center gap-1.5 ${online ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? 'Online' : 'Offline'}
          </span>
          {!online && <WifiOff className="lg:hidden h-4 w-4 text-destructive shrink-0" />}
          <button onClick={() => setTableMapOpen(true)} className="pos-raised-control h-10 px-2.5 md:px-3 rounded-xl flex items-center gap-1.5 text-sm font-semibold shrink-0" title="Meja">
            <Armchair className="h-4 w-4" /> <span className="hidden sm:inline">Meja</span>
          </button>
          <POSVoiceOrder onAdd={cart.addItem} />
          <div className="hidden sm:block"><POSOnlineOrderPanel branchId={userProfile?.branch_id || null} shiftId={activeShift?.id || null} /></div>
          <button onClick={() => navigate('/pos/kds')} className="pos-raised-control h-10 px-2.5 md:px-3 rounded-xl hidden sm:flex items-center gap-1.5 text-sm font-semibold shrink-0" title="KDS">
            <Monitor className="h-4 w-4" /> <span className="hidden lg:inline">KDS</span>
          </button>
        </header>


        <div className="flex-1 min-h-0 flex gap-3">
          <section className="flex-1 min-w-0 pos-panel rounded-2xl overflow-hidden order-1 pb-20 md:pb-0">
            <POSProductGrid
              branchId={userProfile?.branch_id || null}
              onAdd={cart.addItem}
              onAddBundle={cart.addBundle}
              onAddCustom={cart.addCustomItem}
            />
          </section>
          {cartDrawerNode(false)}
        </div>
      </main>

      {/* Mobile floating cart dock */}
      <div className="md:hidden fixed inset-x-2 bottom-2 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          onClick={() => setCartOpen(true)}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-between px-4 active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-5 w-5" />
            {cart.totals.itemCount} item
          </span>
          <span className="pos-number font-bold text-base">{fmtRp(paymentTotal)} ›</span>
        </button>
      </div>
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="h-[92dvh] p-0">
          <div className="flex-1 min-h-0 overflow-hidden">{cartDrawerNode(true)}</div>
        </DrawerContent>
      </Drawer>
      {renderModals()}
    </div>
  );

  function cartDrawerNode(mobile: boolean) {
    return (
          <section className={mobile ? 'h-full overflow-hidden' : 'hidden md:block w-[330px] lg:w-[370px] xl:w-[410px] shrink-0 pos-panel rounded-2xl overflow-hidden order-2'}>
            <POSCart
            items={cart.items}
            totals={cart.totals}
            orderType={orderType}
            setOrderType={setOrderType}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            externalOrderId={externalOrderId}
            setExternalOrderId={setExternalOrderId}
            customerName={customerName}
            setCustomerName={setCustomerName}
            discountBill={cart.discountBill}
            setDiscountBill={cart.setDiscountBill}
            updateQty={cart.updateQty}
            updateNotes={cart.updateNotes}
            setItemDiscount={cart.setItemDiscount}
            removeItem={cart.removeItem}
            onClear={cart.clear}
            onPay={() => { setCartOpen(false); setPaymentOpen(true); }}
            onSplit={() => { setCartOpen(false); setSplitOpen(true); }}
            branchId={userProfile?.branch_id || null}
            appliedPromos={promo.appliedPromos}
            onApplyVoucher={handleApplyVoucher}
            onRemovePromo={promo.removePromo}
            totalPromoDiscount={totalPromoDiscount}
            member={member}
            onScanMember={() => setMemberScanOpen(true)}
            onClearMember={() => {
              setMember(null);
              setRedemption(null);
            }}
            onRedeemPoints={() => setRedeemOpen(true)}
            onShowMemberHistory={() => setHistoryOpen(true)}
            redemption={redemption}
            onClearRedemption={() => setRedemption(null)}
            memberMinTransaction={loyaltySettings.min_transaction}
            onOpenTables={() => setTableMapOpen(true)}
            onHoldToTable={handleHoldToTable}
          />
          </section>
    );
  }

  function renderModals() {
    return (
    <>
      <OpenShiftModal open={!activeShift && !shiftLoading} onOpen={handleOpenShift} />
      <POSPayment
        open={paymentOpen}
        total={paymentTotal}
        onClose={() => {
          setPaymentOpen(false);
          if (pendingSplit) {
            setPendingSplit(null);
            setSplitIndex(0);
          }
        }}
        onConfirm={handlePay}
      />
      <POSTableMap
        open={tableMapOpen}
        onOpenChange={setTableMapOpen}
        branchId={userProfile?.branch_id || null}
        canManage={canManageTables}
        selectedTableId={selectedTable?.id || null}
        onSelect={handleSelectTable}
        onRecall={handleRecallTable}
      />
      <POSReceipt open={!!receipt} data={receipt} onClose={() => setReceipt(null)}
        onPrint={() => receipt && safePrint(() => printReceipt(printSettings, receipt, false))} />
      <POSPrinterSettings open={printerOpen} onOpenChange={setPrinterOpen} branchId={userProfile?.branch_id || null}
        userId={userProfile?.id} onSaved={setPrintSettings} />
      <POSShiftReport open={!!report} onOpenChange={(o) => !o && setReport(null)} shift={report?.shift || null}
        kind={report?.kind || 'X'} branchName={branchName} kasirName={userProfile?.full_name || 'Kasir'} settings={printSettings} />
      <POSSplitBillDialog
        open={splitOpen}
        items={cart.items}
        total={Math.max(0, cart.totals.total - totalPromoDiscount)}
        onClose={() => setSplitOpen(false)}
        onConfirm={handleSplitConfirm}
      />
      <CloseShiftModal
        open={closeOpen}
        expectedCash={activeShift ? Number(activeShift.opening_cash) + Number(activeShift.total_cash_in) - Number(activeShift.total_cash_out) : 0}
        onClose={() => setCloseOpen(false)}
        onConfirm={handleCloseShift}
      />
      <CashMovementModal open={cashOpen} onClose={() => setCashOpen(false)} onSubmit={addCashMovement} />
      <MemberScanDialog
        open={memberScanOpen}
        onOpenChange={setMemberScanOpen}
        onSelect={setMember}
        amount={Math.max(0, cart.totals.total - totalPromoDiscount)}
      />
      <LoyaltyRedeemDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        memberId={member?.id}
        memberPoints={member?.points ?? 0}
        amount={Math.max(0, cart.totals.total - totalPromoDiscount)}
        onRedeemed={(r) => {
          setRedemption(r);
          setMember((m) => (m ? { ...m, points: r.remaining_points } : m));
        }}
      />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Poin {member?.name || ''}</DialogTitle>
          </DialogHeader>
          <PointsHistoryList memberId={member?.id} limit={30} />
        </DialogContent>
      </Dialog>
    </>
    );
  }
};

export default POSMain;
