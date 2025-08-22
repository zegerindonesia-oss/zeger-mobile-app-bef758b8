import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin,
  Camera,
  Check,
  Search,
  Package,
  DollarSign,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  CreditCard,
  Smartphone,
  LogOut
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { useAuth } from "@/hooks/useAuth";

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
}

interface StockItem {
  id: string;
  product_id: string;
  product: Product;
  rider_stock: number;
  checked: boolean;
}

interface Transaction {
  id?: string;
  product_id: string;
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
  payment_method: 'cash' | 'qris' | 'transfer';
  payment_proof?: string;
}

interface DailyReport {
  total_sales: number;
  cash_collected: number;
  non_cash_amount: number;
  total_transactions: number;
  operational_cost: number;
  cash_deposit_required: number;
  return_items: StockItem[];
  photos: string[];
  start_location: string;
  end_location: string;
}

const MobileSellerEnhanced = () => {
  const { userProfile, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'checkin' | 'stock-confirm' | 'selling' | 'returns' | 'checkout'>('checkin');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cart, setCart] = useState<{product_id: string; quantity: number}[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyReport>({
    total_sales: 0,
    cash_collected: 0,
    non_cash_amount: 0,
    total_transactions: 0,
    operational_cost: 0,
    cash_deposit_required: 0,
    return_items: [],
    photos: [],
    start_location: '',
    end_location: ''
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("Kemiri Sidoarjo");
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');

  useEffect(() => {
    fetchRiderStock();
  }, []);

  const fetchRiderStock = async () => {
    try {
      // Get rider's current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      // Fetch rider's inventory with products
      const { data: inventory } = await supabase
        .from('inventory')
        .select(`
          *,
          products(id, name, price, category)
        `)
        .eq('rider_id', profile.id)
        .gt('stock_quantity', 0);

        const stockItems = inventory?.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product: {...item.products, stock_quantity: item.stock_quantity},
          rider_stock: item.stock_quantity,
          checked: false
        })) || [];

      setStockItems(stockItems);
    } catch (error: any) {
      toast.error("Gagal memuat data stok");
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // Get current location
      const position = await getCurrentLocation();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      // Create attendance record
      const { error } = await supabase
        .from('attendance')
        .insert([{
          rider_id: profile.id,
          branch_id: profile.branch_id,
          work_date: new Date().toISOString().split('T')[0],
          check_in_location: position || location,
          check_in_time: new Date().toISOString(),
          status: 'checked_in'
        }]);

      if (error) throw error;

      toast.success("Absen masuk berhasil!");
      setDailyReport(prev => ({...prev, start_location: position || location}));
      setCurrentView('stock-confirm');
    } catch (error: any) {
      toast.error("Gagal absen masuk: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(`${position.coords.latitude}, ${position.coords.longitude}`);
          },
          () => resolve(location)
        );
      } else {
        resolve(location);
      }
    });
  };

  const confirmStock = async () => {
    const checkedItems = stockItems.filter(item => item.checked);
    if (checkedItems.length !== stockItems.length) {
      toast.error("Harap konfirmasi semua item stok");
      return;
    }

    setLoading(true);
    try {
      // Create stock movement records for confirmed stock
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      const stockMovements = checkedItems.map(item => ({
        product_id: item.product_id,
        quantity: item.rider_stock,
        movement_type: 'transfer' as const,
        rider_id: profile?.id,
        branch_id: profile?.branch_id,
        notes: 'Stock confirmed by rider'
      }));

      const { error } = await supabase
        .from('stock_movements')
        .insert(stockMovements);

      if (error) throw error;

      toast.success("Stok dikonfirmasi!");
      setCurrentView('selling');
    } catch (error: any) {
      toast.error("Gagal konfirmasi stok: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (productId: string) => {
    const stockItem = stockItems.find(item => item.product_id === productId);
    if (!stockItem) return;

    const currentCartItem = cart.find(item => item.product_id === productId);
    const currentQuantity = currentCartItem?.quantity || 0;

    if (currentQuantity >= stockItem.rider_stock) {
      toast.error("Stok tidak mencukupi");
      return;
    }

    if (currentCartItem) {
      setCart(cart.map(item =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product_id: productId, quantity: 1 }]);
    }

    toast.success("Ditambahkan ke keranjang");
  };

  const processTransaction = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      // Calculate transaction totals
      let totalAmount = 0;
      const transactionItems = cart.map(cartItem => {
        const stockItem = stockItems.find(s => s.product_id === cartItem.product_id);
        const itemTotal = stockItem!.product.price * cartItem.quantity;
        totalAmount += itemTotal;
        
        return {
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          unit_price: stockItem!.product.price,
          total_price: itemTotal
        };
      });

      // Create transaction
      const transactionNumber = `TRX-${Date.now()}`;
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          transaction_number: transactionNumber,
          total_amount: totalAmount,
          final_amount: totalAmount,
          payment_method: paymentMethod,
          status: 'completed',
          rider_id: profile?.id,
          branch_id: profile?.branch_id
        }])
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Add transaction items
      const itemsWithTransactionId = transactionItems.map(item => ({
        ...item,
        transaction_id: transaction.id
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsWithTransactionId);

      if (itemsError) throw itemsError;

      // Update rider stock
      for (const cartItem of cart) {
        const stockItem = stockItems.find(s => s.product_id === cartItem.product_id);
        if (stockItem) {
          await supabase
            .from('inventory')
            .update({ 
              stock_quantity: stockItem.rider_stock - cartItem.quantity 
            })
            .eq('id', stockItem.id);
        }
      }

      // Add to transactions list
      const newTransaction: Transaction = {
        id: transaction.id,
        product_id: '', // Will be expanded for display
        product: {} as Product,
        quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
        unit_price: 0,
        total_price: totalAmount,
        payment_method: paymentMethod
      };

      setTransactions([...transactions, newTransaction]);
      setCart([]);
      
      // Update daily report
      setDailyReport(prev => ({
        ...prev,
        total_sales: prev.total_sales + totalAmount,
        cash_collected: paymentMethod === 'cash' ? prev.cash_collected + totalAmount : prev.cash_collected,
        non_cash_amount: paymentMethod !== 'cash' ? prev.non_cash_amount + totalAmount : prev.non_cash_amount,
        total_transactions: prev.total_transactions + 1
      }));

      toast.success("Transaksi berhasil!");
      fetchRiderStock(); // Refresh stock
    } catch (error: any) {
      toast.error("Gagal memproses transaksi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadPaymentProof = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      toast.success("Bukti pembayaran berhasil diupload!");
      return fileName;
    } catch (error: any) {
      toast.error("Gagal upload bukti: " + error.message);
      return null;
    }
  };

  const submitDailyReport = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      const reportData = {
        rider_id: profile?.id,
        branch_id: profile?.branch_id,
        report_date: new Date().toISOString().split('T')[0],
        total_sales: dailyReport.total_sales,
        cash_collected: dailyReport.cash_collected,
        total_transactions: dailyReport.total_transactions,
        photos: dailyReport.photos,
        start_location: dailyReport.start_location,
        end_location: dailyReport.end_location
      };

      const { error } = await supabase
        .from('daily_reports')
        .insert([reportData]);

      if (error) throw error;

      toast.success("Laporan harian berhasil dikirim!");
      setCurrentView('checkin');
    } catch (error: any) {
      toast.error("Gagal mengirim laporan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Render functions for each view
  const renderCheckIn = () => (
    <div className="space-y-6 p-4">
      {/* Header with logout */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{userProfile?.full_name?.charAt(0) || 'M'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-800">{userProfile?.full_name}</p>
            <p className="text-sm text-gray-600">Mobile Seller</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-center">
        <div className="mb-4">
          <ZegerLogo size="md" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Selamat Pagi, Mobile Seller!</h2>
        <p className="text-gray-600">Siap memulai hari?</p>
      </div>

      <Card className="bg-white/90 backdrop-blur-sm border-red-100 shadow-soft rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-gray-800">Lokasi Saat Ini</p>
              <p className="text-sm text-gray-600">{location}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-gray-800">Waktu</p>
              <p className="text-sm text-gray-600">{new Date().toLocaleString('id-ID')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button 
        className="w-full h-12 text-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
        onClick={handleCheckIn}
        disabled={loading}
      >
        {loading ? "Memproses..." : (
          <>
            <Camera className="mr-2 h-5 w-5" />
            Absen Masuk dengan Foto
          </>
        )}
      </Button>
    </div>
  );

  const renderStockConfirm = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Konfirmasi Stok Ulang</h2>
        <p className="text-muted-foreground">
          Harap konfirmasi bahwa barang-barang ini sudah distok ulang ke motormu
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Inventaris (Total {stockItems.length})</h3>
        <Badge>Dipilih ({stockItems.filter(item => item.checked).length}/{stockItems.length})</Badge>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-3">
          {stockItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                item.checked ? 'bg-primary/10 border-primary' : 'bg-card hover:bg-accent'
              }`}
              onClick={() => setStockItems(items =>
                items.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i)
              )}
            >
              <div>
                <p className="font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">{item.rider_stock} Barang</p>
                <p className="text-sm text-primary">Rp {item.product.price.toLocaleString('id-ID')}</p>
              </div>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                item.checked 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground'
              }`}>
                {item.checked && <Check className="h-4 w-4" />}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Button 
        className="w-full h-12 gradient-primary"
        onClick={confirmStock}
        disabled={stockItems.filter(item => item.checked).length !== stockItems.length || loading}
      >
        {loading ? "Memproses..." : "Konfirmasi Stok"}
      </Button>
    </div>
  );

  const renderSelling = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Zeger Coffee OTW</h2>
          <p className="text-muted-foreground">Produk untuk Dijual</p>
        </div>
        <Badge variant="secondary">{cart.reduce((sum, item) => sum + item.quantity, 0)} item</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari produk..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-64">
        <div className="space-y-3">
          {stockItems
            .filter(item => item.product.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((item) => {
              const cartItem = cart.find(c => c.product_id === item.product_id);
              const inCartQuantity = cartItem?.quantity || 0;
              
              return (
                <div key={item.id} className="flex items-center justify-between p-4 bg-card rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-lg font-bold text-primary">Rp {item.product.price.toLocaleString('id-ID')}</p>
                    <p className="text-sm text-muted-foreground">
                      Stok: {item.rider_stock} | Di keranjang: {inCartQuantity}
                    </p>
                  </div>
                  <Button 
                    disabled={inCartQuantity >= item.rider_stock || item.rider_stock <= 0}
                    onClick={() => addToCart(item.product_id)}
                    className="px-8"
                  >
                    Tambah
                  </Button>
                </div>
              );
            })}
        </div>
      </ScrollArea>

      {/* Payment Method Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Metode Pembayaran:</label>
        <Select value={paymentMethod} onValueChange={(value: 'cash' | 'qris' | 'transfer') => setPaymentMethod(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Tunai
              </div>
            </SelectItem>
            <SelectItem value="qris">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                QRIS
              </div>
            </SelectItem>
            <SelectItem value="transfer">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Transfer Bank
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          variant="outline"
          onClick={processTransaction}
          disabled={cart.length === 0 || loading}
        >
          {loading ? "Memproses..." : "Proses Transaksi"}
        </Button>
        <Button 
          onClick={() => setCurrentView('returns')}
          className="gradient-primary"
        >
          Akhiri Penjualan
        </Button>
      </div>
    </div>
  );

  const renderReturns = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Kembalikan Barang Tak Terjual</h2>
        <p className="text-muted-foreground">
          Foto bukti untuk setiap inventaris yang akan dikembalikan
        </p>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-4">
          {stockItems
            .filter(item => item.rider_stock > 0) // Only items with remaining stock
            .map((item) => (
              <div key={item.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.rider_stock} barang untuk dikembalikan
                    </p>
                  </div>
                </div>
                <div className="w-20 h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground"
                />
              </div>
            ))}
        </div>
      </ScrollArea>

      <Button 
        className="w-full h-12 gradient-primary"
        onClick={() => setCurrentView('checkout')}
      >
        Simpan & Lanjutkan
      </Button>
    </div>
  );

  const renderCheckout = () => {
    const operationalCost = dailyReport.cash_collected * 0.1; // 10% operational cost
    const cashDeposit = dailyReport.cash_collected - operationalCost;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold">Laporan Harian Selesai!</h2>
          <p className="text-muted-foreground">Ringkasan penjualan hari ini</p>
        </div>

        <Card className="dashboard-card">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{dailyReport.total_transactions}</p>
                <p className="text-sm text-muted-foreground">Total Transaksi</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-success">
                  Rp {dailyReport.total_sales.toLocaleString('id-ID')}
                </p>
                <p className="text-sm text-muted-foreground">Total Penjualan</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Penjualan Tunai:</span>
                <span className="font-medium">Rp {dailyReport.cash_collected.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Penjualan Non-Tunai:</span>
                <span className="font-medium">Rp {dailyReport.non_cash_amount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Beban Operasional:</span>
                <span className="font-medium text-warning">Rp {operationalCost.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Setoran Tunai:</span>
                <span className="text-primary">Rp {cashDeposit.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Lokasi akhir"
                value={dailyReport.end_location}
                onChange={(e) => setDailyReport(prev => ({...prev, end_location: e.target.value}))}
              />
            </div>
          </CardContent>
        </Card>

        <Button 
          className="w-full h-12 gradient-primary"
          onClick={submitDailyReport}
          disabled={loading || !dailyReport.end_location}
        >
          {loading ? "Mengirim..." : "Kirim Laporan & Checkout"}
        </Button>
      </div>
    );
  };

      return (
        <div className="max-w-md mx-auto min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white">
          <div className="bg-white/95 backdrop-blur-md text-gray-800 min-h-screen p-4">
            {currentView === 'checkin' && renderCheckIn()}
            {currentView === 'stock-confirm' && renderStockConfirm()}
            {currentView === 'selling' && renderSelling()}
            {currentView === 'returns' && renderReturns()}
            {currentView === 'checkout' && renderCheckout()}
          </div>
        </div>
      );
};

export default MobileSellerEnhanced;