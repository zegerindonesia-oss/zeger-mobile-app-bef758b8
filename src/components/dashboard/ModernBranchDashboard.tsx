import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  Edit,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface DashboardStats {
  totalSales: number;
  totalPurchases: number;
  totalPaid: number;
  profit: number;
}

interface SalesData {
  month: string;
  sales: number;
}

interface ProductSales {
  name: string;
  value: number;
  color: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  cost_price: number;
  is_active: boolean;
}

const COLORS = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA'];

export const ModernBranchDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalPurchases: 0,
    totalPaid: 0,
    profit: 0
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchSalesChart(),
        fetchProductSales(),
        fetchProducts()
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Fetch current month's sales
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('final_amount')
        .eq('status', 'completed')
        .gte('transaction_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('transaction_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

      if (salesError) throw salesError;

      const totalSales = salesData?.reduce((sum, transaction) => sum + (transaction.final_amount || 0), 0) || 0;

      // For demo purposes, calculate other metrics
      const totalPurchases = totalSales * 0.6; // Assume 60% of sales is purchases
      const totalPaid = totalSales * 0.8; // Assume 80% is paid
      const profit = totalSales - totalPurchases;

      setStats({
        totalSales,
        totalPurchases,
        totalPaid,
        profit
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchSalesChart = async () => {
    // Generate mock data for the last 12 months
    const mockData = [
      { month: 'Jan', sales: 62425 },
      { month: 'Feb', sales: 45000 },
      { month: 'Mar', sales: 58000 },
      { month: 'Apr', sales: 72000 },
      { month: 'May', sales: 68000 },
      { month: 'Jun', sales: 59000 },
      { month: 'Jul', sales: 78000 },
      { month: 'Aug', sales: 65000 },
      { month: 'Sep', sales: 55000 },
      { month: 'Oct', sales: 70000 },
      { month: 'Nov', sales: 62000 },
      { month: 'Dec', sales: 75000 }
    ];
    setSalesData(mockData);
  };

  const fetchProductSales = async () => {
    // Generate mock product sales data
    const mockProductSales = [
      { name: 'Classic Latte', value: 40, color: COLORS[0] },
      { name: 'Americano', value: 30, color: COLORS[1] },
      { name: 'Dolce Latte', value: 15, color: COLORS[2] },
      { name: 'Caramel Latte', value: 10, color: COLORS[3] },
      { name: 'Others', value: 5, color: COLORS[4] }
    ];
    setProductSales(mockProductSales);
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .limit(5);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
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
      change: "+50%",
      trend: "up",
      subtitle: "Increase from last month",
      icon: DollarSign,
      color: "text-primary"
    },
    {
      title: "Total Purchases",
      value: formatCurrency(stats.totalPurchases),
      change: "+30%",
      trend: "up", 
      subtitle: "Decrease from last month",
      icon: ShoppingCart,
      color: "text-blue-600"
    },
    {
      title: "Total Rent",
      value: formatCurrency(stats.totalPaid),
      change: "+15%",
      trend: "up",
      subtitle: "Increase from last month", 
      icon: Package,
      color: "text-purple-600"
    },
    {
      title: "Profits",
      value: formatCurrency(stats.profit),
      change: "+45%",
      trend: "up",
      subtitle: "Increase from last month",
      icon: TrendingUp,
      color: "text-green-600"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="dashboard-card hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gray-100 ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <Badge variant={stat.trend === "up" ? "default" : "destructive"} className="flex items-center gap-1">
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Report Chart */}
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Sales Report</CardTitle>
              <p className="text-sm text-muted-foreground">Monthly sales performance</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Monthly
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Monthly</DropdownMenuItem>
                <DropdownMenuItem>Weekly</DropdownMenuItem>
                <DropdownMenuItem>Daily</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* Most Sales Pie Chart */}
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Most Sales</CardTitle>
              <p className="text-sm text-muted-foreground">Top selling products</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  This Month
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>This Month</DropdownMenuItem>
                <DropdownMenuItem>Last Month</DropdownMenuItem>
                <DropdownMenuItem>This Year</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <ResponsiveContainer width="60%" height={250}>
                <PieChart>
                  <Pie
                    data={productSales}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {productSales.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Sales']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col space-y-2">
                {productSales.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                    <span className="text-sm font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Sales Table */}
      <Card className="dashboard-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Product Sales</CardTitle>
            <p className="text-sm text-muted-foreground">Current product inventory and sales</p>
          </div>
          <Button 
            onClick={() => navigate('/inventory')}
            className="bg-primary hover:bg-primary-dark"
          >
            Add Product
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Product Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Product ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Product Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Product Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{product.name}</td>
                    <td className="py-3 px-4 text-gray-600">#{product.code}</td>
                    <td className="py-3 px-4 text-gray-600">{product.category || 'Coffee Product'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{product.category || 'Beverage'}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{formatCurrency(product.price)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};