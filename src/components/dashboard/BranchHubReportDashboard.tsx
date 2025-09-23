import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, CoffeeIcon, Receipt, MapPin, UserCheck, Calculator, ChefHat, Building, BarChart3, CreditCard, Banknote, TrendingDown as ExpenseIcon, Coins } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, BarChart } from 'recharts';
import { PieChart3D } from '@/components/charts/PieChart3D';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useRiderFilter } from "@/hooks/useRiderFilter";

interface DashboardStats {
  totalSales: number;
  totalTransactions: number;
  avgTransactionValue: number;
  totalFoodCost: number;
  totalItemsSold: number;
  totalProfit: number;
  totalMembers: number;
  activeRiders: number;
  cashSales: number;
  qrisSales: number;
  transferSales: number;
  operationalExpenses: number;
  cashDeposit: number;
}

interface SalesData {
  month: string;
  sales: number;
}

interface ProductSales {
  name: string;
  value: number;
  color: string;
  quantity: number;
  revenue: number;
}

const COLORS = ['#3B82F6', '#DC2626', '#10B981', '#F87171', '#FCA5A5'];
const SHIFT_COLORS = ['#10B981', '#3B82F6', '#DC2626'];

export const BranchHubReportDashboard = () => {
  const { assignedRiderId, assignedRiderName, shouldAutoFilter, loading: riderLoading, error: riderError, refreshAssignment } = useRiderFilter();
  const [salesFilter, setSalesFilter] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Set default dates using Asia/Jakarta timezone
  const getJakartaNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const getFirstOfMonth = () => {
    const now = getJakartaNow();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };
  
  const [startDate, setStartDate] = useState<string>(formatYMD(getFirstOfMonth()));
  const [endDate, setEndDate] = useState<string>(formatYMD(getJakartaNow()));
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly'>('monthly');

  // Individual filters for each section
  const [menuFilter, setMenuFilter] = useState<'today' | 'week' | 'month'>('today');
  const [hourlyFilter, setHourlyFilter] = useState<'today' | 'week' | 'month'>('today');
  const [riderFilter, setRiderFilter] = useState<'today' | 'week' | 'month'>('today');

  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalTransactions: 0,
    avgTransactionValue: 0,
    totalFoodCost: 0,
    totalItemsSold: 0,
    totalProfit: 0,
    totalMembers: 0,
    activeRiders: 0,
    cashSales: 0,
    qrisSales: 0,
    transferSales: 0,
    operationalExpenses: 0,
    cashDeposit: 0
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [riderExpenses, setRiderExpenses] = useState<{
    rider_name: string;
    total_expenses: number;
  }[]>([]);
  const [riderStockData, setRiderStockData] = useState<{
    rider_name: string;
    initial_stock: number;
    sold: number;
    remaining: number;
    revenue: number;
    orders: number;
  }[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Update dates automatically based on dateFilter (Asia/Jakarta)
    const now = getJakartaNow();
    const today = formatYMD(now);
    const firstOfThisMonth = formatYMD(getFirstOfMonth());
    
    if (dateFilter === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (dateFilter === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      setStartDate(formatYMD(weekAgo));
      setEndDate(today);
    } else if (dateFilter === 'monthly') {
      setStartDate(firstOfThisMonth);
      setEndDate(today);
    }
  }, [dateFilter]);

  useEffect(() => {
    if (shouldAutoFilter) {
      fetchDashboardData();
    }
  }, [assignedRiderId, salesFilter, startDate, endDate, menuFilter, hourlyFilter, riderFilter, shouldAutoFilter]);

  const fetchDashboardData = async () => {
    if (!shouldAutoFilter) {
      console.log('🚫 Auto filter not enabled, skipping data fetch');
      return;
    }
    
    console.log('📊 Starting dashboard data fetch for rider:', assignedRiderName, 'ID:', assignedRiderId);
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchSalesChart(), fetchProductSales(), fetchRiderExpenses(), fetchRiderStockData(), fetchHourlyData()]);
      console.log('✅ Dashboard data fetch completed');
    } catch (error) {
      console.error("❌ Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!assignedRiderId) return;

    try {
      // Use consistent date formatting
      const startStr = formatYMD(new Date(startDate));
      const endStr = formatYMD(new Date(endDate));

      // Fetch completed transactions for the assigned rider only
      const { data: transactions } = await supabase
        .from('transactions')
        .select('final_amount, id, rider_id, payment_method')
        .eq('status', 'completed')
        .eq('rider_id', assignedRiderId)
        .gte('transaction_date', `${startStr}T00:00:00`)
        .lte('transaction_date', `${endStr}T23:59:59`);

      // Fetch active customers for this rider
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('is_active', true)
        .eq('rider_id', assignedRiderId);

      // Calculate revenue breakdown with MDR
      let cashRevenue = 0;
      let qrisRevenue = 0;
      let transferRevenue = 0;
      let mdrAmount = 0;

      (transactions || []).forEach((trans: any) => {
        const amount = Number(trans.final_amount || 0);
        const paymentMethod = (trans.payment_method || '').toLowerCase();
        
        if (paymentMethod === 'cash') {
          cashRevenue += amount;
        } else if (paymentMethod === 'qris') {
          qrisRevenue += amount;
          mdrAmount += amount * 0.007; // 0.7% MDR
        } else if (paymentMethod === 'transfer' || paymentMethod === 'bank_transfer' || paymentMethod === 'bank') {
          transferRevenue += amount;
        }
      });

      // Compute total items sold and total food cost (COGS)
      const transactionIds = transactions?.map(t => t.id) || [];
      let totalItemsSold = 0;
      let totalFoodCost = 0;
      
      if (transactionIds.length > 0) {
        try {
          const { data: items, error: itemsError } = await supabase
            .from('transaction_items')
            .select(`
              quantity,
              products!inner(cost_price)
            `)
            .in('transaction_id', transactionIds);
          
          if (itemsError) {
            console.error('Error fetching transaction items:', itemsError);
          } else if (items && items.length > 0) {
            totalItemsSold = items.reduce((sum, item: any) => {
              return sum + (item.quantity || 0);
            }, 0);
            
            totalFoodCost = items.reduce((sum, item: any) => {
              const quantity = item.quantity || 0;
              const costPrice = Number(item.products?.cost_price) || 0;
              return sum + (quantity * costPrice);
            }, 0);
          }
        } catch (itemError) {
          console.error('Error in transaction_items query:', itemError);
        }
      }

      // Get operational expenses for this rider
      const { data: expenses } = await supabase
        .from('daily_operational_expenses')
        .select('amount, expense_type, rider_id')
        .eq('rider_id', assignedRiderId)
        .gte('expense_date', startStr)
        .lte('expense_date', endStr);

      const operationalExpenses = (expenses || []).reduce((sum, expense: any) => {
        const type = (expense.expense_type || '').toLowerCase();
        // Exclude food/raw material costs from operational expenses
        if (!type.includes('food') && !type.includes('bahan')) {
          return sum + Number(expense.amount || 0);
        }
        return sum;
      }, 0);

      const totalSales = cashRevenue + qrisRevenue + transferRevenue;
      const totalTransactions = transactions?.length || 0;
      const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      
      // Calculate profit using same logic as Profit/Loss report
      const grossProfit = totalSales - mdrAmount;
      const totalProfit = grossProfit - totalFoodCost - operationalExpenses;

      // Active riders = 1 if assigned rider has active shift today, 0 otherwise
      const today = new Date().toISOString().split('T')[0];
      const { data: activeShifts } = await supabase
        .from('shift_management')
        .select('id')
        .eq('shift_date', today)
        .eq('status', 'active')
        .eq('rider_id', assignedRiderId);
      const activeRiders = activeShifts?.length || 0;

      // Calculate cash deposit (Cash sales minus operational expenses)
      const cashDeposit = cashRevenue - operationalExpenses;

      setStats({
        totalSales,
        totalTransactions,
        avgTransactionValue,
        totalFoodCost,
        totalItemsSold,
        totalProfit,
        totalMembers: customers?.length || 0,
        activeRiders,
        cashSales: cashRevenue,
        qrisSales: qrisRevenue,
        transferSales: transferRevenue,
        operationalExpenses,
        cashDeposit
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchSalesChart = async () => {
    if (!assignedRiderId) return;

    try {
      // Generate chart data based on the date range for assigned rider only
      const chartData = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      // If date range is small, show daily data; otherwise monthly
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        // Show daily data
        for (let i = 0; i <= diffDays; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const { data: dailyTransactions } = await supabase
            .from('transactions')
            .select('final_amount')
            .eq('status', 'completed')
            .eq('rider_id', assignedRiderId)
            .gte('transaction_date', `${dateStr}T00:00:00`)
            .lte('transaction_date', `${dateStr}T23:59:59`);
          const dailySales = dailyTransactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
          chartData.push({
            month: date.toLocaleDateString('id-ID', {
              month: 'short',
              day: 'numeric'
            }),
            sales: dailySales
          });
        }
      } else {
        // Show monthly data for larger ranges
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 0; i < 6; i++) {
          const monthStart = new Date(end);
          monthStart.setMonth(end.getMonth() - i);
          monthStart.setDate(1);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          const { data: monthlyTransactions } = await supabase
            .from('transactions')
            .select('final_amount')
            .eq('status', 'completed')
            .eq('rider_id', assignedRiderId)
            .gte('transaction_date', monthStart.toISOString())
            .lte('transaction_date', monthEnd.toISOString());
          const monthlySales = monthlyTransactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
          chartData.unshift({
            month: months[monthStart.getMonth()],
            sales: monthlySales
          });
        }
      }
      setSalesData(chartData);
    } catch (error) {
      console.error("Error fetching sales chart:", error);
    }
  };

  const fetchProductSales = async () => {
    if (!assignedRiderId) return;

    try {
      const { data: transactions } = await supabase.from('transactions').select(`
          transaction_date,
          rider_id,
          status,
          transaction_items(
            quantity,
            products!inner(name)
          )
        `).eq('status', 'completed')
        .eq('rider_id', assignedRiderId)
        .gte('transaction_date', `${startDate}T00:00:00`)
        .lte('transaction_date', `${endDate}T23:59:59`);

      if (!transactions) {
        setProductSales([]);
        return;
      }

      const productQuantities: {
        [key: string]: {
          quantity: number;
          revenue: number;
        };
      } = {};

      transactions.forEach(transaction => {
        transaction.transaction_items?.forEach((item: any) => {
          const productName = item.products?.name || 'Unknown';
          if (!productQuantities[productName]) {
            productQuantities[productName] = {
              quantity: 0,
              revenue: 0
            };
          }
          productQuantities[productName].quantity += item.quantity;
          productQuantities[productName].revenue += item.quantity * 25000; // Estimate price
        });
      });

      // Get top 4 and group others as "Lainnya"
      const sortedProducts = Object.entries(productQuantities).sort(([, a], [, b]) => b.quantity - a.quantity);
      const top4 = sortedProducts.slice(0, 4);
      const others = sortedProducts.slice(4);
      
      const total = Object.values(productQuantities).reduce((sum, data) => sum + data.quantity, 0);
      
      const productSalesData = top4.map(([name, data], index) => ({
        name,
        value: total > 0 ? Math.round(data.quantity / total * 100) : 0,
        color: COLORS[index],
        quantity: data.quantity,
        revenue: data.revenue
      }));
      
      // Add "Lainnya" if there are more than 4 products
      if (others.length > 0) {
        const othersTotal = others.reduce((sum, [, data]) => sum + data.quantity, 0);
        productSalesData.push({
          name: 'Lainnya',
          value: total > 0 ? Math.round(othersTotal / total * 100) : 0,
          color: COLORS[4],
          quantity: othersTotal,
          revenue: others.reduce((sum, [, data]) => sum + data.revenue, 0)
        });
      }
      setProductSales(productSalesData);
    } catch (error) {
      console.error("Error fetching product sales:", error);
      setProductSales([]);
    }
  };

  const fetchRiderExpenses = async () => {
    if (!assignedRiderId || !assignedRiderName) return;

    try {
      const { data: expenses } = await supabase
        .from('daily_operational_expenses')
        .select('amount, rider_id')
        .eq('rider_id', assignedRiderId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (!expenses) {
        setRiderExpenses([]);
        return;
      }

      const totalExpenses = expenses.reduce((sum, expense: any) => sum + parseFloat(expense.amount), 0);
      setRiderExpenses([{
        rider_name: assignedRiderName,
        total_expenses: totalExpenses
      }]);
    } catch (error) {
      console.error("Error fetching rider expenses:", error);
      setRiderExpenses([]);
    }
  };

  const fetchRiderStockData = async () => {
    if (!assignedRiderId || !assignedRiderName) return;

    try {
      // Get stock movements for this rider
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('quantity, movement_type, created_at')
        .eq('rider_id', assignedRiderId)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      // Get transactions for revenue and orders count
      const { data: transactions } = await supabase
        .from('transactions')
        .select('final_amount, id')
        .eq('status', 'completed')
        .eq('rider_id', assignedRiderId)
        .gte('transaction_date', `${startDate}T00:00:00`)
        .lte('transaction_date', `${endDate}T23:59:59`);

      const initialStock = (stockMovements || [])
        .filter(m => m.movement_type === 'out')
        .reduce((sum, m) => sum + m.quantity, 0);

      const sold = (stockMovements || [])
        .filter(m => m.movement_type === 'transfer')
        .reduce((sum, m) => sum + m.quantity, 0);

      const remaining = initialStock - sold;
      const revenue = (transactions || []).reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0);
      const orders = transactions?.length || 0;

      setRiderStockData([{
        rider_name: assignedRiderName,
        initial_stock: initialStock,
        sold,
        remaining,
        revenue,
        orders
      }]);
    } catch (error) {
      console.error("Error fetching rider stock data:", error);
      setRiderStockData([]);
    }
  };

  const fetchHourlyData = async () => {
    if (!assignedRiderId) return;

    try {
      const { data: transactions } = await supabase.from('transactions').select(`
          transaction_date,
          rider_id,
          transaction_items(
            quantity,
            products!inner(name)
          )
        `).eq('status', 'completed')
        .eq('rider_id', assignedRiderId)
        .gte('transaction_date', `${startDate}T00:00:00`)
        .lte('transaction_date', `${endDate}T23:59:59`);

      if (!transactions) {
        setHourlyData([]);
        return;
      }

      // Group by time shifts
      const shifts = [
        { name: 'Pagi (07:00-12:00)', start: 7, end: 12, color: SHIFT_COLORS[0] },
        { name: 'Siang (12:00-17:00)', start: 12, end: 17, color: SHIFT_COLORS[1] },
        { name: 'Malam (17:00-22:00)', start: 17, end: 22, color: SHIFT_COLORS[2] }
      ];

      const shiftData = shifts.map(shift => {
        const shiftTransactions = transactions.filter(t => {
          const hour = new Date(t.transaction_date).getHours();
          return hour >= shift.start && hour < shift.end;
        });

        const totalQuantity = shiftTransactions.reduce((sum, t) => {
          return sum + (t.transaction_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0);
        }, 0);

        return {
          shift: shift.name,
          quantity: totalQuantity,
          fill: shift.color
        };
      });

      setHourlyData(shiftData);
    } catch (error) {
      console.error("Error fetching hourly data:", error);
      setHourlyData([]);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  if (riderLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading rider assignment...</p>
        </div>
      </div>
    );
  }

  if (riderError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-destructive">Assignment Error</h3>
          <p className="text-muted-foreground max-w-md">
            {riderError?.includes('No rider assignment') 
              ? 'Anda belum ditugaskan untuk rider manapun. Silakan hubungi admin untuk mendapatkan assignment.'
              : `Error: ${riderError}`
            }
          </p>
          <Button onClick={refreshAssignment} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!shouldAutoFilter) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">No Rider Assignment</h3>
          <p className="text-muted-foreground max-w-md">Your account is not assigned to any rider. Please contact your administrator.</p>
          <Button onClick={refreshAssignment} variant="outline">
            Refresh Assignment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with rider info */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branch Hub Report</h1>
          <p className="text-muted-foreground">
            Data untuk: <span className="font-semibold text-primary">{assignedRiderName}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="flex items-center gap-2">
            <Button
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('today')}
            >
              Hari Ini
            </Button>
            <Button
              variant={dateFilter === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('weekly')}
            >
              7 Hari
            </Button>
            <Button
              variant={dateFilter === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('monthly')}
            >
              Bulan Ini
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-success" />
              Total Items Sold: {formatNumber(stats.totalItemsSold)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalTransactions)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-success" />
              Food Cost: {formatCurrency(stats.totalFoodCost)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total QRIS</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.qrisSales)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <CreditCard className="mr-1 h-3 w-3 text-blue-500" />
              Penjualan QRIS
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transfer Bank</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.transferSales)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Banknote className="mr-1 h-3 w-3 text-green-500" />
              Penjualan Transfer
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Transaksi</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgTransactionValue)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Calculator className="mr-1 h-3 w-3 text-orange-500" />
              Per transaksi
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Beban Operasional</CardTitle>
            <ExpenseIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.operationalExpenses)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <ExpenseIcon className="mr-1 h-3 w-3 text-destructive" />
              Pengeluaran operasional
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Setoran Tunai</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.cashDeposit)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Coins className="mr-1 h-3 w-3 text-green-500" />
              Cash - Beban Operasional
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalMembers)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Users className="mr-1 h-3 w-3 text-purple-500" />
              Customer aktif
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Overview Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesData}>
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${formatNumber(value / 1000)}K`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#DC2626"
                    fill="url(#colorSales)"
                  />
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Menu Terjual */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CoffeeIcon className="h-5 w-5" />
              Menu Terjual
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-64">
                  <PieChart3D 
                    title="Menu Terjual"
                    data={productSales.map(item => ({
                      ...item,
                      percentage: item.value
                    }))} 
                  />
                </div>
                <div className="bg-white rounded-lg border">
                  <div className="p-4 border-b">
                    <h4 className="font-semibold text-sm">Detail Produk Terjual</h4>
                  </div>
                  <div className="divide-y bg-white">
                    {productSales.map((item, index) => (
                      <div key={index} className="p-4 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-sm">{item.quantity} pcs</div>
                          <div className="text-xs text-muted-foreground">{item.value}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Jam Terjual Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Jam Terjual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shift" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Performa Stok
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="space-y-4">
              {riderStockData.map((data, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{data.rider_name}</p>
                    <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Stok Awal:</p>
                        <p className="font-medium">{data.initial_stock}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Terjual:</p>
                        <p className="font-medium text-success">{data.sold}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sisa:</p>
                        <p className="font-medium text-warning">{data.remaining}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Orders:</p>
                        <p className="font-medium">{data.orders}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(data.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="space-y-4">
              {riderExpenses.map((expense, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{expense.rider_name}</p>
                    <p className="text-sm text-muted-foreground">Total Expenses</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(expense.total_expenses)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};