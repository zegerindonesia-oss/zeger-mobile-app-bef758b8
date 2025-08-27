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
  Tag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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

      // Check if there are active shifts from previous days (same-day validation)
      const { data: activeShifts } = await supabase
        .from('shift_management')
        .select('shift_date')
        .eq('rider_id', userProfile.id)
        .eq('status', 'active')
        .neq('shift_date', today);

      if (activeShifts && activeShifts.length > 0) {
        toast.error('Selesaikan shift dari hari sebelumnya terlebih dahulu. Pengembalian stok harus di hari yang sama untuk mencegah fraud.');
        setLoading(false);
        return;
      }

      // Take photo for return verification
      const photoInput = document.createElement('input');
      photoInput.type = 'file';
      photoInput.accept = 'image/*';
      photoInput.capture = 'environment';
      
      const photo = await new Promise<File | null>((resolve) => {
        photoInput.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          resolve(file || null);
        };
        photoInput.click();
      });

      if (!photo) {
        toast.error("Foto wajib untuk pengembalian stok");
        return;
      }

      // Upload photo
      const fileExt = photo.name.split('.').pop();
      const fileName = `return-${inventoryId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('stock-photos')
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stock-photos')
        .getPublicUrl(fileName);

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
      
      // Auto-navigate to shift report after stock return
      setTimeout(() => {
        onGoToShift();
        toast.info("Silakan lengkapi laporan shift");
      }, 1000);
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
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary>({
    totalSales: 0,
    cashSales: 0,
    qrisSales: 0,
    totalTransactions: 0
  });
  const [operationalExpenses, setOperationalExpenses] = useState<OperationalExpense[]>([
    { type: '', amount: '', description: '' }
  ]);

  useEffect(() => {
    fetchStockData();
    fetchShiftData();
  }, []);

  const fetchStockData = async () => {
    try {
      if (!userProfile?.id) return;

      // Fetch pending stock transfers
      const { data: pending } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products(id, name, category)
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
          products(id, name, category)
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
        ?.filter(t => t.payment_method === 'cash')
        ?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;

      const nonCashSales = rangeTransactions
        ?.filter(t => t.payment_method && t.payment_method.toLowerCase() !== 'cash')
        ?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;

      const totalSales = cashSales + nonCashSales;

      console.log('Sales summary:', { cashSales, nonCashSales, totalSales, count: rangeTransactions?.length });

      setShiftSummary({
        totalSales,
        cashSales,
        qrisSales: nonCashSales,
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
      const today = new Date().toISOString().split('T')[0];

      // Check if stock was sent today (same-day validation)
      const { data: stockMovement } = await supabase
        .from('stock_movements')
        .select('created_at')
        .eq('id', stockId)
        .single();

      if (stockMovement) {
        const sentDate = new Date(stockMovement.created_at).toISOString().split('T')[0];
        if (sentDate !== today) {
          toast.error('Penerimaan stok hanya bisa dilakukan di hari yang sama dengan pengiriman untuk mencegah fraud');
          setLoading(false);
          return;
        }
      }

      // 1) Mark stock movement as received
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

      toast.success('Stok dikonfirmasi diterima dan siap dijual!');
      await fetchStockData();
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
  };

  const removeExpense = (index: number) => {
    setOperationalExpenses(operationalExpenses.filter((_, i) => i !== index));
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

    setLoading(true);
    try {
      // Calculate totals
      const totalOperationalExpenses = operationalExpenses.reduce((sum, expense) => 
        sum + parseFloat(expense.amount || '0'), 0
      );

      // Cash deposit = Cash Sales - Operational Expenses (auto-calculated, non-editable)
      const cashToDeposit = Math.max(0, shiftSummary.cashSales - totalOperationalExpenses);

      // Save operational expenses to daily_operational_expenses table
      const expenseInserts = operationalExpenses
        .filter(expense => expense.type && expense.amount)
        .map(expense => ({
          rider_id: userProfile.id,
          shift_id: activeShift.id,
          expense_type: expense.type,
          amount: parseFloat(expense.amount),
          description: expense.description,
          expense_date: new Date().toISOString().split('T')[0]
        }));

      if (expenseInserts.length > 0) {
        const { error: expenseError } = await supabase
          .from('daily_operational_expenses')
          .insert(expenseInserts);

        if (expenseError) throw expenseError;
      }

// Create daily report for branch verification (Upsert by shift_id)
      const { error: reportError } = await supabase
        .from('daily_reports')
        .upsert({
          rider_id: userProfile.id,
          shift_id: activeShift.id,
          branch_id: userProfile.branch_id,
          report_date: new Date().toISOString().split('T')[0],
          total_sales: shiftSummary.totalSales,
          cash_collected: cashToDeposit,
          total_transactions: shiftSummary.totalTransactions
        }, {
          onConflict: 'rider_id, shift_id'
        });

      if (reportError) throw reportError;

// Update shift status to completed & auto shift-out
const { error: shiftError } = await supabase
  .from('shift_management')
  .update({
    status: 'completed',
    report_submitted: true,
    total_sales: shiftSummary.totalSales,
    cash_collected: cashToDeposit,
    total_transactions: shiftSummary.totalTransactions,
    shift_end_time: new Date().toISOString()
  })
  .eq('id', activeShift.id);

      if (shiftError) throw shiftError;

      toast.success("Laporan shift berhasil dikirim dan siap diverifikasi!");
      setOperationalExpenses([{ type: '', amount: '', description: '' }]);
      setActiveShift(null);
      window.dispatchEvent(new Event('shift-updated'));
      fetchShiftData();
    } catch (error: any) {
      toast.error("Gagal kirim laporan: " + error.message);
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
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Kelola Stok & Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4 text-xs">
                <TabsTrigger value="receive">
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

              {/* Stock Receive Tab */}
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
                       <Card key={item.id} className="border-l-4 border-l-orange-500">
                         <CardContent className="p-4">
                           <div className="space-y-3">
                             <div className="flex items-center justify-between">
                               <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                 <Clock className="h-3 w-3 mr-1" />
                                 Menunggu
                               </Badge>
                             </div>
                             
                             <div className="bg-muted/50 p-3 rounded-lg">
                               <h4 className="text-lg font-bold text-foreground mb-2">{item.product?.name}</h4>
                               <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                   <Package className="h-4 w-4 text-primary" />
                                   <span className="font-semibold text-primary">Jumlah: {item.quantity} pcs</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   <Tag className="h-4 w-4 text-muted-foreground" />
                                   <span className="text-muted-foreground">Kategori: {item.product?.category}</span>
                                 </div>
                               </div>
                             </div>
                             
                             {item.expected_delivery_date && (
                               <p className="text-xs text-muted-foreground">
                                 Target: {new Date(item.expected_delivery_date).toLocaleString('id-ID')}
                               </p>
                             )}
                           </div>

                           <div className="flex gap-2 mt-4">
                             <Button
                               size="sm"
                               onClick={() => confirmStockReceival(item.id)}
                               disabled={loading}
                               className="flex-1"
                             >
                               <CheckCircle className="h-4 w-4 mr-1" />
                               Terima Stok
                             </Button>
                            
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              id={`photo-${item.id}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadVerificationPhoto(item.id, file);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById(`photo-${item.id}`)?.click()}
                            >
                              <Camera className="h-4 w-4 mr-1" />
                              Foto
                            </Button>
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
                {activeShift && !activeShift.report_submitted ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-orange-700">
                        Shift Aktif - Laporan Shift
                      </h3>
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
                        </div>

                        <Button
                          onClick={handleSubmitShiftReport}
                          disabled={loading}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {loading ? "Mengirim..." : "Kirim Laporan Shift"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : !activeShift ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-orange-700 mb-2">Tidak Ada Shift Aktif</h3>
                    <p className="text-muted-foreground mb-4">
                      Mulai shift dengan check-in untuk mengakses fitur ini
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-700 mb-2">Laporan Shift Terkirim</h3>
                    <p className="text-muted-foreground">
                      Laporan shift hari ini sudah berhasil dikirim dan menunggu verifikasi branch
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