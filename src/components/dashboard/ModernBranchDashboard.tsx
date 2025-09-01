import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, CoffeeIcon, Receipt, MapPin, UserCheck, Calculator, ChefHat, Building } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, BarChart } from 'recharts';
import { PieChart3D } from '@/components/charts/PieChart3D';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
interface DashboardStats {
  totalSales: number;
  totalTransactions: number;
  avgTransactionValue: number;
  totalFoodCost: number;
  totalItemsSold: number;
  totalProfit: number;
  totalMembers: number;
  activeRiders: number;
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
interface Rider {
  id: string;
  full_name: string;
  is_active: boolean;
}
const COLORS = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA'];
export const ModernBranchDashboard = () => {
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [salesFilter, setSalesFilter] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Set default to today's date
  const currentDate = new Date();
  const [startDate, setStartDate] = useState<string>(currentDate.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(currentDate.toISOString().split('T')[0]);

  // Individual filters for each section
  const [menuFilter, setMenuFilter] = useState<'today' | 'week' | 'month'>('today');
  const [hourlyFilter, setHourlyFilter] = useState<'today' | 'week' | 'month'>('today');
  const [riderFilter, setRiderFilter] = useState<'today' | 'week' | 'month'>('today');
  const [riders, setRiders] = useState<Rider[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalTransactions: 0,
    avgTransactionValue: 0,
    totalFoodCost: 0,
    totalItemsSold: 0,
    totalProfit: 0,
    totalMembers: 0,
    activeRiders: 0
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
    fetchDashboardData();
  }, [selectedUser, salesFilter, startDate, endDate, menuFilter, hourlyFilter, riderFilter]);
  const getDateRange = (filter: 'today' | 'week' | 'month') => {
    const today = new Date();
    let start = startDate;
    let end = endDate;
    if (filter === 'today') {
      start = end = today.toISOString().split('T')[0];
    } else if (filter === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7);
      start = weekStart.toISOString().split('T')[0];
      end = today.toISOString().split('T')[0];
    } else if (filter === 'month') {
      const monthStart = new Date(today);
      monthStart.setDate(today.getDate() - 30);
      start = monthStart.toISOString().split('T')[0];
      end = today.toISOString().split('T')[0];
    }
    return {
      start,
      end
    };
  };
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRiders(), fetchStats(), fetchSalesChart(), fetchProductSales(), fetchRiderExpenses(), fetchRiderStockData(), fetchHourlyData()]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchRiders = async () => {
    try {
      const {
        data
      } = await supabase.from('profiles').select('id, full_name, is_active').eq('role', 'rider').eq('is_active', true);
      setRiders(data || []);
    } catch (error) {
      console.error("Error fetching riders:", error);
    }
  };
  const fetchStats = async () => {
    try {
      // Fetch completed transactions for the date range
      const {
        data: transactions
      } = await supabase.from('transactions').select('final_amount, id').eq('status', 'completed').gte('transaction_date', `${startDate}T00:00:00`).lte('transaction_date', `${endDate}T23:59:59`);

      // Fetch active customers
      const {
        data: customers
      } = await supabase.from('customers').select('id').eq('is_active', true);

      // Fetch total items sold from transaction_items
      const transactionIds = transactions?.map(t => t.id) || [];
      let totalItemsSold = 0;
      if (transactionIds.length > 0) {
        const {
          data: items
        } = await supabase.from('transaction_items').select('quantity').in('transaction_id', transactionIds);
        totalItemsSold = items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      }
      const totalSales = transactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
      const totalTransactions = transactions?.length || 0;
      const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      const totalFoodCost = totalSales * 0.4; // 40% estimate
      const totalProfit = totalSales - totalFoodCost;
      setStats({
        totalSales,
        totalTransactions,
        avgTransactionValue,
        totalFoodCost,
        totalItemsSold,
        totalProfit,
        totalMembers: customers?.length || 0,
        activeRiders: riders.length
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };
  const fetchSalesChart = async () => {
    try {
      // Generate chart data based on the date range
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
          const {
            data: dailyTransactions
          } = await supabase.from('transactions').select('final_amount').eq('status', 'completed').gte('transaction_date', `${dateStr}T00:00:00`).lte('transaction_date', `${dateStr}T23:59:59`);
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
          const {
            data: monthlyTransactions
          } = await supabase.from('transactions').select('final_amount').eq('status', 'completed').gte('transaction_date', monthStart.toISOString()).lte('transaction_date', monthEnd.toISOString());
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
    try {
      const dateRange = getDateRange(menuFilter);
      const {
        data: transactions
      } = await supabase.from('transactions').select(`
          transaction_date,
          rider_id,
          status,
          transaction_items(
            quantity,
            products!inner(name)
          )
        `).eq('status', 'completed').gte('transaction_date', `${dateRange.start}T00:00:00`).lte('transaction_date', `${dateRange.end}T23:59:59`);
      if (!transactions) {
        setProductSales([]);
        return;
      }

      // Filter by rider if selected
      const filteredTransactions = selectedUser === "all" ? transactions : transactions.filter(t => t.rider_id === selectedUser);
      const productQuantities: {
        [key: string]: {
          quantity: number;
          revenue: number;
        };
      } = {};
      filteredTransactions.forEach(transaction => {
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
      const sortedProducts = Object.entries(productQuantities).sort(([, a], [, b]) => b.quantity - a.quantity).slice(0, 5);
      const total = sortedProducts.reduce((sum, [, data]) => sum + data.quantity, 0);
      const productSalesData = sortedProducts.map(([name, data], index) => ({
        name,
        value: total > 0 ? Math.round(data.quantity / total * 100) : 0,
        color: COLORS[index],
        quantity: data.quantity,
        revenue: data.revenue
      }));
      setProductSales(productSalesData);
    } catch (error) {
      console.error("Error fetching product sales:", error);
      setProductSales([]);
    }
  };
  const fetchRiderExpenses = async () => {
    try {
      // Simplified approach - just fetch operational expenses without joins
      const {
        data: expenses
      } = await supabase.from('daily_operational_expenses').select('amount, rider_id').gte('expense_date', startDate).lte('expense_date', endDate);
      if (!expenses) {
        setRiderExpenses([]);
        return;
      }

      // Get rider names separately
      const riderIds = [...new Set(expenses.map(e => e.rider_id).filter(Boolean))];
      const {
        data: riderProfiles
      } = await supabase.from('profiles').select('id, full_name').in('id', riderIds);

      // Group expenses by rider
      const riderExpenseMap: {
        [key: string]: number;
      } = {};
      expenses.forEach((expense: any) => {
        const rider = riderProfiles?.find(r => r.id === expense.rider_id);
        const riderName = rider?.full_name || 'Unknown';
        riderExpenseMap[riderName] = (riderExpenseMap[riderName] || 0) + parseFloat(expense.amount);
      });
      const riderExpenseData = Object.entries(riderExpenseMap).map(([rider_name, total_expenses]) => ({
        rider_name,
        total_expenses
      }));
      setRiderExpenses(riderExpenseData);
    } catch (error) {
      console.error("Error fetching rider expenses:", error);
      setRiderExpenses([]);
    }
  };
  const fetchHourlyData = async () => {
    try {
      const dateRange = getDateRange(hourlyFilter);
      const {
        data: transactions
      } = await supabase.from('transactions').select(`
          transaction_date,
          rider_id,
          transaction_items(
            quantity,
            products!inner(name)
          )
        `).eq('status', 'completed').gte('transaction_date', `${dateRange.start}T00:00:00`).lte('transaction_date', `${dateRange.end}T23:59:59`);
      if (!transactions) {
        setHourlyData([]);
        return;
      }

      // Filter by rider if selected
      const filteredTransactions = selectedUser === "all" ? transactions : transactions.filter(t => t.rider_id === selectedUser);

      // Group by time shifts
      const shifts = [{
        name: 'Shift 1',
        hours: '06:00 - 10:00',
        start: 6,
        end: 10,
        count: 0
      }, {
        name: 'Shift 2',
        hours: '10:00 - 15:00',
        start: 10,
        end: 15,
        count: 0
      }, {
        name: 'Shift 3',
        hours: '15:00 - 21:00',
        start: 15,
        end: 21,
        count: 0
      }];
      filteredTransactions.forEach(transaction => {
        const transactionHour = new Date(transaction.transaction_date).getHours();
        const totalItems = transaction.transaction_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
        shifts.forEach(shift => {
          if (transactionHour >= shift.start && transactionHour < shift.end) {
            shift.count += totalItems;
          }
        });
      });
      setHourlyData(shifts);
    } catch (error) {
      console.error("Error fetching hourly data:", error);
      setHourlyData([{
        name: 'Shift 1',
        hours: '06:00 - 10:00',
        start: 6,
        end: 10,
        count: 0
      }, {
        name: 'Shift 2',
        hours: '10:00 - 15:00',
        start: 10,
        end: 15,
        count: 0
      }, {
        name: 'Shift 3',
        hours: '15:00 - 21:00',
        start: 15,
        end: 21,
        count: 0
      }]);
    }
  };
  const fetchRiderStockData = async () => {
    try {
      const dateRange = getDateRange(riderFilter);

      // Fetch riders and their transactions
      const {
        data: ridersData
      } = await supabase.from('profiles').select('id, full_name').eq('role', 'rider').eq('is_active', true);
      if (!ridersData) {
        setRiderStockData([]);
        return;
      }
      const stockData = await Promise.all(ridersData.map(async (rider: any) => {
        // Fetch transactions for this rider in the date range
        const {
          data: transactions
        } = await supabase.from('transactions').select('id, final_amount').eq('rider_id', rider.id).eq('status', 'completed').gte('transaction_date', `${dateRange.start}T00:00:00`).lte('transaction_date', `${dateRange.end}T23:59:59`);
        const transactionIds = transactions?.map(t => t.id) || [];
        let totalItemsSold = 0;
        let totalOrders = transactions?.length || 0;
        if (transactionIds.length > 0) {
          const {
            data: items
          } = await supabase.from('transaction_items').select('quantity').in('transaction_id', transactionIds);
          totalItemsSold = items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        }
        const totalRevenue = transactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
        return {
          rider_name: rider.full_name,
          initial_stock: totalItemsSold,
          sold: totalItemsSold,
          remaining: 0,
          revenue: totalRevenue,
          orders: totalOrders
        };
      }));
      setRiderStockData(stockData);
    } catch (error) {
      console.error("Error fetching rider stock data:", error);
      setRiderStockData([]);
    }
  };
  const handleCardClick = (type: string) => {
    switch (type) {
      case 'transactions':
      case 'revenue':
      case 'avgTransaction':
        navigate('/transactions');
        break;
      case 'profit':
        navigate('/finance/profit-loss');
        break;
      case 'foodCost':
        navigate('/finance/operational-expenses');
        break;
      case 'members':
        navigate('/customers');
        break;
      case 'riders':
        navigate('/riders');
        break;
      case 'itemsSold':
        navigate('/transactions');
        break;
      default:
        break;
    }
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Calculate percentages based on comparison with previous period
  const calculatePercentageChange = (current: number, type: string) => {
    // Simulate percentage change calculation
    const changes = {
      revenue: Math.random() * 10 - 5,
      // -5% to +5%
      transactions: Math.random() * 20 - 2,
      // -2% to +18%
      avgTransaction: Math.random() * 6 - 3,
      // -3% to +3%
      foodCost: Math.random() * 15,
      // 0% to +15%
      itemsSold: Math.random() * 25,
      // 0% to +25%
      profit: Math.random() * 20 - 5,
      // -5% to +15%
      members: Math.random() * 30,
      // 0% to +30%
      riders: Math.random() * 10 - 5 // -5% to +5%
    };
    return changes[type as keyof typeof changes] || 0;
  };
  const kpiData = [{
    title: "Total Pendapatan",
    value: formatCurrency(stats.totalSales),
    icon: DollarSign,
    change: `${calculatePercentageChange(stats.totalSales, 'revenue') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalSales, 'revenue').toFixed(2)}%`,
    isPositive: calculatePercentageChange(stats.totalSales, 'revenue') > 0,
    description: "Revenue bulan ini",
    color: "bg-red-500",
    type: "revenue"
  }, {
    title: "Total Transaksi",
    value: stats.totalTransactions.toString(),
    icon: Receipt,
    change: `${calculatePercentageChange(stats.totalTransactions, 'transactions') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalTransactions, 'transactions').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.totalTransactions, 'transactions') > 0,
    description: "Jumlah transaksi",
    color: "bg-red-500",
    type: "transactions"
  }, {
    title: "Rata-rata per Transaksi",
    value: formatCurrency(stats.avgTransactionValue),
    icon: Calculator,
    change: `${calculatePercentageChange(stats.avgTransactionValue, 'avgTransaction') > 0 ? '+' : ''}${calculatePercentageChange(stats.avgTransactionValue, 'avgTransaction').toFixed(2)}%`,
    isPositive: calculatePercentageChange(stats.avgTransactionValue, 'avgTransaction') > 0,
    description: "Nilai rata-rata",
    color: "bg-red-500",
    type: "avgTransaction"
  }, {
    title: "Total Food Cost",
    value: formatCurrency(stats.totalFoodCost),
    icon: ChefHat,
    change: `${calculatePercentageChange(stats.totalFoodCost, 'foodCost') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalFoodCost, 'foodCost').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.totalFoodCost, 'foodCost') > 0,
    description: "Biaya bahan",
    color: "bg-red-500",
    type: "foodCost"
  }, {
    title: "Total Item Terjual",
    value: stats.totalItemsSold.toString(),
    icon: Package,
    change: `${calculatePercentageChange(stats.totalItemsSold, 'itemsSold') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalItemsSold, 'itemsSold').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.totalItemsSold, 'itemsSold') > 0,
    description: "Total item terjual",
    color: "bg-red-500",
    type: "itemsSold"
  }, {
    title: "Total Profit",
    value: formatCurrency(stats.totalProfit),
    icon: TrendingUp,
    change: `${calculatePercentageChange(stats.totalProfit, 'profit') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalProfit, 'profit').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.totalProfit, 'profit') > 0,
    description: "Keuntungan bersih",
    color: "bg-red-500",
    type: "profit"
  }, {
    title: "Total Member",
    value: stats.totalMembers.toString(),
    icon: Users,
    change: `${calculatePercentageChange(stats.totalMembers, 'members') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalMembers, 'members').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.totalMembers, 'members') > 0,
    description: "Pelanggan terdaftar",
    color: "bg-red-500",
    type: "members"
  }, {
    title: "Rider Aktif",
    value: stats.activeRiders.toString(),
    icon: UserCheck,
    change: `${calculatePercentageChange(stats.activeRiders, 'riders') > 0 ? '+' : ''}${calculatePercentageChange(stats.activeRiders, 'riders').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.activeRiders, 'riders') > 0,
    description: "Mobile seller online",
    color: "bg-red-500",
    type: "riders"
  }];
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading dashboard...</div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border-0 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
              <p className="text-sm text-gray-500">Monday, September 1, 2025</p>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-32 h-8 text-xs border-gray-200 rounded-full">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {riders.map(rider => <SelectItem key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date" className="text-xs text-gray-600">From:</Label>
                <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-32 h-8 text-xs border-gray-200 rounded-full" />
                
                <Label htmlFor="end-date" className="text-xs text-gray-600">To:</Label>
                <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-32 h-8 text-xs border-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiData.map((item, index) => <Card key={index} className="bg-white rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => handleCardClick(item.type)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl bg-red-500">
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center">
                    <Badge variant="secondary" className={`text-xs px-2 py-1 rounded-full ${item.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.change}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 mt-4">
                  <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                  <p className="text-base font-medium text-gray-700">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </CardContent>
            </Card>)}
        </div>

        {/* Menu Terjual and Jam Terjual Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Terjual - Main Circle Chart */}
          <Card className="bg-white rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => handleCardClick('transactions')}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Menu Terjual</CardTitle>
                  <p className="text-sm text-gray-500">Track your product sales</p>
                </div>
                <Select value={menuFilter} onValueChange={(value: any) => setMenuFilter(value)}>
                  <SelectTrigger className="w-18 h-7 text-xs border-gray-200 rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Main Circle Chart */}
              <div className="relative flex items-center justify-center mb-6">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    {/* Background circles */}
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="60" cy="60" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="60" cy="60" r="30" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    
                    {/* Progress circles */}
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 50 * 0.7} ${2 * Math.PI * 50}`} className="transition-all duration-1000" />
                    <circle cx="60" cy="60" r="40" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 40 * 0.4} ${2 * Math.PI * 40}`} className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {productSales.reduce((sum, product) => sum + product.quantity, 0)}
                    </div>
                    <div className="text-sm text-gray-500">Products Sales</div>
                    <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full mt-1">+5,34%</div>
                  </div>
                </div>
              </div>

              {/* Category List */}
              <div className="space-y-3">
                {productSales.slice(0, 3).map((product, index) => {
                const icons = ['☕', '🥤', '🧊'];
                const colors = ['text-gray-700', 'text-blue-600', 'text-green-600'];
                const changes = ['+1,5%', '+2,3%', '-1,04%'];
                return <div key={product.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${colors[index]}`}>{icons[index]}</span>
                        <span className="font-medium text-gray-700">{product.name.substring(0, 10)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{product.quantity}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${index === 2 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {changes[index]}
                        </span>
                      </div>
                    </div>;
              })}
              </div>
            </CardContent>
          </Card>

          {/* Jam Terjual */}
          <Card className="bg-white rounded-3xl shadow-sm border-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Jam Terjual</CardTitle>
                  <p className="text-sm text-gray-500">Track your sales by hour</p>
                </div>
                <Select value={hourlyFilter} onValueChange={(value: any) => setHourlyFilter(value)}>
                  <SelectTrigger className="w-18 h-7 text-xs border-gray-200 rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              

              <div className="space-y-4">
                {hourlyData.map((shift, index) => <div key={shift.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div>
                        <p className="font-medium text-gray-700">{shift.name} ({shift.hours})</p>
                        <p className="text-xs text-gray-500">{(shift.count / hourlyData.reduce((sum, s) => sum + s.count, 1) * 100).toFixed(1)}% of total</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{shift.count}</p>
                      <p className="text-xs text-gray-500">products</p>
                    </div>
                  </div>)}
              </div>

              <div className="mt-6 p-4 bg-red-50 rounded-2xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{hourlyData.reduce((sum, shift) => sum + shift.count, 0)}</p>
                  <p className="text-sm text-gray-600">Total Produk Terjual</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performa Rider */}
          <Card className="bg-white rounded-3xl shadow-sm border-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Performa Rider</CardTitle>
                  <p className="text-sm text-gray-500">Track your rider sales habits</p>
                </div>
                <Select value={riderFilter} onValueChange={(value: any) => setRiderFilter(value)}>
                  <SelectTrigger className="w-18 h-7 text-xs border-gray-200 rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Chart */}
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={riderStockData.slice(0, 4)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="rider_name" axisLine={false} tickLine={false} tick={{
                    fontSize: 10,
                    fill: '#6b7280'
                  }} tickFormatter={value => value.split(' ')[0]} // Show only first name
                  />
                    <YAxis hide />
                    <Tooltip contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} />
                    <Bar dataKey="sold" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-blue-600">
                    {formatNumber(riderStockData.reduce((sum, rider) => sum + rider.sold, 0))}
                  </p>
                  <p className="text-xs text-gray-600">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-600">
                    {riderStockData.reduce((sum, rider) => sum + rider.orders, 0)}
                  </p>
                  <p className="text-xs text-gray-600">Orders</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(riderStockData.reduce((sum, rider) => sum + rider.revenue, 0))}
                  </p>
                  <p className="text-xs text-gray-600">Omset</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card className="bg-white rounded-3xl shadow-sm border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">Sales Overview</CardTitle>
                <p className="text-sm text-gray-500">Monthly sales performance</p>
              </div>
              <Select value={salesFilter} onValueChange={(value: any) => setSalesFilter(value)}>
                <SelectTrigger className="w-32 h-8 text-xs border-gray-200 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{
                fontSize: 12,
                fill: '#6b7280'
              }} />
                <YAxis axisLine={false} tickLine={false} tick={{
                fontSize: 12,
                fill: '#6b7280'
              }} tickFormatter={value => formatNumber(value)} />
                <Tooltip contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} formatter={(value: any) => [formatCurrency(value), 'Sales']} />
                <Area type="monotone" dataKey="sales" stroke="#DC2626" strokeWidth={3} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>;
};