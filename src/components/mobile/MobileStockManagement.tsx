import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, 
  Upload, 
  CheckCircle, 
  Clock,
  AlertCircle,
  Camera,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Tag,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";

interface StockItem {
  id: string;
  product_id: string;
  product?: {
    id: string;
    name: string;
    category: string;
  };
  quantity: number;
  status: string;
  created_at: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  verification_photo_url?: string;
  notes?: string;
}

interface ShiftSummary {
  totalSales: number;
  cashSales: number;
  qrisSales: number;
  transferSales: number;
  totalTransactions: number;
}

interface OperationalExpense {
  type: string;
  amount: string;
  description: string;
}

// Stock Return Component
const StockReturnTab = ({ userProfile, activeShift, onRefresh, onGoToShift }: { 
  userProfile: any; 
  activeShift: any; 
  onRefresh: () => void; 
  onGoToShift: () => void;
}) => {
  const [returnableStock, setReturnableStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReturnableStock();
  }, [userProfile?.id, activeShift]);

  const fetchReturnableStock = async () => {
    try {
      if (!userProfile?.id) return;

      // Fetch current inventory (remaining stock that needs to be returned)
      const { data: inventory } = await supabase
        .from('inventory')
        .select(`
          *,
          products(id, name, category, price)
        `)
        .eq('rider_id', userProfile.id)
        .gt('stock_quantity', 0);

      setReturnableStock(inventory || []);
    } catch (error: any) {
      toast.error("Gagal memuat stok untuk dikembalikan");
    }
  };

  const handleStockReturn = async (inventoryId: string, quantity: number) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // NOTE: Previously we blocked returns if there were active shifts from previous days.
      // This caused a deadlock with shift reporting. We now allow returns regardless of
      // previous-day shift state to decouple attendance/shift logic from stock returns.

      // Improved camera/gallery functionality with native mobile support
      const showImageSourceModal = () => {
        return new Promise<File | null>((resolve) => {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isAndroid = /Android/.test(navigator.userAgent);

          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.style.position = 'fixed';
          fileInput.style.left = '-9999px';
          fileInput.style.opacity = '0';

          // Append to DOM to satisfy iOS/Safari requirements
          document.body.appendChild(fileInput);

          // Ask source on mobile devices
          if (isIOS || isAndroid) {
            const useCamera = window.confirm('Pilih sumber foto:\nOK = Kamera, Cancel = Galeri');
            if (useCamera) {
              // Prefer back camera
              fileInput.setAttribute('capture', 'environment');
              // Some browsers honor this MIME hint
              fileInput.accept = 'image/*;capture=camera';
            }
          }

          fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0] || null;
            resolve(file);
            // Clean up
            setTimeout(() => fileInput.remove(), 0);
          };

          // Trigger picker within the same user gesture
          setTimeout(() => fileInput.click(), 0);
        });
      };

      const photo = await showImageSourceModal();

      if (!photo) {
        toast.error("Foto wajib untuk pengembalian stok");
        return;
      }

      // Upload photo (robust upload with folder + upsert)
      const fileExt = photo.name.split('.').pop();
      const fileName = `return-${inventoryId}-${Date.now()}.${fileExt}`;
      const path = `returns/${userProfile?.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('stock-photos')
        .upload(path, photo, { cacheControl: '3600', upsert: true, contentType: photo.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stock-photos')
        .getPublicUrl(path);

      // Create return stock movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          rider_id: userProfile.id,
          branch_id: userProfile.branch_id,
          product_id: returnableStock.find(item => item.id === inventoryId)?.product_id,
          movement_type: 'return',
          quantity: quantity,
          status: 'returned',
          verification_photo_url: publicUrl,
          notes: 'Pengembalian stok di akhir shift',
          actual_delivery_date: new Date().toISOString()
        }]);

      if (movementError) throw movementError;

      // Update inventory to reduce returned stock
      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({ 
          stock_quantity: 0  // All remaining stock returned
        })
        .eq('id', inventoryId);

      if (inventoryError) throw inventoryError;

      toast.success("Stok berhasil dikembalikan!");
      fetchReturnableStock();
      onRefresh();
      // Beritahu parent untuk refresh status persediaan
      window.dispatchEvent(new Event('inventory-updated'));
      
      // Check if all stock has been returned
      const { data: remainingAfterReturn } = await supabase
        .from('inventory')
        .select('id')
        .eq('rider_id', userProfile.id)
        .gt('stock_quantity', 0);

      // Auto-navigate to shift report only if ALL stock is returned
      if (!remainingAfterReturn || remainingAfterReturn.length === 0) {
        setTimeout(() => {
          onGoToShift();
          toast.info("Semua stok telah dikembalikan. Silakan lengkapi laporan shift");
        }, 1000);
      }
    } catch (error: any) {
      toast.error("Gagal mengembalikan stok: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pengembalian Stok</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchReturnableStock}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <ScrollArea className="h-96">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Stok sisa yang harus dikembalikan ke branch di akhir shift:
          </p>
          
          {returnableStock.map((item) => (
            <Card key={item.id} className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{item.products?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Sisa: {item.stock_quantity} | Kategori: {item.products?.category}
                    </p>
                    <p className="text-xs text-orange-600">
                      Harga: Rp {item.products?.price?.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    <Package className="h-3 w-3 mr-1" />
                    Sisa Stok
                  </Badge>
                </div>

                   <Button
                     size="sm"
                     variant="destructive"
                     onClick={() => handleStockReturn(item.id, item.stock_quantity)}
                     disabled={loading}
                     className="w-full"
                   >
                     <Camera className="h-4 w-4 mr-1" />
                     Kembalikan Stok (Foto Wajib)
                   </Button>
              </CardContent>
            </Card>
          ))}

          {returnableStock.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-green-600 font-medium">Semua stok sudah terjual atau dikembalikan</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const MobileStockManagement = () => {
  const { userProfile } = useAuth();
  const [pendingStock, setPendingStock] = useState<StockItem[]>([]);
  const [receivedStock, setReceivedStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [tab, setTab] = useState<'receive' | 'return' | 'history' | 'shift'>('receive');
  const [cashDepositPhoto, setCashDepositPhoto] = useState<File | undefined>(undefined);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary>({
    totalSales: 0,
    cashSales: 0,
    qrisSales: 0,
    transferSales: 0,
    totalTransactions: 0
  });
  const [remainingStockCount, setRemainingStockCount] = useState<number>(0);
  const [operationalExpenses, setOperationalExpenses] = useState<OperationalExpense[]>([
    { type: '', amount: '', description: '' }
  ]);
  const [expensePhotos, setExpensePhotos] = useState<(File | undefined)[]>([undefined]);
  
  // New state for checkbox bulk confirmation
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());
  const [bulkConfirmPhoto, setBulkConfirmPhoto] = useState<File | undefined>(undefined);

  useEffect(() => {
    fetchStockData();
    fetchShiftData();
  }, []);

  // Refresh shift data whenever inventory changes
  useEffect(() => {
    const handler = () => fetchShiftData();
    window.addEventListener('inventory-updated', handler);
    return () => window.removeEventListener('inventory-updated', handler);
  }, []);
  const fetchStockData = async () => {
    try {
      if (!userProfile?.id) return;

      // Fetch pending stock transfers
      const { data: pending } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name, category)
        `)
        .eq('rider_id', userProfile.id)
        .eq('movement_type', 'transfer')
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      setPendingStock(pending || []);

      // Fetch received stock
      const { data: received } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name, category)
        `)
        .eq('rider_id', userProfile.id)
        .eq('movement_type', 'transfer')
        .eq('status', 'received')
        .order('actual_delivery_date', { ascending: false })
        .limit(20);

      setReceivedStock(received || []);
    } catch (error: any) {
      toast.error("Gagal memuat data stok");
    }
  };

  const fetchShiftData = async () => {
    try {
      if (!userProfile?.id) return;

      // Get active shift
      const { data: shift } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', userProfile.id)
        .eq('shift_date', new Date().toISOString().split('T')[0])
        .eq('status', 'active')
        .maybeSingle();

      setActiveShift(shift);

      // Get sales summary scoped to active shift time window (or today if no shift)
      const today = new Date().toISOString().split('T')[0];
      let startRange = `${today}T00:00:00`;
      let endRange = new Date().toISOString();
      
      // If shift is active, use shift start time and current time
      if (shift?.shift_start_time) {
        startRange = shift.shift_start_time;
        // For active shift, use current time as end range
        endRange = new Date().toISOString();
      }
      
      // Check remaining rider stock that must be returned before report
      const { data: remaining } = await supabase
        .from('inventory')
        .select('id')
        .eq('rider_id', userProfile.id)
        .gt('stock_quantity', 0);
      setRemainingStockCount(remaining?.length || 0);
      
      console.log('Fetching transactions for rider:', userProfile.id);
      console.log('Date range:', { startRange, endRange });

      // Use broader query to catch all transactions for this rider today
      const { data: allTransactions, error: allTransError } = await supabase
        .from('transactions')
        .select('final_amount, payment_method, transaction_date, status, id')
        .eq('rider_id', userProfile.id)
        .gte('transaction_date', `${today}T00:00:00`)
        .lte('transaction_date', endRange)
        .order('transaction_date', { ascending: false });

      console.log('All transactions today:', allTransactions);

      if (allTransError) {
        console.error('Transaction query error:', allTransError);
        return;
      }

      // Filter for shift period if shift exists, otherwise use all today's transactions
      let rangeTransactions = allTransactions || [];
      
      if (shift?.shift_start_time) {
        rangeTransactions = allTransactions?.filter(t => 
          new Date(t.transaction_date) >= new Date(shift.shift_start_time) &&
          (t.status === 'completed' || t.status === 'pending')
        ) || [];
      }

      console.log('Filtered transactions for shift:', rangeTransactions);

      const cashSales = rangeTransactions
        ?.filter(t => (t.payment_method || '').toLowerCase() === 'cash')
        ?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;

      const qrisSales = rangeTransactions
        ?.filter(t => (t.payment_method || '').toLowerCase() === 'qris')
        ?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;

      const transferSales = rangeTransactions
        ?.filter(t => ['transfer', 'bank_transfer', 'bank'].includes((t.payment_method || '').toLowerCase()))
        ?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;

      const totalSales = cashSales + qrisSales + transferSales;

      console.log('Sales summary:', { cashSales, qrisSales, transferSales, totalSales, count: rangeTransactions?.length });

      setShiftSummary({
        totalSales,
        cashSales,
        qrisSales,
        transferSales,
        totalTransactions: rangeTransactions?.length || 0
      });
    } catch (error: any) {
      console.error("Error fetching shift data:", error);
    }
  };

  const confirmStockReceival = async (stockId: string) => {
    setLoading(true);
    try {
      const currentTime = new Date().toISOString();
      // NOTE: Allow confirming stocks regardless of the day they were sent to avoid blocking
      // previous pending transfers. This restores previous behavior.
      // (Removed strict same-day validation)
      
      const { error } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'received',
          actual_delivery_date: currentTime,
          notes: 'Stok diterima dan dikonfirmasi oleh rider'
        })
        .eq('id', stockId);

      if (error) throw error;

      // 2) Update rider inventory so items appear in Selling & Return tabs
      const transfer = pendingStock.find((t) => t.id === stockId) || receivedStock.find((t) => t.id === stockId);
      let productId = transfer?.product_id as string | undefined;
      let qty = transfer?.quantity as number | undefined;

      if (!productId || !qty) {
        const { data: fetched } = await supabase
          .from('stock_movements')
          .select('product_id, quantity')
          .eq('id', stockId)
          .maybeSingle();
        productId = fetched?.product_id as string | undefined;
        qty = (fetched?.quantity as number | undefined) ?? 0;
      }

      if (productId && qty && userProfile?.id) {
        // Check existing inventory
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('rider_id', userProfile.id)
          .eq('product_id', productId)
          .maybeSingle();

        if (existingInventory) {
          await supabase
            .from('inventory')
            .update({
              stock_quantity: (existingInventory.stock_quantity || 0) + qty,
              last_updated: new Date().toISOString(),
            })
            .eq('id', existingInventory.id);
        } else {
          await supabase
            .from('inventory')
            .insert([{
              rider_id: userProfile.id,
              branch_id: userProfile.branch_id,
              product_id: productId,
              stock_quantity: qty,
            }]);
        }
      }

      // AUTO SHIFT IN: Start shift automatically when receiving stock
      if (userProfile?.id) {
        const today = new Date().toISOString().split('T')[0];
        // Check if there's already an active shift today
        const { data: existingShift } = await supabase
          .from('shift_management')
          .select('*')
          .eq('rider_id', userProfile.id)
          .eq('shift_date', today)
          .eq('status', 'active')
          .maybeSingle();

        if (!existingShift) {
          // Get next shift number
          const { data: lastShift } = await supabase
            .from('shift_management')
            .select('shift_number')
            .eq('rider_id', userProfile.id)
            .eq('shift_date', today)
            .order('shift_number', { ascending: false })
            .limit(1);

          const nextNumber = lastShift && lastShift.length > 0
            ? (lastShift[0].shift_number || 0) + 1
            : 1;

          // Create new active shift
          const { data: newShift } = await supabase
            .from('shift_management')
            .insert([{
              rider_id: userProfile.id,
              branch_id: userProfile.branch_id,
              shift_date: today,
              shift_start_time: currentTime,
              status: 'active',
              shift_number: nextNumber
            }])
            .select()
            .single();
          
          toast.success(`Shift ${nextNumber} otomatis dimulai setelah menerima stok!`);
          fetchShiftData(); // Refresh shift data
          
          // Notify dashboard to update shift status
          window.dispatchEvent(new CustomEvent('shift-started', { detail: newShift }));
        }
      }

      toast.success('Stok dikonfirmasi diterima dan siap dijual!');
      await fetchStockData();
      window.dispatchEvent(new Event('stock-received')); // Trigger notification
    } catch (error: any) {
      toast.error('Gagal konfirmasi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadVerificationPhoto = async (stockId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `stock-${stockId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('stock-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stock-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('stock_movements')
        .update({ 
          verification_photo_url: publicUrl
        })
        .eq('id', stockId);

      if (updateError) throw updateError;

      toast.success("Foto verifikasi berhasil diupload!");
      fetchStockData();
    } catch (error: any) {
      toast.error("Gagal upload foto: " + error.message);
    }
  };

  const addExpense = () => {
    setOperationalExpenses([...operationalExpenses, { type: '', amount: '', description: '' }]);
    setExpensePhotos([...expensePhotos, undefined]);
  };

  const removeExpense = (index: number) => {
    setOperationalExpenses(operationalExpenses.filter((_, i) => i !== index));
    setExpensePhotos(expensePhotos.filter((_, i) => i !== index));
  };

  const updateExpense = (index: number, field: keyof OperationalExpense, value: string) => {
    const updated = [...operationalExpenses];
    updated[index][field] = value;
    setOperationalExpenses(updated);
  };

  const handleSubmitShiftReport = async () => {
    if (!userProfile?.id || !activeShift) {
      toast.error("Lengkapi semua data terlebih dahulu");
      return;
    }
    if (remainingStockCount > 0) {
      toast.error("Masih ada stok tersisa. Kembalikan stok terlebih dahulu sebelum menutup shift.");
      setTab('return');
      return;
    }

    setLoading(true);
    try {
      // Calculate totals
      const totalOperationalExpenses = operationalExpenses.reduce((sum, expense) => 
        sum + parseFloat(expense.amount || '0'), 0
      );

      // Cash deposit = Cash Sales - Operational Expenses (auto-calculated, non-editable)
      const cashToDeposit = Math.max(0, shiftSummary.cashSales - totalOperationalExpenses);

      // Upload cash deposit photo if provided
      let cashPhotoUrl: string | undefined;
      if (cashDepositPhoto) {
        const ext = cashDepositPhoto.name.split('.').pop();
        const fileName = `cash-deposit-${activeShift.id}-${Date.now()}.${ext}`;
        const filePath = `shift-deposits/${userProfile.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, cashDepositPhoto, {
            upsert: true,
            cacheControl: '3600',
            contentType: cashDepositPhoto.type
          });

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(filePath);
          cashPhotoUrl = publicUrl;
        }
      }

      // Save operational expenses to daily_operational_expenses table (with optional receipt photo)
      let expenseInserts: any[] = [];
      if (operationalExpenses.length > 0) {
        expenseInserts = await Promise.all(
          operationalExpenses
            .filter(expense => expense.type && expense.amount)
            .map(async (expense, idx) => {
              let receiptPath: string | undefined;
              const photo = expensePhotos[idx];
              if (photo) {
                const ext = photo.name.split('.').pop();
                const fileName = `receipt-${activeShift.id}-${idx}-${Date.now()}.${ext}`;
                receiptPath = `receipts/${userProfile.id}/${fileName}`;
                const { error: recErr } = await supabase.storage
                  .from('expense-receipts')
                  .upload(receiptPath, photo, { upsert: true, cacheControl: '3600', contentType: photo.type });
                if (recErr) console.error('Upload receipt error:', recErr);
              }
              return {
                rider_id: userProfile.id,
                shift_id: activeShift.id,
                expense_type: expense.type,
                amount: parseFloat(expense.amount),
                description: expense.description,
                expense_date: new Date().toISOString().split('T')[0],
                receipt_photo_url: receiptPath
              };
            })
        );
      }

      if (expenseInserts.length > 0) {
        const { error: expenseError } = await supabase
          .from('daily_operational_expenses')
          .insert(expenseInserts);
        if (expenseError) throw expenseError;
      }

      // Create daily report for branch verification once (skip updates due to RLS)
      const { data: existingReport, error: checkError } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('rider_id', userProfile.id)
        .eq('shift_id', activeShift.id)
        .maybeSingle();
      if (checkError) throw checkError;

      if (!existingReport) {
        const { error: reportError } = await supabase
          .from('daily_reports')
          .insert({
            rider_id: userProfile.id,
            shift_id: activeShift.id,
            branch_id: userProfile.branch_id,
            report_date: new Date().toISOString().split('T')[0],
            total_sales: shiftSummary.totalSales,
            cash_collected: cashToDeposit,
            total_transactions: shiftSummary.totalTransactions
          });
        if (reportError) throw reportError;
      }

      // AUTO SHIFT OUT: Complete shift and end automatically
      const updateData: any = {
        status: 'completed',
        report_submitted: true,
        total_sales: shiftSummary.totalSales,
        cash_collected: cashToDeposit,
        total_transactions: shiftSummary.totalTransactions,
        shift_end_time: new Date().toISOString()
      };

      if (cashPhotoUrl) {
        // Store photo URL in notes field
        updateData.notes = `Cash deposit photo: ${cashPhotoUrl}`;
      }

      const { error: shiftError } = await supabase
        .from('shift_management')
        .update(updateData)
        .eq('id', activeShift.id);

      if (shiftError) throw shiftError;

      toast.success("Laporan shift berhasil dikirim dan siap diverifikasi!");
      setOperationalExpenses([{ type: '', amount: '', description: '' }]);
      setExpensePhotos([undefined]);
      setCashDepositPhoto(undefined);
      setActiveShift(null);
      window.dispatchEvent(new Event('shift-updated'));
      fetchShiftData();
    } catch (error: any) {
      toast.error("Gagal kirim laporan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkConfirmation = async () => {
    if (selectedStockIds.size === 0) {
      toast.error("Pilih minimal satu stok untuk dikonfirmasi");
      return;
    }

    setLoading(true);
    try {
      const selectedItems = pendingStock.filter(item => selectedStockIds.has(item.id));
      
      for (const item of selectedItems) {
        await confirmStockReceival(item.id);
      }

      // Upload bulk photo if provided
      if (bulkConfirmPhoto) {
        // Upload to first selected item as representative
        const firstItemId = Array.from(selectedStockIds)[0];
        await uploadVerificationPhoto(firstItemId, bulkConfirmPhoto);
      }

      // Clear selections
      setSelectedStockIds(new Set());
      setBulkConfirmPhoto(undefined);
      
      toast.success(`${selectedItems.length} stok berhasil dikonfirmasi!`);
      
    } catch (error: any) {
      toast.error("Gagal konfirmasi stok: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white overflow-x-hidden">
      <div className="w-full max-w-md mx-auto space-y-6 px-4 py-4">
        {/* Sticky Header - Enhanced for lock */}
        <div className="sticky top-0 z-50 bg-white border-b shadow-md p-4 -mx-4 mb-2 rounded-b-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Kelola Stok & Shift</h1>
          </div>
          
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 text-xs bg-muted rounded-full">
              <TabsTrigger value="receive" className="rounded-full">
                Terima
                {pendingStock.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {pendingStock.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="return">Kembali</TabsTrigger>
              <TabsTrigger value="history">Riwayat</TabsTrigger>
              <TabsTrigger value="shift">
                Shift
                {activeShift && !activeShift.report_submitted && (
                  <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent className="p-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">

              {/* Stock Receive Tab - Enhanced with checkbox bulk confirmation */}
              <TabsContent value="receive" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Konfirmasi Stok Masuk</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchStockData}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <ScrollArea className="h-96">
                  <div className="space-y-4">
                     {pendingStock.map((item) => (
                       <Card key={item.id} className="border-l-4 border-l-orange-500 table-row-highlight">
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded-full border-2 border-primary"
                                    checked={selectedStockIds.has(item.id)}
                                    onChange={(e) => {
                                      const newSelected = new Set(selectedStockIds);
                                      if (e.target.checked) {
                                        newSelected.add(item.id);
                                      } else {
                                        newSelected.delete(item.id);
                                      }
                                     setSelectedStockIds(newSelected);
                                   }}
                                 />
                                 <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                   <Clock className="h-3 w-3 mr-1" />
                                   Menunggu
                                 </Badge>
                               </div>
                             </div>
                             
                              <div className="bg-muted/50 p-3 rounded-lg">
                                <h4 className="text-lg font-bold text-foreground mb-2">
                                  {item.product?.name || `Produk ID: ${item.product_id}`}
                                </h4>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" />
                                    <span className="font-semibold text-primary">Jumlah: {item.quantity} pcs</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                      Kategori: {item.product?.category || 'Tidak diketahui'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                             
                             {item.expected_delivery_date && (
                               <p className="text-xs text-muted-foreground">
                                 Target: {new Date(item.expected_delivery_date).toLocaleString('id-ID')}
                               </p>
                             )}
                           </div>
                        </CardContent>
                      </Card>
                    ))}

                    {pendingStock.length === 0 && (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tidak ada stok pending</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Bulk confirmation section */}
                {selectedStockIds.size > 0 && (
                  <div className="sticky bottom-0 bg-white border-t p-4 -mx-4 space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">Total Stok yang Akan Diterima:</p>
                      <div className="text-lg font-bold text-blue-600">
                        {pendingStock
                          .filter(item => selectedStockIds.has(item.id))
                          .reduce((total, item) => total + item.quantity, 0)} items
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {selectedStockIds.size} produk dipilih
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        id="bulk-photo"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBulkConfirmPhoto(file);
                            toast.success("Foto bukti berhasil diambil!");
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('bulk-photo')?.click()}
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Foto (Opsional)
                      </Button>
                      
                      <Button
                        className="flex-1 rounded-full"
                        onClick={handleBulkConfirmation}
                        disabled={loading || selectedStockIds.size === 0}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Konfirmasi Penerimaan Stok ({selectedStockIds.size})
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Stock Return Tab */}
              <TabsContent value="return" className="space-y-4">
                <StockReturnTab 
                  userProfile={userProfile} 
                  activeShift={activeShift}
                  onRefresh={fetchStockData}
                  onGoToShift={() => setTab('shift')}
                />
              </TabsContent>

              {/* Stock History Tab */}
              <TabsContent value="history" className="space-y-4">
                <h3 className="text-lg font-semibold">Riwayat Penerimaan Stok</h3>
                
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {receivedStock.map((item) => (
                      <Card key={item.id} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium">{item.product?.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Jumlah: {item.quantity} | Kategori: {item.product?.category}
                              </p>
                              {item.actual_delivery_date && (
                                <p className="text-xs text-green-600">
                                  Diterima: {new Date(item.actual_delivery_date).toLocaleString('id-ID')}
                                </p>
                              )}
                            </div>
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Diterima
                            </Badge>
                          </div>

                          {item.verification_photo_url && (
                            <div className="mt-3">
                              <img 
                                src={item.verification_photo_url} 
                                alt="Verifikasi stok" 
                                className="max-w-xs rounded-lg border"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {receivedStock.length === 0 && (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Belum ada riwayat penerimaan</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Shift Report Tab */}
              <TabsContent value="shift" className="space-y-4">
                {activeShift ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {!activeShift.report_submitted ? (
                        <>
                          <AlertCircle className="h-5 w-5 text-orange-500" />
                          <h3 className="text-lg font-semibold text-orange-700">
                            Shift Aktif - Laporan Shift
                          </h3>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <h3 className="text-lg font-semibold text-green-700">
                            Resume Shift - Edit Laporan
                          </h3>
                        </>
                      )}
                    </div>

                    {/* Sales Summary */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">Resume Penjualan Hari Ini</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Penjualan Tunai:</span>
                          <span className="font-semibold">{formatCurrency(shiftSummary.cashSales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Penjualan QRIS:</span>
                          <span className="font-semibold">{formatCurrency(shiftSummary.qrisSales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Penjualan Transfer:</span>
                          <span className="font-semibold">{formatCurrency(shiftSummary.transferSales)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="font-medium">Total Penjualan:</span>
                          <span className="font-semibold text-blue-600">{formatCurrency(shiftSummary.totalSales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Transaksi:</span>
                          <span className="font-semibold">{shiftSummary.totalTransactions}</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Expenses Input */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Beban Operasional
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         {operationalExpenses.map((expense, index) => (
                           <div key={index} className="border rounded-lg p-3 space-y-3">
                             <div className="grid grid-cols-2 gap-3">
                               <Input
                                 placeholder="Jenis beban"
                                 value={expense.type}
                                 onChange={(e) => updateExpense(index, 'type', e.target.value)}
                               />
                               <Input
                                 type="number"
                                 placeholder="Jumlah"
                                 value={expense.amount}
                                 onChange={(e) => updateExpense(index, 'amount', e.target.value)}
                               />
                             </div>
                             <div className="flex gap-3">
                               <Input
                                 placeholder="Deskripsi (opsional)"
                                 value={expense.description}
                                 onChange={(e) => updateExpense(index, 'description', e.target.value)}
                                 className="flex-1"
                               />
                               <input
                                 type="file"
                                 accept="image/*"
                                 capture="environment"
                                 style={{ display: 'none' }}
                                 id={`receipt-${index}`}
                                 onChange={(e) => {
                                   const file = e.target.files?.[0];
                                   if (file) {
                                     toast.success("Foto struk berhasil diupload!");
                                   }
                                 }}
                               />
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => document.getElementById(`receipt-${index}`)?.click()}
                                 title="Upload foto struk/nota"
                               >
                                 <Camera className="h-4 w-4" />
                               </Button>
                               {operationalExpenses.length > 1 && (
                                 <Button
                                   variant="destructive"
                                   size="sm"
                                   onClick={() => removeExpense(index)}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               )}
                             </div>
                           </div>
                         ))}
                        
                        <Button
                          variant="outline"
                          onClick={addExpense}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Tambah Beban
                        </Button>

                        {/* Auto-calculated cash deposit */}
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <p className="text-sm font-medium text-green-800 mb-2">Setoran Tunai (Otomatis)</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Penjualan Tunai:</span>
                              <span>{formatCurrency(shiftSummary.cashSales)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Beban Operasional:</span>
                              <span>-{formatCurrency(operationalExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0))}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 font-bold text-green-700">
                              <span>Yang Harus Disetor:</span>
                              <span className="text-lg">
                                {formatCurrency(Math.max(0, shiftSummary.cashSales - operationalExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0)))}
                              </span>
                            </div>
                          </div>
                          
                          {/* Optional Cash Deposit Photo */}
                          <div className="mt-3 space-y-2">
                            <Label className="text-sm font-medium text-green-800">
                              Foto Setoran Tunai (Opsional)
                            </Label>
                            <div className="flex gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                id="cash-deposit-photo"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setCashDepositPhoto(file);
                                    toast.success("Foto setoran berhasil diupload!");
                                  }
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('cash-deposit-photo')?.click()}
                                className="flex-1"
                              >
                                <Camera className="h-4 w-4 mr-2" />
                                {cashDepositPhoto ? 'Ganti Foto' : 'Ambil Foto'}
                              </Button>
                              {cashDepositPhoto && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setCashDepositPhoto(undefined)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {cashDepositPhoto && (
                              <p className="text-xs text-green-700">
                                ✓ Foto siap: {cashDepositPhoto.name}
                              </p>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={handleSubmitShiftReport}
                          disabled={loading || remainingStockCount > 0}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {loading ? "Mengirim..." : !activeShift.report_submitted ? "Kirim Laporan Shift" : "Update Laporan Shift"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : !activeShift ? (
                  <div className="space-y-4 text-center py-8">
                    <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-orange-700">Tidak Ada Shift Aktif</h3>
                    <p className="text-muted-foreground">Anda tetap bisa melihat ringkasan penjualan hari ini di bawah ini.</p>
                    <div className="bg-blue-50 p-4 rounded-lg text-left max-w-md mx-auto">
                      <p className="text-sm font-medium text-blue-800 mb-2">Resume Penjualan Hari Ini</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Total Transaksi:</span><span className="font-semibold">{shiftSummary.totalTransactions}</span></div>
                        <div className="flex justify-between"><span>Penjualan Tunai:</span><span className="font-semibold">{formatCurrency(shiftSummary.cashSales)}</span></div>
                        <div className="flex justify-between"><span>Penjualan QRIS:</span><span className="font-semibold">{formatCurrency(shiftSummary.qrisSales)}</span></div>
                        <div className="flex justify-between"><span>Penjualan Transfer:</span><span className="font-semibold">{formatCurrency(shiftSummary.transferSales)}</span></div>
                        <div className="flex justify-between border-t pt-1"><span className="font-medium">Total Penjualan:</span><span className="font-semibold text-blue-600">{formatCurrency(shiftSummary.totalSales)}</span></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-700 mb-2">Resume Shift</h3>
                    <div className="bg-green-50 p-4 rounded-lg text-left max-w-md mx-auto">
                      <p className="text-sm font-medium text-green-800 mb-2">
                        Shift #{activeShift.shift_number} - {new Date(activeShift.shift_date).toLocaleDateString('id-ID')}
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Waktu Mulai:</span>
                          <span className="font-semibold">
                            {activeShift.shift_start_time ? 
                              new Date(activeShift.shift_start_time).toLocaleTimeString('id-ID', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : 
                              'N/A'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Waktu Selesai:</span>
                          <span className="font-semibold">
                            {activeShift.shift_end_time ? 
                              new Date(activeShift.shift_end_time).toLocaleTimeString('id-ID', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : 
                              'N/A'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between"><span>Total Transaksi:</span><span className="font-semibold">{activeShift.total_transactions || 0}</span></div>
                        {/* Breakdown penjualan agar tetap terlihat setelah laporan dikirim */}
                        <div className="flex justify-between"><span>Penjualan Tunai:</span><span className="font-semibold">{formatCurrency(shiftSummary.cashSales)}</span></div>
                        <div className="flex justify-between"><span>Penjualan QRIS:</span><span className="font-semibold">{formatCurrency(shiftSummary.qrisSales)}</span></div>
                        <div className="flex justify-between"><span>Penjualan Transfer:</span><span className="font-semibold">{formatCurrency(shiftSummary.transferSales)}</span></div>
                        <div className="flex justify-between border-t pt-1"><span className="font-medium">Total Penjualan:</span><span className="font-semibold text-green-600">{formatCurrency(activeShift.total_sales || 0)}</span></div>
                        <div className="flex justify-between"><span>Kas Disetor:</span><span className="font-semibold">{formatCurrency(activeShift.cash_collected || 0)}</span></div>
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-4">
                      Laporan shift sudah berhasil dikirim dan menunggu verifikasi branch
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileStockManagement;