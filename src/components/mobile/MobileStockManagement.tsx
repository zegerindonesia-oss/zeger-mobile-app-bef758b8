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
  RefreshCw
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

interface ShiftReport {
  cash_collected: number;
  total_sales: number;
  total_transactions: number;
  operational_expenses: number;
  notes: string;
}

// Stock Return Component
const StockReturnTab = ({ userProfile, activeShift, onRefresh }: { 
  userProfile: any; 
  activeShift: any; 
  onRefresh: () => void; 
}) => {
  const [returnableStock, setReturnableStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeShift) {
      fetchReturnableStock();
    }
  }, [activeShift]);

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
        .from('checkpoint-photos')
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('checkpoint-photos')
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
    } catch (error: any) {
      toast.error("Gagal mengembalikan stok: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeShift) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Pengembalian stok hanya tersedia saat shift aktif</p>
      </div>
    );
  }

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
  const [shiftReport, setShiftReport] = useState<ShiftReport>({
    cash_collected: 0,
    total_sales: 0,
    total_transactions: 0,
    operational_expenses: 0,
    notes: ''
  });

  useEffect(() => {
    fetchStockData();
    fetchActiveShift();
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

  const fetchActiveShift = async () => {
    try {
      if (!userProfile?.id) return;

      const { data: shift } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', userProfile.id)
        .eq('shift_date', new Date().toISOString().split('T')[0])
        .eq('status', 'active')
        .maybeSingle();

      setActiveShift(shift);

      if (shift) {
        // Fetch today's sales data for shift report
        const today = new Date().toISOString().split('T')[0];
        const { data: transactions } = await supabase
          .from('transactions')
          .select('final_amount')
          .eq('rider_id', userProfile.id)
          .gte('transaction_date', `${today}T00:00:00`)
          .lte('transaction_date', `${today}T23:59:59`);

        const totalSales = transactions?.reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;

        setShiftReport(prev => ({
          ...prev,
          total_sales: totalSales,
          total_transactions: transactions?.length || 0
        }));
      }
    } catch (error: any) {
      console.error("Error fetching active shift:", error);
    }
  };

  const confirmStockReceival = async (stockId: string) => {
    setLoading(true);
    try {
      const currentTime = new Date().toISOString();
      
      const { error } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'received',
          actual_delivery_date: currentTime,
          notes: 'Stok diterima dan dikonfirmasi oleh rider'
        })
        .eq('id', stockId);

      if (error) throw error;

      toast.success("Stok dikonfirmasi diterima!");
      fetchStockData();
    } catch (error: any) {
      toast.error("Gagal konfirmasi: " + error.message);
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

  const submitShiftReport = async () => {
    if (!activeShift) {
      toast.error("Tidak ada shift aktif");
      return;
    }

    setLoading(true);
    try {
      // Upload shift end photo if needed
      const shiftPhotoInput = document.getElementById('shift-end-photo') as HTMLInputElement;
      let photoUrl = '';
      
      if (shiftPhotoInput?.files?.[0]) {
        const file = shiftPhotoInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `shift-end-${activeShift.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('stock-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('stock-photos')
          .getPublicUrl(fileName);
        
        photoUrl = publicUrl;
      }

      // Update shift with report data
      const { error } = await supabase
        .from('shift_management')
        .update({
          cash_collected: shiftReport.cash_collected,
          total_sales: shiftReport.total_sales,
          total_transactions: shiftReport.total_transactions,
          report_submitted: true,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeShift.id);

      if (error) throw error;

      // Create operational expense record if any
      if (shiftReport.operational_expenses > 0) {
        await supabase
          .from('operational_expenses')
          .insert([{
            branch_id: userProfile?.branch_id,
            amount: shiftReport.operational_expenses,
            expense_category: 'rider_operational',
            description: `Beban operasional shift - ${shiftReport.notes}`,
            expense_date: new Date().toISOString().split('T')[0],
            created_by: userProfile?.id
          }]);
      }

      toast.success("Laporan shift berhasil dikirim!");
      setActiveShift(null);
      setShiftReport({
        cash_collected: 0,
        total_sales: 0,
        total_transactions: 0,
        operational_expenses: 0,
        notes: ''
      });
    } catch (error: any) {
      toast.error("Gagal mengirim laporan: " + error.message);
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
            <Tabs defaultValue="receive" className="space-y-4">
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
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium">{item.product?.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Jumlah: {item.quantity} | Kategori: {item.product?.category}
                              </p>
                              {item.expected_delivery_date && (
                                <p className="text-xs text-muted-foreground">
                                  Target: {new Date(item.expected_delivery_date).toLocaleString('id-ID')}
                                </p>
                              )}
                            </div>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Menunggu
                            </Badge>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => confirmStockReceival(item.id)}
                              disabled={loading}
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
                        Shift Aktif - Kirim Laporan Pengembalian & Akhiri Shift
                      </h3>
                    </div>
                    
                    <p className="text-sm text-orange-600">
                      Catat semua pengeluaran operasional sedama shift ini (es batu, bensin, dll)
                    </p>

                    {/* Sales Summary */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <Card className="p-3">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Penjualan</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(shiftReport.total_sales)}
                          </p>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Transaksi</p>
                          <p className="text-lg font-bold text-blue-600">
                            {shiftReport.total_transactions}
                          </p>
                        </div>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Beban Operasional (Rp)</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={shiftReport.operational_expenses}
                          onChange={(e) => setShiftReport(prev => ({
                            ...prev,
                            operational_expenses: Number(e.target.value)
                          }))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Contoh: es batu, bensin, parkir, dll
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Setoran Tunai (Rp)</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={shiftReport.cash_collected}
                          onChange={(e) => setShiftReport(prev => ({
                            ...prev,
                            cash_collected: Number(e.target.value)
                          }))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Total uang tunai yang disetor ke branch
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Catatan</label>
                        <Textarea
                          placeholder="Catatan tambahan untuk laporan shift..."
                          value={shiftReport.notes}
                          onChange={(e) => setShiftReport(prev => ({
                            ...prev,
                            notes: e.target.value
                          }))}
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Foto Nota/Setoran (Opsional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          id="shift-end-photo"
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                      </div>
                    </div>

                    {/* Calculation Summary */}
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-3">Ringkasan Perhitungan</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Penjualan:</span>
                          <span className="font-medium">{formatCurrency(shiftReport.total_sales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Beban Operasional:</span>
                          <span className="font-medium text-red-600">-{formatCurrency(shiftReport.operational_expenses)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>Total Setoran Seharusnya:</span>
                          <span className="text-green-600">
                            {formatCurrency(Math.max(0, shiftReport.total_sales - shiftReport.operational_expenses))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Setoran Aktual:</span>
                          <span className="font-medium">{formatCurrency(shiftReport.cash_collected)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Selisih:</span>
                          <span className={`font-medium ${
                            shiftReport.cash_collected - (shiftReport.total_sales - shiftReport.operational_expenses) >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {formatCurrency(shiftReport.cash_collected - (shiftReport.total_sales - shiftReport.operational_expenses))}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <div>
                      <label className="block text-sm font-medium mb-2">Deskripsi</label>
                      <Textarea
                        placeholder="Es batu, bensin, dll"
                        value={shiftReport.notes}
                        onChange={(e) => setShiftReport(prev => ({
                          ...prev,
                          notes: e.target.value
                        }))}
                      />
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Ringkasan Shift Hari Ini</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Penjualan Tunai:</span>
                          <p className="font-medium">{formatCurrency(shiftReport.total_sales)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Transaksi:</span>
                          <p className="font-medium">{shiftReport.total_transactions}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Beban Operasional:</span>
                          <p className="font-medium text-red-600">- {formatCurrency(shiftReport.operational_expenses)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Setoran Tunai yang diharapkan:</span>
                          <p className="font-medium text-green-600">
                            {formatCurrency(Math.max(0, shiftReport.total_sales - shiftReport.operational_expenses))}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={submitShiftReport} 
                      disabled={loading}
                      className="w-full"
                      size="lg"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Kirim Laporan Pengembalian & Akhiri Shift
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-700 mb-2">
                      {activeShift ? 'Laporan Shift Telah Dikirim' : 'Tidak Ada Shift Aktif'}
                    </h3>
                    <p className="text-muted-foreground">
                      {activeShift 
                        ? 'Terima kasih telah mengirim laporan shift hari ini.'
                        : 'Mulai shift dengan check-in untuk mengakses fitur ini.'
                      }
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