import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart, Award,
  Calendar, Clock, Star, AlertTriangle, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SalesData {
  date: string;
  amount: number;
  transactions: number;
}

interface ProductSales {
  product_name: string;
  total_sales: number;
  total_quantity: number;
}

interface DashboardAnalytics {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  totalTransactions: number;
  averageTransaction: number;
  topProducts: ProductSales[];
  worstProducts: ProductSales[];
  dailySales: SalesData[];
  stockStatus: {
    total_items: number;
    low_stock: number;
    out_of_stock: number;
  };
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

const MobileRiderAnalytics = () => {
  const [analytics, setAnalytics] = useState<DashboardAnalytics>({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    topProducts: [],
    worstProducts: [],
    dailySales: [],
    stockStatus: { total_items: 0, low_stock: 0, out_of_stock: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      // Use Jakarta timezone for date filtering
      const getJakartaDate = (daysAgo: number = 0) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      };

      const today = getJakartaDate(0);
      const weekAgo = getJakartaDate(7);
      const monthAgo = getJakartaDate(30);

      // Fetch today's sales
      const { data: todayTransactions } = await supabase
        .from('transactions')
        .select('final_amount')
        .eq('rider_id', profile.id)
        .eq('is_voided', false)
        .gte('transaction_date', `${today}T00:00:00+07:00`)
        .lte('transaction_date', `${today}T23:59:59+07:00`);

      const todaySales = todayTransactions?.reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;

      // Fetch week sales
      const { data: weekTransactions } = await supabase
        .from('transactions')
        .select('final_amount')
        .eq('rider_id', profile.id)
        .eq('is_voided', false)
        .gte('transaction_date', `${weekAgo}T00:00:00+07:00`)
        .lte('transaction_date', `${today}T23:59:59+07:00`);

      const weekSales = weekTransactions?.reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;

      // Fetch month sales
      const { data: monthTransactions } = await supabase
        .from('transactions')
        .select('final_amount')
        .eq('rider_id', profile.id)
        .eq('is_voided', false)
        .gte('transaction_date', `${monthAgo}T00:00:00+07:00`)
        .lte('transaction_date', `${today}T23:59:59+07:00`);

      const monthSales = monthTransactions?.reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;
      const totalTransactions = monthTransactions?.length || 0;
      const averageTransaction = totalTransactions > 0 ? monthSales / totalTransactions : 0;

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
        .gte('transactions.transaction_date', monthAgo);

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

      const topProducts = sortedProducts.slice(0, 5);
      const worstProducts = sortedProducts.slice(-3).reverse();

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

      const dailySales = Array.from(dailySalesMap.values()).slice(-7);

      // Fetch stock status
      const { data: inventory } = await supabase
        .from('inventory')
        .select('stock_quantity, min_stock_level')
        .eq('rider_id', profile.id);

      const stockStatus = {
        total_items: inventory?.length || 0,
        low_stock: inventory?.filter(item => item.stock_quantity <= item.min_stock_level && item.stock_quantity > 0).length || 0,
        out_of_stock: inventory?.filter(item => item.stock_quantity === 0).length || 0
      };

      setAnalytics({
        todaySales,
        weekSales,
        monthSales,
        totalTransactions,
        averageTransaction,
        topProducts,
        worstProducts,
        dailySales,
        stockStatus
      });

    } catch (error: any) {
      toast.error("Gagal memuat data analytics");
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Memuat analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Sales Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(analytics.todaySales)}</p>
                  <p className="text-sm text-muted-foreground">Hari Ini</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(analytics.weekSales)}</p>
                  <p className="text-sm text-muted-foreground">7 Hari</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{analytics.totalTransactions}</p>
                  <p className="text-sm text-muted-foreground">Transaksi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(analytics.averageTransaction)}</p>
                  <p className="text-sm text-muted-foreground">Rata-rata</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tren Penjualan 7 Hari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.dailySales.length > 0 ? (
                analytics.dailySales.map((data, index) => (
                  <div key={data.date} className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
                    <div>
                      <p className="font-medium">{formatDate(data.date)}</p>
                      <p className="text-sm text-muted-foreground">{data.transactions} transaksi</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">{formatCurrency(data.amount)}</p>
                      <div className="w-16 bg-white rounded-full h-2 mt-1">
                        <div 
                          className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                          style={{ 
                            width: `${Math.min(100, (data.amount / Math.max(...analytics.dailySales.map(d => d.amount))) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Belum ada data penjualan</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Status Inventori
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{analytics.stockStatus.total_items}</p>
                <p className="text-sm text-muted-foreground">Total Item</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{analytics.stockStatus.low_stock}</p>
                <p className="text-sm text-muted-foreground">Stok Rendah</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{analytics.stockStatus.out_of_stock}</p>
                <p className="text-sm text-muted-foreground">Habis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              Best Menu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topProducts.map((product, index) => (
                <div key={product.product_name} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-sm text-muted-foreground">{product.total_quantity} terjual</p>
                    </div>
                  </div>
                  <p className="font-semibold text-green-600">{formatCurrency(product.total_sales)}</p>
                </div>
              ))}
              {analytics.topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Belum ada data penjualan</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worst Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Worst Menu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.worstProducts.map((product, index) => (
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
              {analytics.worstProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Belum ada data penjualan</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default MobileRiderAnalytics;