import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  CoffeeIcon,
  Receipt,
  MapPin,
  UserCheck,
  Calculator,
  ChefHat,
  Building
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, BarChart } from 'recharts';
import { PieChart3D } from '@/components/charts/PieChart3D';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalSales: number;
  totalTransactions: number;
  avgTransactionValue: number;
  totalFoodCost: number;
  totalOperationalExpenses: number;
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
  const [riders, setRiders] = useState<Rider[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalTransactions: 0,
    avgTransactionValue: 0,
    totalFoodCost: 0,
    totalOperationalExpenses: 0,
    totalProfit: 0,
    totalMembers: 0,
    activeRiders: 0
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [riderExpenses, setRiderExpenses] = useState<{rider_name: string, total_expenses: number}[]>([]);
  const [riderStockData, setRiderStockData] = useState<{rider_name: string, initial_stock: number, sold: number, remaining: number}[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, [selectedUser, salesFilter, startDate, endDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRiders(),
        fetchStats(), 
        fetchSalesChart(),
        fetchProductSales(),
        fetchRiderExpenses(),
        fetchRiderStockData(),
        fetchHourlyData()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHourlyData = async () => {
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          transaction_date,
          transaction_items(
            product_id,
            quantity,
            products(name, category)
          )
        `)
        .eq('status', 'completed')
        .gte('transaction_date', `${startDate}T00:00:00`)
        .lte('transaction_date', `${endDate}T23:59:59`);

      if (transactions) {
        const hourlyStats: Record<string, number> = {};
        
        transactions.forEach((transaction: any) => {
          const hour = new Date(transaction.transaction_date).getHours();
          const hourKey = `${hour}:00`;
          
          transaction.transaction_items?.forEach((item: any) => {
            hourlyStats[hourKey] = (hourlyStats[hourKey] || 0) + item.quantity;
          });
        });

        const formattedData = Object.entries(hourlyStats)
          .map(([hour, quantity]) => ({
            name: hour,
            value: quantity,
            percentage: 0,
            color: ''
          }))
          .sort((a, b) => parseInt(a.name) - parseInt(b.name));

        const total = formattedData.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        
        formattedData.forEach((item, index) => {
          item.percentage = (item.value / total) * 100;
          item.color = colors[index % colors.length];
        });

        setHourlyData(formattedData.filter(item => item.value > 0));
      }
    } catch (error) {
      console.error('Error fetching hourly data:', error);
    }
  };

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, is_active')
        .eq('role', 'rider')
        .eq('is_active', true);

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error("Error fetching riders:", error);
    }
  };

  const fetchStats = async () => {
    try {
      // Build query based on date range and selected user
      let transactionQuery = supabase
        .from('transactions')
        .select('final_amount, id')
        .eq('status', 'completed')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      if (selectedUser !== "all") {
        transactionQuery = transactionQuery.eq('rider_id', selectedUser);
      }

      const { data: salesData, error: salesError } = await transactionQuery;
      if (salesError) throw salesError;

      const totalSales = salesData?.reduce((sum, transaction) => sum + (transaction.final_amount || 0), 0) || 0;
      const totalTransactions = salesData?.length || 0;
      const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      // Fetch operational expenses - use date range filter
      let expenseQuery = supabase
        .from('daily_operational_expenses')
        .select('amount')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (selectedUser !== "all") {
        const { data: riderProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', selectedUser)
          .single();
        
        if (riderProfile) {
          expenseQuery = expenseQuery.eq('rider_id', selectedUser);
        }
      }

      const { data: expenseData } = await expenseQuery;
      const totalOperationalExpenses = expenseData?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;

      // Calculate food cost (estimate 35% of sales)
      const totalFoodCost = totalSales * 0.35;
      
      // Calculate profit
      const totalProfit = totalSales - totalFoodCost - totalOperationalExpenses;

      // Fetch member count
      const { data: memberData } = await supabase
        .from('customers')
        .select('id')
        .eq('is_active', true);

      const totalMembers = memberData?.length || 0;
      // Count active riders with shifts today
      const { data: activeShiftData } = await supabase
        .from('shift_management')
        .select('rider_id')
        .eq('shift_date', new Date().toISOString().split('T')[0])
        .eq('status', 'active');

      const activeRiders = activeShiftData?.length || 0;

      setStats({
        totalSales,
        totalTransactions,
        avgTransactionValue,
        totalFoodCost,
        totalOperationalExpenses,
        totalProfit,
        totalMembers,
        activeRiders
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchSalesChart = async () => {
    try {
      const salesByPeriod = [];
      
      if (startDate && endDate) {
        // Date range mode
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 31) {
          // Show daily data for up to 31 days
          for (let i = 0; i <= diffDays; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
            const queryDate = date.toISOString().split('T')[0];
            
            let query = supabase
              .from('transactions')
              .select('final_amount')
              .eq('status', 'completed')
              .gte('transaction_date', `${queryDate}T00:00:00`)
              .lt('transaction_date', `${queryDate}T23:59:59`);

            if (selectedUser !== "all") {
              query = query.eq('rider_id', selectedUser);
            }

            const { data } = await query;
            const daySales = data?.reduce((sum, t) => sum + (t.final_amount || 0), 0) || 0;
            
            salesByPeriod.push({ month: dateStr, sales: daySales });
          }
        } else {
          // Show weekly data for longer periods
          const weeks = Math.ceil(diffDays / 7);
          for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(start);
            weekStart.setDate(start.getDate() + (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            const weekStr = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
            
            let query = supabase
              .from('transactions')
              .select('final_amount')
              .eq('status', 'completed')
              .gte('transaction_date', weekStart.toISOString())
              .lte('transaction_date', weekEnd.toISOString());

            if (selectedUser !== "all") {
              query = query.eq('rider_id', selectedUser);
            }

            const { data } = await query;
            const weekSales = data?.reduce((sum, t) => sum + (t.final_amount || 0), 0) || 0;
            
            salesByPeriod.push({ month: weekStr, sales: weekSales });
          }
        }
      } else {
        // Default behavior: last 12 months
        const currentDate = new Date();
        
        for (let i = 11; i >= 0; i--) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthStr = date.toLocaleDateString('en', { month: 'short' });
          const queryStartDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-01`;
          const queryEndDate = `${date.getFullYear()}-${(date.getMonth() + 2).toString().padStart(2, '0')}-01`;

          let query = supabase
            .from('transactions')
            .select('final_amount')
            .eq('status', 'completed')
            .gte('transaction_date', queryStartDate)
            .lt('transaction_date', queryEndDate);

          if (selectedUser !== "all") {
            query = query.eq('rider_id', selectedUser);
          }

          const { data } = await query;
          const monthSales = data?.reduce((sum, t) => sum + (t.final_amount || 0), 0) || 0;
          
          salesByPeriod.push({ month: monthStr, sales: monthSales });
        }
      }
      
      setSalesData(salesByPeriod);
    } catch (error) {
      console.error("Error fetching sales chart:", error);
    }
  };

  const fetchProductSales = async () => {
    try {
      // Fetch top selling products
      const { data: transactionItems } = await supabase
        .from('transaction_items')
        .select(`
          quantity,
          products!inner(name)
        `);

      const productQuantities: { [key: string]: number } = {};
      transactionItems?.forEach(item => {
        const productName = item.products?.name || 'Unknown';
        productQuantities[productName] = (productQuantities[productName] || 0) + item.quantity;
      });

      const sortedProducts = Object.entries(productQuantities)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      const total = sortedProducts.reduce((sum, [,qty]) => sum + qty, 0);
      
      const mockProductSales = sortedProducts.map(([name, qty], index) => ({
        name,
        value: Math.round((qty / total) * 100),
        color: COLORS[index],
        quantity: qty,
        revenue: qty * 25000 // Estimate
      }));

      setProductSales(mockProductSales);
    } catch (error) {
      console.error("Error fetching product sales:", error);
      // Fallback to mock data
      const mockProductSales = [
        { name: 'Classic Latte', value: 40, color: COLORS[0], quantity: 100, revenue: 2500000 },
        { name: 'Americano', value: 30, color: COLORS[1], quantity: 75, revenue: 1875000 },
        { name: 'Dolce Latte', value: 15, color: COLORS[2], quantity: 37, revenue: 925000 },
        { name: 'Caramel Latte', value: 10, color: COLORS[3], quantity: 25, revenue: 625000 },
        { name: 'Others', value: 5, color: COLORS[4], quantity: 12, revenue: 300000 }
      ];
      setProductSales(mockProductSales);
    }
  };

  const fetchRiderExpenses = async () => {
    try {
      const { data: userProfile } = await supabase.auth.getUser();
      if (!userProfile.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('user_id', userProfile.user.id)
        .single();

      if (!profile) return;

      // Use the selected date range instead of fixed 30 days
      let expenseQuery = supabase
        .from('daily_operational_expenses')
        .select(`
          amount,
          rider_id,
          profiles!inner(full_name, branch_id)
        `)
        .eq('profiles.branch_id', profile.branch_id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      // Apply user filter if specific rider is selected
      if (selectedUser !== "all") {
        expenseQuery = expenseQuery.eq('rider_id', selectedUser);
      }

      const { data: expenses, error } = await expenseQuery;
      if (error) throw error;

      const riderExpenseMap: Record<string, number> = {};
      expenses?.forEach((expense: any) => {
        const riderName = expense.profiles.full_name;
        riderExpenseMap[riderName] = (riderExpenseMap[riderName] || 0) + Number(expense.amount);
      });

      const riderExpensesList = Object.entries(riderExpenseMap).map(([rider_name, total_expenses]) => ({
        rider_name,
        total_expenses
      }));

      setRiderExpenses(riderExpensesList);
    } catch (error) {
      console.error('Error fetching rider expenses:', error);
    }
  };

  const fetchRiderStockData = async () => {
    try {
      const { data: userProfile } = await supabase.auth.getUser();
      if (!userProfile.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('user_id', userProfile.user.id)
        .single();

      if (!profile) return;

      // Get today's riders with their initial stock and sales
      const today = new Date().toISOString().split('T')[0];
      
      const { data: riderData, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          inventory(stock_quantity),
          transactions!rider_id(final_amount)
        `)
        .eq('branch_id', profile.branch_id)
        .eq('role', 'rider')
        .eq('is_active', true);

      if (error) throw error;

      const riderStockList = riderData?.map((rider: any) => {
        const totalInitialStock = rider.inventory?.reduce((sum: number, inv: any) => sum + inv.stock_quantity, 0) || 0;
        const totalSalesValue = rider.transactions?.reduce((sum: number, tx: any) => sum + Number(tx.final_amount), 0) || 0;
        
        // Rough estimation: assuming average item price for stock calculation
        const estimatedItemPrice = 15000; // Average price assumption
        const estimatedSoldItems = Math.floor(totalSalesValue / estimatedItemPrice);
        const remainingStock = Math.max(0, totalInitialStock - estimatedSoldItems);
        
        return {
          rider_name: rider.full_name,
          initial_stock: totalInitialStock,
          sold: estimatedSoldItems,
          remaining: remainingStock
        };
      }) || [];

      setRiderStockData(riderStockList);
    } catch (error) {
      console.error('Error fetching rider stock data:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleCardClick = (cardType: string) => {
    const params = new URLSearchParams();
    if (selectedUser !== "all") {
      params.set('rider', selectedUser);
    }
    
    switch (cardType) {
      case 'sales':
      case 'transactions':
      case 'avg':
        navigate(`/transactions?${params.toString()}`);
        break;
      case 'members':
        navigate('/customers');
        break;
      case 'riders':
        navigate('/riders');
        break;
      case 'operational-expenses':
        navigate('/finance/rider-expenses');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statsCards = [
    {
      title: "Total Sales",
      value: formatCurrency(stats.totalSales),
      change: "+12%",
      trend: "up",
      subtitle: "Revenue bulan ini",
      icon: DollarSign,
      color: "text-primary",
      onClick: () => handleCardClick('sales')
    },
    {
      title: "Total Transaksi",
      value: stats.totalTransactions.toString(),
      change: "+8%",
      trend: "up", 
      subtitle: "Jumlah transaksi",
      icon: Receipt,
      color: "text-blue-600",
      onClick: () => handleCardClick('transactions')
    },
    {
      title: "Rata-rata per Transaksi",
      value: formatCurrency(stats.avgTransactionValue),
      change: "+5%",
      trend: "up",
      subtitle: "Nilai rata-rata", 
      icon: Calculator,
      color: "text-purple-600",
      onClick: () => handleCardClick('avg')
    },
    {
      title: "Total Food Cost",
      value: formatCurrency(stats.totalFoodCost),
      change: "+3%",
      trend: "up",
      subtitle: "Biaya bahan",
      icon: ChefHat,
      color: "text-orange-600",
      onClick: () => {}
    },
    {
      title: "Total Beban Operasional",
      value: formatCurrency(stats.totalOperationalExpenses),
      change: "-2%",
      trend: "down",
      subtitle: "Biaya operasional",
      icon: Building,
      color: "text-red-600",
      onClick: () => handleCardClick('operational-expenses')
    },
    {
      title: "Total Profit",
      value: formatCurrency(stats.totalProfit),
      change: "+15%",
      trend: "up",
      subtitle: "Keuntungan bersih",
      icon: TrendingUp,
      color: "text-green-600",
      onClick: () => {}
    },
    {
      title: "Total Member",
      value: stats.totalMembers.toString(),
      change: "+25%",
      trend: "up",
      subtitle: "Pelanggan terdaftar",
      icon: Users,
      color: "text-indigo-600",
      onClick: () => handleCardClick('members')
    },
    {
      title: "Rider Aktif",
      value: stats.activeRiders.toString(),
      change: "0%",
      trend: "up",
      subtitle: "Mobile seller online",
      icon: UserCheck,
      color: "text-teal-600",
      onClick: () => handleCardClick('riders')
    }
  ];

  const riderPerformanceData = [
    { rider: 'Z-005', sales: 850000, orders: 45 },
    { rider: 'Z-006', sales: 720000, orders: 38 },
    { rider: 'Z-010', sales: 920000, orders: 52 },
    { rider: 'Z-013', sales: 640000, orders: 34 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
            <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {riders.map((rider) => (
                  <SelectItem key={rider.id} value={rider.id}>
                    {rider.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total Pendapatan",
              value: formatCurrency(stats.totalSales),
              change: "+2.08%",
              icon: DollarSign,
              description: "Revenue bulan ini",
              bgColor: "bg-gradient-to-br from-red-500 to-red-600",
              textColor: "text-white",
              route: "/transactions"
            },
            {
              title: "Total Transaksi", 
              value: stats.totalTransactions.toString(),
              change: "+12.4%",
              icon: Receipt,
              description: "Jumlah transaksi",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/transactions"
            },
            {
              title: "Rata-rata per Transaksi",
              value: formatCurrency(stats.avgTransactionValue),
              change: "-2.08%",
              changeColor: "text-red-500",
              icon: Calculator,
              description: "Nilai rata-rata",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/transactions"
            },
            {
              title: "Total Food Cost",
              value: formatCurrency(stats.totalFoodCost),
              change: "+12.1%",
              icon: ChefHat,
              description: "Biaya bahan",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/finance/operational-expenses"
            }
          ].map((item, index) => (
            <Card key={index} className={`${item.bgColor} ${item.textColor} rounded-2xl border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer`} onClick={() => navigate(item.route)}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${index === 0 ? 'bg-white/20' : 'bg-gray-100'}`}>
                    <item.icon className={`h-6 w-6 ${index === 0 ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                    item.changeColor === 'text-red-500' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {item.change}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className={`text-3xl font-bold ${index === 0 ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
                  <p className={`text-lg font-medium ${index === 0 ? 'text-white' : 'text-gray-700'}`}>{item.title}</p>
                  <p className={`text-sm ${index === 0 ? 'text-white/80' : 'text-gray-500'}`}>{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Second Row Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total Beban Operasional",
              value: formatCurrency(stats.totalOperationalExpenses),
              change: "-2%",
              changeColor: "text-red-500",
              icon: Building,
              description: "Biaya operasional",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/finance/operational-expenses"
            },
            {
              title: "Total Profit", 
              value: formatCurrency(stats.totalProfit),
              change: "+15%",
              icon: TrendingUp,
              description: "Keuntungan bersih",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/finance/profit-loss"
            },
            {
              title: "Total Member",
              value: stats.totalMembers.toString(),
              change: "+25%",
              icon: Users,
              description: "Pelanggan terdaftar",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/customers"
            },
            {
              title: "Rider Aktif",
              value: stats.activeRiders.toString(),
              change: "0%",
              icon: UserCheck,
              description: "Mobile seller online",
              bgColor: "bg-white",
              textColor: "text-gray-900",
              route: "/riders"
            }
          ].map((item, index) => (
            <Card key={index} className={`${item.bgColor} ${item.textColor} rounded-2xl border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer`} onClick={() => navigate(item.route)}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gray-100">
                    <item.icon className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                    item.changeColor === 'text-red-500' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {item.change}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-gray-900">{item.value}</p>
                  <p className="text-lg font-medium text-gray-700">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Menu Terjual and Jam Terjual Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Terjual - Main Circle Chart */}
          <Card className="bg-white rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/transactions')}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Menu Terjual</CardTitle>
                  <p className="text-sm text-gray-500">Track your product sales</p>
                </div>
                <Select defaultValue="today">
                  <SelectTrigger className="w-20 h-8 text-xs border-gray-200">
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
                    <circle 
                      cx="60" cy="60" r="50" 
                      fill="none" 
                      stroke="#3b82f6" 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50 * 0.7} ${2 * Math.PI * 50}`}
                      className="transition-all duration-1000"
                    />
                    <circle 
                      cx="60" cy="60" r="40" 
                      fill="none" 
                      stroke="#ef4444" 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40 * 0.4} ${2 * Math.PI * 40}`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold text-gray-900">9.829</div>
                    <div className="text-sm text-gray-500">Products Sales</div>
                    <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full mt-1">+5,34%</div>
                  </div>
                </div>
              </div>

              {/* Category List */}
              <div className="space-y-3">
                {productSales.slice(0, 3).map((product, index) => {
                  const icons = ['💻', '🎮', '🪑'];
                  const colors = ['text-gray-700', 'text-blue-600', 'text-green-600'];
                  const changes = ['+1,5%', '+2,3%', '-1,04%'];
                  const changeColors = ['text-green-600', 'text-green-600', 'text-red-600'];
                  
                  return (
                    <div key={product.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${colors[index]}`}>{icons[index]}</span>
                        <span className="font-medium text-gray-700">{product.name.substring(0, 10)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{product.quantity}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          index === 2 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {changes[index]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Jam Terjual - Sales by Hour Style */}
          <Card className="bg-white rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/transactions')}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Jam Terjual</CardTitle>
                  <p className="text-sm text-gray-500">Track your sales by hour</p>
                </div>
                <Select defaultValue="thisyear">
                  <SelectTrigger className="w-24 h-8 text-xs border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisyear">This year</SelectItem>
                    <SelectItem value="lastmonth">Last month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Legend */}
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  <span className="text-sm text-gray-500">Seen product</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-500">Sales</span>
                </div>
              </div>

              {/* Tooltip Display */}
              <div className="bg-gray-900 text-white p-3 rounded-xl mb-4 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span>43.787 Products</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span>39.784 Products</span>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData.slice(0, 7)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    />
                    <YAxis hide />
                    <Bar 
                      dataKey="value" 
                      fill="#3b82f6" 
                      radius={4}
                      background={{ fill: '#e5e7eb' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Performa Rider - Smaller Card */}
          <Card className="bg-white rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/riders')}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">Performa Rider</CardTitle>
              <p className="text-sm text-gray-500">Track rider performance</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {riderExpenses.slice(0, 4).map((rider, index) => (
                  <div key={rider.rider_name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-red-600">
                          {rider.rider_name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{rider.rider_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(rider.total_expenses)}
                      </div>
                      <div className="text-xs text-gray-500">expenses</div>
                    </div>
                  </div>
                ))}
                {riderExpenses.length === 0 && (
                  <p className="text-center text-gray-500 py-4 text-sm">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Rider Performance */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rider Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riderPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="rider" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'sales' ? formatCurrency(Number(value)) : value,
                    name === 'sales' ? 'Sales' : 'Orders'
                  ]}
                />
                <defs>
                  <linearGradient id="riderRedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`hsl(var(--primary))`} />
                    <stop offset="100%" stopColor={`hsl(var(--primary-dark))`} />
                  </linearGradient>
                </defs>
                <Bar dataKey="sales" fill="url(#riderRedGradient)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {riderPerformanceData.map((r) => (
                <div key={r.rider} className="text-center">
                  <div className="font-medium text-sm">{r.rider}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(r.sales)}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operational Expenses by Rider */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Total Beban Operasional ({startDate} - {endDate})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {riderExpenses.map((expense, index) => (
              <div key={expense.rider_name} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="font-medium">{expense.rider_name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-red-600">{formatCurrency(expense.total_expenses)}</div>
                </div>
              </div>
            ))}
            {riderExpenses.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Belum ada data beban operasional</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Performance - Horizontal layout */}
      <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales Report Chart */}
        <Card className="stat-card cursor-pointer" onClick={() => handleCardClick('sales')}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Sales Report</CardTitle>
              <p className="text-sm text-muted-foreground">
                {startDate && endDate ? `Sales ${startDate} - ${endDate}` : 'Monthly sales performance'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  angle={startDate && endDate ? -45 : 0}
                  textAnchor={startDate && endDate ? "end" : "middle"}
                  height={startDate && endDate ? 80 : 60}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value)), 'Sales']}
                  labelStyle={{ color: '#374151', fontWeight: 'medium' }}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#DC2626" 
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                  dot={false}
                  activeDot={{ r: 6, stroke: '#DC2626', strokeWidth: 2, fill: 'white' }}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#DC2626" 
                  fillOpacity={0.4} 
                  radius={[2, 2, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top & Worst Selling Products */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Product Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Top 5 Selling */}
              <div>
                <h4 className="font-semibold text-green-600 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Top 5 Selling Products
                </h4>
                <div className="space-y-2">
                  {productSales.slice(0, 5).map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-green-600">{product.value}%</div>
                        <div className="text-xs text-gray-500">{product.quantity} sold</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worst 5 Selling */}
              <div>
                <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Worst 5 Selling Products
                </h4>
                <div className="space-y-2">
                  {productSales.slice(-5).reverse().map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-red-600">{product.value}%</div>
                        <div className="text-xs text-gray-500">{product.quantity} sold</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Rider Status with Stock Performance */}
      <Card className="dashboard-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Live Rider Status</CardTitle>
            <p className="text-sm text-muted-foreground">Sales vs Stock Performance</p>
          </div>
          <Button onClick={() => navigate('/riders')} className="bg-primary hover:bg-primary-dark">
            View All Riders
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {riderStockData.slice(0, 6).map((rider) => {
              const stockPercentage = rider.initial_stock > 0 ? Math.round((rider.remaining / rider.initial_stock) * 100) : 0;
              const soldPercentage = rider.initial_stock > 0 ? Math.round((rider.sold / rider.initial_stock) * 100) : 0;
              
              return (
                <div key={rider.rider_name} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${stockPercentage > 50 ? 'bg-green-500' : stockPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    <p className="font-medium text-sm">{rider.rider_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">
                      Stok: {rider.remaining}/{rider.initial_stock} ({stockPercentage}%)
                    </p>
                    <p className="text-xs text-gray-600">
                      Terjual: {soldPercentage}% ({rider.sold} item)
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${stockPercentage > 50 ? 'bg-green-500' : stockPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                        style={{ width: `${stockPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
            {riderStockData.length === 0 && (
              <p className="text-center text-muted-foreground py-4 col-span-full">Belum ada data rider</p>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};