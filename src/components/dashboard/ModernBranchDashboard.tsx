import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
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
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [salesFilter, setSalesFilter] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, [selectedUser, salesFilter]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRiders(),
        fetchStats(), 
        fetchSalesChart(),
        fetchProductSales(),
        fetchRiderExpenses(),
        fetchRiderStockData()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Build query based on selected user
      let transactionQuery = supabase
        .from('transactions')
        .select('final_amount, id')
        .eq('status', 'completed')
        .gte('transaction_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('transaction_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

      if (selectedUser !== "all") {
        transactionQuery = transactionQuery.eq('rider_id', selectedUser);
      }

      const { data: salesData, error: salesError } = await transactionQuery;
      if (salesError) throw salesError;

      const totalSales = salesData?.reduce((sum, transaction) => sum + (transaction.final_amount || 0), 0) || 0;
      const totalTransactions = salesData?.length || 0;
      const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      // Fetch operational expenses
      let expenseQuery = supabase
        .from('operational_expenses')
        .select('amount')
        .gte('expense_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('expense_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

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
      // Fetch real sales data for the last 12 months
      const salesByMonth = [];
      const currentDate = new Date();
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthStr = date.toLocaleDateString('en', { month: 'short' });
        const startDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-01`;
        const endDate = `${date.getFullYear()}-${(date.getMonth() + 2).toString().padStart(2, '0')}-01`;

        let query = supabase
          .from('transactions')
          .select('final_amount')
          .eq('status', 'completed')
          .gte('transaction_date', startDate)
          .lt('transaction_date', endDate);

        if (selectedUser !== "all") {
          query = query.eq('rider_id', selectedUser);
        }

        const { data } = await query;
        const monthSales = data?.reduce((sum, t) => sum + (t.final_amount || 0), 0) || 0;
        
        salesByMonth.push({ month: monthStr, sales: monthSales });
      }
      
      setSalesData(salesByMonth);
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

      const { data: expenses, error } = await supabase
        .from('daily_operational_expenses')
        .select(`
          amount,
          rider_id,
          profiles!inner(full_name, branch_id)
        `)
        .eq('profiles.branch_id', profile.branch_id)
        .gte('expense_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Last 30 days

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

  return (
    <div className="space-y-6">
      {/* User Filter */}
      <Card className="dashboard-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by User:</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pilih user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua User</SelectItem>
                {riders.map((rider) => (
                  <SelectItem key={rider.id} value={rider.id}>
                    {rider.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="dashboard-card hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden stat-card"
              onClick={stat.onClick}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gray-100 ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <Badge variant={stat.trend === "up" ? "default" : "destructive"} className={`flex items-center gap-1 ${
                    stat.trend === "up" ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"
                  }`}>
                    {stat.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stat.change}
                  </Badge>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{stat.title}</p>
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sales Report with Filters */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sales Report</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={salesFilter === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSalesFilter('daily')}
            >
              Daily
            </Button>
            <Button
              variant={salesFilter === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSalesFilter('weekly')}
            >
              Weekly
            </Button>
            <Button
              variant={salesFilter === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSalesFilter('monthly')}
            >
              Monthly
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Sales']} />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#e11d48" 
                  fill="url(#salesGradient)" 
                  strokeWidth={2}
                />
                <Bar dataKey="sales" fill="#e11d48" fillOpacity={0.4} />
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Operational Expenses by Rider */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Total Beban Operasional (30 Hari)
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
              <p className="text-sm text-muted-foreground">Monthly sales performance</p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${value / 1000}k`}
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
              </AreaChart>
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
  );
};