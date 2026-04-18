import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePOSShift } from '@/hooks/usePOSShift';
import { usePOSCart } from '@/hooks/usePOSCart';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { POSHeader } from '@/components/pos/POSHeader';
import { POSProductGrid } from '@/components/pos/POSProductGrid';
import { POSCart } from '@/components/pos/POSCart';
import { POSPayment } from '@/components/pos/POSPayment';
import { POSReceipt, ReceiptData } from '@/components/pos/POSReceipt';
import { OpenShiftModal, CloseShiftModal, CashMovementModal } from '@/components/pos/POSShiftModal';

const POSMain = () => {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { activeShift, loading: shiftLoading, openShift, closeShift, addCashMovement } = usePOSShift();
  const cart = usePOSCart();

  const [branchName, setBranchName] = useState('Cabang');
  const [orderType, setOrderType] = useState('take_away');
  const [tableNumber, setTableNumber] = useState('');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

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
        .select('name')
        .eq('id', userProfile.branch_id)
        .maybeSingle();
      if (data?.name) setBranchName(data.name);
    };
    loadBranch();
  }, [userProfile?.branch_id]);

  const generateTxNumber = () => {
    const d = new Date();
    const y = d.getFullYear().toString().slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const t = String(d.getTime()).slice(-6);
    return `POS${y}${m}${day}-${t}`;
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
      const { data: tx, error: txErr } = await supabase
        .from('pos_transactions')
        .insert({
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
          discount_bill: cart.totals.discountBill,
          service_charge: cart.totals.serviceCharge,
          tax: cart.totals.tax,
          total: cart.totals.total,
          payment_method_1: payload.method1,
          amount_1: payload.amount1,
          payment_method_2: payload.method2,
          amount_2: payload.amount2,
          cash_received: payload.cashReceived,
          change_amount: payload.change,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (txErr) throw txErr;

      const itemsPayload = cart.items.map((i) => ({
        transaction_id: tx.id,
        product_id: i.product_id,
        product_code: i.product_code,
        product_name: i.product_name,
        category: i.category,
        price: i.price,
        qty: i.qty,
        discount_item: i.discount_item,
        subtotal_item: i.price * i.qty - i.discount_item * i.qty,
        notes: i.notes || null,
      }));
      const { error: itemErr } = await supabase.from('pos_transaction_items').insert(itemsPayload);
      if (itemErr) throw itemErr;

      // Build receipt
      setReceipt({
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
          subtotal: i.price * i.qty,
          notes: i.notes,
        })),
        subtotal: cart.totals.subtotal,
        discount: cart.totals.discountItem + cart.totals.discountBill,
        service_charge: cart.totals.serviceCharge,
        tax: cart.totals.tax,
        total: cart.totals.total,
        payment_method_1: payload.method1,
        amount_1: payload.amount1,
        payment_method_2: payload.method2,
        amount_2: payload.amount2,
        cash_received: payload.cashReceived,
        change_amount: payload.change,
      });

      setPaymentOpen(false);
      cart.clear();
      setTableNumber('');
      setExternalOrderId('');
      setCustomerName('');
      toast.success('Pembayaran berhasil');
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses pembayaran');
    }
  };

  const handleCloseShift = async (closingCash: number, notes: string) => {
    try {
      await closeShift(closingCash, notes);
      toast.success('Shift berhasil ditutup');
      setCloseOpen(false);
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

  return (
    <div className="h-screen flex flex-col bg-background">
      <POSHeader
        branchName={branchName}
        kasirName={userProfile?.full_name || 'Kasir'}
        shiftType={activeShift?.shift_type}
        online={online}
        onCloseShift={() => setCloseOpen(true)}
        onCashMovement={() => setCashOpen(true)}
        onLogout={signOut}
      />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          <POSProductGrid branchId={userProfile?.branch_id || null} onAdd={cart.addItem} />
        </div>
        <div className="w-[400px] flex-shrink-0">
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
            removeItem={cart.removeItem}
            onClear={cart.clear}
            onPay={() => setPaymentOpen(true)}
          />
        </div>
      </div>

      <OpenShiftModal open={!activeShift && !shiftLoading} onOpen={handleOpenShift} />
      <POSPayment open={paymentOpen} total={cart.totals.total} onClose={() => setPaymentOpen(false)} onConfirm={handlePay} />
      <POSReceipt open={!!receipt} data={receipt} onClose={() => setReceipt(null)} />
      <CloseShiftModal
        open={closeOpen}
        expectedCash={activeShift ? Number(activeShift.opening_cash) + Number(activeShift.total_cash_in) - Number(activeShift.total_cash_out) : 0}
        onClose={() => setCloseOpen(false)}
        onConfirm={handleCloseShift}
      />
      <CashMovementModal open={cashOpen} onClose={() => setCashOpen(false)} onSubmit={addCashMovement} />
    </div>
  );
};

export default POSMain;
