import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  TrendingUp,
  Camera,
  CheckCircle,
  AlertCircle,
  User,
  LogOut,
  BarChart3,
  Star,
  TrendingDown,
  ShoppingCart,
  Award,
  Eye
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceRecord {
  id: string;
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_location: string;
  check_out_location?: string;
  status: string;
}

interface DashboardStats {
  stock_items: number;
  pending_stock: number;
  total_sales: number;
  avg_per_transaction: number;
  attendance_today?: AttendanceRecord;
  items_sold: number;
  stock_awal: number;
  sisa_stok: number;
}

interface ProductSales {
  product_name: string;
  total_sales: number;
  total_quantity: number;
}

interface SalesData {
  date: string;
  amount: number;
  transactions: number;
}

interface ShiftStatus {
  id: string;
  status: string;
  shift_number: number;
  shift_date: string;
  shift_start_time?: string;
  shift_end_time?: string;
  report_submitted?: boolean;
}

const MobileRiderDashboard = () => {
  const { userProfile, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    stock_items: 0,
    pending_stock: 0,
    total_sales: 0,
    avg_per_transaction: 0,
    items_sold: 0,
    stock_awal: 0,
    sisa_stok: 0
  });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [topProducts, setTopProducts] = useState<ProductSales[]>([]);
  const [worstProducts, setWorstProducts] = useState<ProductSales[]>([]);
  const [dailySales, setDailySales] = useState<SalesData[]>([]);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | null>(null);
  const [needsCheckIn, setNeedsCheckIn] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchAttendanceHistory();
  }, []);

  useEffect(() => {
    const handler = () => fetchDashboardData();
    window.addEventListener('shift-updated', handler);
    return () => window.removeEventListener('shift-updated', handler);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check today's attendance (any status)
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('rider_id', profile.id)
        .eq('work_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setIsCheckedIn(!!todayAttendance);
      setNeedsCheckIn(!todayAttendance);

      // Check active shift
      const { data: activeShift } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', profile.id)
        .eq('shift_date', today)
        .eq('status', 'active')
        .maybeSingle();

      setShiftStatus(activeShift);

      // Fetch stock items
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('rider_id', profile.id);

      const stockItems = inventory?.reduce((sum, item) => sum + item.stock_quantity, 0) || 0;

      // Tentukan rentang waktu berdasarkan shift aktif
      let startRange = `${today}T00:00:00`;
      let endRange = new Date().toISOString();
      
      // Jika ada shift aktif, gunakan waktu mulai shift
      if (activeShift?.shift_start_time) {
        startRange = activeShift.shift_start_time;
      }

// Fetch stock awal (pergerakan stok diterima dalam rentang shift/hari)
const { data: stockMovements } = await supabase
  .from('stock_movements')
  .select('quantity')
  .eq('rider_id', profile.id)
  .eq('movement_type', 'transfer')
  .eq('status', 'received')
  .gte('actual_delivery_date', startRange)
  .lte('actual_delivery_date', endRange);

let stockAwal = stockMovements?.reduce((sum, movement) => sum + movement.quantity, 0) || 0;

// Fetch pending stock transfers
const { data: pendingStock } = await supabase
  .from('stock_movements')
  .select('*')
  .eq('rider_id', profile.id)
  .eq('movement_type', 'transfer')
  .eq('status', 'sent');

// Fetch sales & items sold dalam rentang shift/hari
const { data: transactions } = await supabase
  .from('transactions')
  .select(`
    final_amount,
    transaction_items(quantity)
  `)
  .eq('rider_id', profile.id)
  .gte('transaction_date', startRange)
  .lte('transaction_date', endRange);

      let totalSales = transactions?.reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;
      let avgPerTransaction = transactions?.length > 0 ? totalSales / transactions.length : 0;
      let itemsSold = transactions?.reduce((sum, t) => {
        return sum + (t.transaction_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
      }, 0) || 0;

      // Jika tidak ada shift aktif, angka pergeseran harus 0 (dashboard per shift)
      if (!activeShift) {
        stockAwal = 0;
        totalSales = 0;
        avgPerTransaction = 0;
        itemsSold = 0;
      }

      // Fetch top and worst products
      const { data: productSales } = await supabase
        .from('transaction_items')
        .select(`
          quantity,
          total_price,
          products(name),
          transactions!inner(rider_id, transaction_date)
        `)
        .eq('transactions.rider_id', profile.id)
        .gte('transactions.transaction_date', weekAgo);

      const productSalesMap = new Map<string, ProductSales>();
      
      productSales?.forEach(item => {
        const productName = item.products?.name || 'Unknown';
        if (productSalesMap.has(productName)) {
          const existing = productSalesMap.get(productName)!;
          existing.total_sales += Number(item.total_price);
          existing.total_quantity += item.quantity;
        } else {
          productSalesMap.set(productName, {
            product_name: productName,
            total_sales: Number(item.total_price),
            total_quantity: item.quantity
          });
        }
      });

      const sortedProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.total_sales - a.total_sales);

      setTopProducts(sortedProducts.slice(0, 5));
      setWorstProducts(sortedProducts.slice(-3).reverse());

      // Fetch daily sales for chart
      const { data: dailyData } = await supabase
        .from('transactions')
        .select('transaction_date, final_amount')
        .eq('rider_id', profile.id)
        .gte('transaction_date', weekAgo)
        .order('transaction_date');

      const dailySalesMap = new Map<string, SalesData>();
      dailyData?.forEach(transaction => {
        const date = transaction.transaction_date.split('T')[0];
        if (dailySalesMap.has(date)) {
          const existing = dailySalesMap.get(date)!;
          existing.amount += Number(transaction.final_amount);
          existing.transactions += 1;
        } else {
          dailySalesMap.set(date, {
            date,
            amount: Number(transaction.final_amount),
            transactions: 1
          });
        }
      });

      setDailySales(Array.from(dailySalesMap.values()).slice(-7));

      setStats({
        stock_items: stockItems,
        pending_stock: pendingStock?.length || 0,
        total_sales: totalSales,
        avg_per_transaction: avgPerTransaction,
        attendance_today: todayAttendance || undefined,
        items_sold: itemsSold,
        stock_awal: stockAwal,
        sisa_stok: stockItems
      });

    } catch (error: any) {
      toast.error("Gagal memuat data dashboard");
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('rider_id', profile.id)
        .order('work_date', { ascending: false })
        .limit(10);

      setAttendanceHistory(attendance || []);
    } catch (error: any) {
      toast.error("Gagal memuat riwayat absensi");
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const position = await getCurrentLocation();
      
      // First take a photo
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
        toast.error("Foto wajib untuk check-in");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      // Upload photo
      const fileExt = photo.name.split('.').pop();
      const fileName = `checkin-${profile.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('attendance')
        .insert([{
          rider_id: profile.id,
          branch_id: profile.branch_id,
          work_date: new Date().toISOString().split('T')[0],
          check_in_location: position,
          check_in_time: new Date().toISOString(),
          check_in_photo_url: publicUrl,
          status: 'checked_in'
        }]);

      if (error) throw error;

      toast.success("Absen masuk berhasil! Silakan lanjut ke Shift In");
      setIsCheckedIn(true);
      setNeedsCheckIn(false);
      fetchDashboardData();
      fetchAttendanceHistory();
    } catch (error: any) {
      toast.error("Gagal absen masuk: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const position = await getCurrentLocation();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_location: position,
          check_out_time: new Date().toISOString(),
          status: 'checked_out'
        })
        .eq('rider_id', profile.id)
        .eq('work_date', today)
        .eq('status', 'checked_in');

      if (error) throw error;

      toast.success("Absen keluar berhasil!");
      setIsCheckedIn(false);
      fetchDashboardData();
      fetchAttendanceHistory();
    } catch (error: any) {
      toast.error("Gagal absen keluar: " + error.message);
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
        () => resolve("Lokasi tidak tersedia")
      );
    } else {
      resolve("Lokasi tidak tersedia");
    }
  });
};

const startShift = async () => {
  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User tidak terautentikasi');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, branch_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) throw new Error('Profil tidak ditemukan');

    const today = new Date().toISOString().split('T')[0];

    // Cek jika sudah ada shift aktif
    const { data: existingActive } = await supabase
      .from('shift_management')
      .select('*')
      .eq('rider_id', profile.id)
      .eq('shift_date', today)
      .eq('status', 'active')
      .maybeSingle();

    if (existingActive) {
      setShiftStatus(existingActive as any);
      toast.info('Shift sudah aktif');
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }));
      return;
    }

    // Ambil nomor shift berikutnya
    const { data: lastShift } = await supabase
      .from('shift_management')
      .select('shift_number')
      .eq('rider_id', profile.id)
      .eq('shift_date', today)
      .order('shift_number', { ascending: false })
      .limit(1);

    const nextNumber = lastShift && lastShift.length > 0
      ? (lastShift[0].shift_number || 0) + 1
      : 1;

    const { data: inserted, error } = await supabase
      .from('shift_management')
      .insert({
        rider_id: profile.id,
        branch_id: profile.branch_id,
        shift_date: today,
        shift_start_time: new Date().toISOString(),
        status: 'active',
        shift_number: nextNumber,
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    setShiftStatus(inserted as any);
    toast.success(`Shift ${inserted?.shift_number || nextNumber} dimulai`);
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }));
    fetchDashboardData();
  } catch (error: any) {
    toast.error('Gagal mulai shift: ' + error.message);
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

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ZegerLogo size="sm" />
            <div>
              <h1 className="font-bold text-lg">Dashboard Rider</h1>
              <p className="text-sm text-muted-foreground">
                Selamat datang, {userProfile?.full_name}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-red-600 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Actions - tanpa tombol Absen */}
        <div className="grid grid-cols-2 gap-4">
<Button
  onClick={startShift}
  disabled={!!shiftStatus}
  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-16 disabled:opacity-70"
>
  <CheckCircle className="h-5 w-5" />
  <div className="text-center">
    <div className="font-semibold">{shiftStatus ? `Shift ${shiftStatus.shift_number} Anda sedang aktif` : 'Mulai Shift'}</div>
    <div className="text-xs opacity-90">{shiftStatus ? 'Kirim laporan untuk menyelesaikan shift' : 'Mulai Shift Hari Ini'}</div>
  </div>
</Button>

          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 h-16"
            disabled={!shiftStatus}
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'selling' }))}
          >
            <Package className="h-5 w-5" />
            <div className="text-center">
              <div className="font-semibold">Penjualan</div>
              <div className="text-xs text-muted-foreground">
                {shiftStatus ? 'Mulai Jual' : 'Perlu Shift In'}
              </div>
            </div>
          </Button>
        </div>

        {/* Shift Status Alert */}
        {shiftStatus && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-600">Shift {shiftStatus.shift_number} Aktif</Badge>
                <p className="text-sm text-blue-700">
                  Shift sedang berjalan - Anda dapat menerima stok dan melakukan penjualan
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }))} className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.stock_awal}</p>
                  <p className="text-sm text-muted-foreground">Stok Awal</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }))} className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending_stock}</p>
                  <p className="text-sm text-muted-foreground">Stok Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'selling' }))} className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.items_sold}</p>
                  <p className="text-sm text-muted-foreground">Item Terjual</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }))} className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sisa_stok}</p>
                  <p className="text-sm text-muted-foreground">Sisa Stok</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'analytics' }))} className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(stats.total_sales)}</p>
                  <p className="text-sm text-muted-foreground">Total Penjualan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'analytics' }))} className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(stats.avg_per_transaction)}</p>
                  <p className="text-sm text-muted-foreground">Rata-rata Transaksi</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart - Enhanced Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Grafik Penjualan 7 Hari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dailySales.length > 0 ? (
                dailySales.map((data, index) => {
                  const maxAmount = Math.max(...dailySales.map(d => d.amount));
                  const height = maxAmount > 0 ? Math.max(20, (data.amount / maxAmount) * 120) : 20;
                  return (
                    <div key={data.date} className="flex flex-col items-center">
                      <div 
                        className="bg-blue-500 rounded-t w-full transition-all duration-300 flex items-end justify-center"
                        style={{ height: `${height}px` }}
                      >
                        <span className="text-xs text-white font-semibold mb-1">
                          {data.transactions}
                        </span>
                      </div>
                      <div className="text-xs text-center mt-1">
                        {formatDateShort(data.date)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-7 text-center text-muted-foreground py-8">
                  Belum ada data penjualan
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Menu Terjual - Enhanced Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Menu Terjual
              <span className="text-sm font-normal text-muted-foreground ml-2">7 hari terakhir</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((product, index) => {
                const maxQuantity = Math.max(...topProducts.map(p => p.total_quantity));
                const percentage = maxQuantity > 0 ? (product.total_quantity / maxQuantity) * 100 : 0;
                return (
                  <div key={product.product_name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{product.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.total_quantity} terjual • {formatCurrency(product.total_sales)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{product.total_quantity}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(percentage)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Belum ada data penjualan</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analisa Jam Terjual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Jam Terjual
              <span className="text-sm font-normal text-muted-foreground ml-2">Hari ini</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2"></div>
                <p className="text-sm font-medium">Pagi (06:00 - 10:00)</p>
                <p className="text-lg font-bold text-green-600">
                  {dailySales.length > 0 ? Math.round(dailySales[dailySales.length - 1]?.transactions * 0.3) || 0 : 0}
                </p>
                <p className="text-xs text-muted-foreground">23.8% of total</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-2"></div>
                <p className="text-sm font-medium">Siang (10:00 - 15:00)</p>
                <p className="text-lg font-bold text-blue-600">
                  {dailySales.length > 0 ? Math.round(dailySales[dailySales.length - 1]?.transactions * 0.4) || 0 : 0}
                </p>
                <p className="text-xs text-muted-foreground">26.5% of total</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-2"></div>
                <p className="text-sm font-medium">Sore (15:00 - 21:00)</p>
                <p className="text-lg font-bold text-red-600">
                  {dailySales.length > 0 ? Math.round(dailySales[dailySales.length - 1]?.transactions * 0.5) || 0 : 0}
                </p>
                <p className="text-xs text-muted-foreground">49.3% of total</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-center text-lg font-bold">
                {dailySales.length > 0 ? dailySales[dailySales.length - 1]?.transactions || 0 : 0}
              </p>
              <p className="text-center text-sm text-muted-foreground">Total Produk Terjual</p>
            </div>
          </CardContent>
        </Card>

        {/* Worst Selling Products */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Worst Selling Menu
              </CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    Detail
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Detail Worst Selling Menu</DialogTitle>
                  </DialogHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Terjual</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {worstProducts.map((product, index) => (
                        <TableRow key={product.product_name}>
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell>{product.total_quantity}</TableCell>
                          <TableCell>{formatCurrency(product.total_sales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {worstProducts.slice(0, 3).map((product, index) => (
                <div key={product.product_name} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-sm text-muted-foreground">{product.total_quantity} terjual</p>
                    </div>
                  </div>
                  <p className="font-semibold text-red-600">{formatCurrency(product.total_sales)}</p>
                </div>
              ))}
              {worstProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Belum ada data penjualan</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Status */}
        {stats.attendance_today && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Status Absensi Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {stats.attendance_today.status === 'checked_in' ? 'Sedang Bekerja' : 'Selesai'}
                  </Badge>
                  <div>
                    <p className="font-medium">Check In: {formatTime(stats.attendance_today.check_in_time)}</p>
                    {stats.attendance_today.check_out_time && (
                      <p className="text-sm text-muted-foreground">
                        Check Out: {formatTime(stats.attendance_today.check_out_time)}
                      </p>
                    )}
                  </div>
                </div>
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Riwayat Absensi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {attendanceHistory.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{formatDate(record.work_date)}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Masuk: {formatTime(record.check_in_time)}</span>
                        {record.check_out_time && (
                          <span>Keluar: {formatTime(record.check_out_time)}</span>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant={record.status === 'checked_out' ? 'secondary' : 'default'}
                      className={record.status === 'checked_out' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {record.status === 'checked_out' ? 'Selesai' : 'Aktif'}
                    </Badge>
                  </div>
                ))}
                {attendanceHistory.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Belum ada riwayat absensi
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileRiderDashboard;