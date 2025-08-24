import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, Package, DollarSign, ShoppingCart, Calendar, 
  BarChart3, Receipt, Filter, ChevronRight, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TransactionDetail {
  id: string;
  transaction_number: string;
  transaction_date: string;
  final_amount: number;
  total_transactions: number;
  shift_number: number;
  shift_date: string;
  status: string;
  payment_method: string;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

interface DashboardAnalytics {
  todaySales: number;
  totalTransactions: number;
  averageTransaction: number;
  stockStatus: {
    total_items: number;
    low_stock: number;
    out_of_stock: number;
  };
  transactions: TransactionDetail[];
}

const MobileRiderAnalyticsEnhanced = () => {
  const [analytics, setAnalytics] = useState<DashboardAnalytics>({
    todaySales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    stockStatus: { total_items: 0, low_stock: 0, out_of_stock: 0 },
    transactions: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTransactionDetail, setShowTransactionDetail] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedDate]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      const startDate = `${selectedDate}T00:00:00`;
      const endDate = `${selectedDate}T23:59:59`;

      // Fetch transactions with detailed data
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          transaction_date,
          final_amount,
          status,
          payment_method,
          transaction_items (
            quantity,
            unit_price,
            total_price,
            products (name)
          )
        `)
        .eq('rider_id', profile.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });

      // Get shift info for each transaction
      const { data: shifts } = await supabase
        .from('shift_management')
        .select('id, shift_date, shift_number')
        .eq('rider_id', profile.id)
        .eq('shift_date', selectedDate);

      const todaySales = transactions?.reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;
      const totalTransactions = transactions?.length || 0;
      const averageTransaction = totalTransactions > 0 ? todaySales / totalTransactions : 0;

      // Format transaction details
      const transactionDetails: TransactionDetail[] = transactions?.map(transaction => ({
        id: transaction.id,
        transaction_number: transaction.transaction_number,
        transaction_date: transaction.transaction_date,
        final_amount: Number(transaction.final_amount),
        total_transactions: totalTransactions,
        shift_number: shifts?.[0]?.shift_number || 1,
        shift_date: shifts?.[0]?.shift_date || selectedDate,
        status: transaction.status,
        payment_method: transaction.payment_method || 'cash',
        items: transaction.transaction_items?.map(item => ({
          product_name: item.products?.name || 'Unknown',
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price)
        })) || []
      })) || [];

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
        totalTransactions,
        averageTransaction,
        stockStatus,
        transactions: transactionDetails
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
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
        {/* Date Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label htmlFor="date-filter">Pilih Tanggal</Label>
                <Input
                  id="date-filter"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
                  <p className="text-sm text-muted-foreground">Total Penjualan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{analytics.totalTransactions}</p>
                  <p className="text-sm text-muted-foreground">Total Transaksi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(analytics.averageTransaction)}</p>
                  <p className="text-sm text-muted-foreground">Rata-rata</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{analytics.stockStatus.total_items}</p>
                  <p className="text-sm text-muted-foreground">Item Stok</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              History Transaksi - {new Date(selectedDate).toLocaleDateString('id-ID')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.transactions.length > 0 ? (
                analytics.transactions.map((transaction) => (
                  <div key={transaction.id}>
                    <div 
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setShowTransactionDetail(
                        showTransactionDetail === transaction.id ? null : transaction.id
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-200 rounded-lg">
                          <Receipt className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">#{transaction.transaction_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(transaction.transaction_date)} • Shift {transaction.shift_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.payment_method.toUpperCase()} • {transaction.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-semibold text-red-600">{formatCurrency(transaction.final_amount)}</p>
                          <p className="text-xs text-muted-foreground">{transaction.items.length} item</p>
                        </div>
                        <ChevronRight 
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            showTransactionDetail === transaction.id ? 'rotate-90' : ''
                          }`} 
                        />
                      </div>
                    </div>
                    
                    {/* Transaction Detail */}
                    {showTransactionDetail === transaction.id && (
                      <div className="mt-2 p-4 bg-white border rounded-lg ml-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Detail Item
                        </h4>
                        <div className="space-y-2">
                          {transaction.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                <p className="font-medium text-sm">{item.product_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.quantity}x @ {formatCurrency(item.unit_price)}
                                </p>
                              </div>
                              <p className="font-semibold text-sm">{formatCurrency(item.total_price)}</p>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between items-center font-semibold">
                              <p>Total:</p>
                              <p className="text-red-600">{formatCurrency(transaction.final_amount)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Belum ada transaksi pada tanggal ini</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default MobileRiderAnalyticsEnhanced;