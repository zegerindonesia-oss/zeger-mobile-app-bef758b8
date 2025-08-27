import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  Plus,
  FileText,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface DashboardStats {
  totalSales: number;
  totalPurchases: number;
  totalPaid: number;
  profit: number;
  salesTrendPercentage: number;
  purchasesTrendPercentage: number;
  paidTrendPercentage: number;
  profitTrendPercentage: number;
}

interface SalesData {
  month: string;
  sales: number;
}

interface ProductSales {
  name: string;
  value: number;
  percentage: number;
}

interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  price: number;
  category: string;
  is_active: boolean;
}

const COLORS = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

export const BranchDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalPurchases: 0,
    totalPaid: 0,
    profit: 0,
    salesTrendPercentage: 0,
    purchasesTrendPercentage: 0,
    paidTrendPercentage: 0,
    profitTrendPercentage: 0
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error: any) {
      toast.error("Gagal memuat data dashboard: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    // Fetch current month stats
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Total Sales
    const { data: salesData } = await supabase
      .from('transactions')
      .select('final_amount')
      .gte('transaction_date', startOfMonth.toISOString())
      .lte('transaction_date', endOfMonth.toISOString());

    const totalSales = salesData?.reduce((sum, t) => sum + (t.final_amount || 0), 0) || 0;

    // Total Expenses (as purchases proxy)
    const { data: expensesData } = await supabase
      .from('operational_expenses')
      .select('amount')
      .gte('expense_date', startOfMonth.toISOString().split('T')[0])
      .lte('expense_date', endOfMonth.toISOString().split('T')[0]);

    const totalPurchases = expensesData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    // Total Paid (verified transactions)
    const { data: paidData } = await supabase
      .from('transactions')
      .select('final_amount')
      .eq('payment_verified', true)
      .gte('transaction_date', startOfMonth.toISOString())
      .lte('transaction_date', endOfMonth.toISOString());

    const totalPaid = paidData?.reduce((sum, t) => sum + (t.final_amount || 0), 0) || 0;

    const profit = totalSales - totalPurchases;

    setStats({
      totalSales,
      totalPurchases,
      totalPaid,
      profit,
      salesTrendPercentage: Math.random() * 20 + 5, // Mock data
      purchasesTrendPercentage: Math.random() * 10 + 5,
      paidTrendPercentage: Math.random() * 15 + 5,
      profitTrendPercentage: Math.random() * 25 + 10
    });
  };

  const fetchSalesChart = async () => {
    // Mock monthly sales data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mockData = months.map(month => ({
      month,
      sales: Math.floor(Math.random() * 50000) + 20000
    }));
    setSalesData(mockData);
  };

  const fetchProductSales = async () => {
    // Mock product sales data
    const mockProducts = [
      { name: 'Americano', value: 40, percentage: 40 },
      { name: 'Cappuccino', value: 30, percentage: 30 },
      { name: 'Latte', value: 20, percentage: 20 },
      { name: 'Mocha', value: 10, percentage: 10 }
    ];
    setProductSales(mockProducts);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .limit(5);

    if (error) throw error;
    setProducts(data || []);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-dashboard min-h-screen">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-success mr-1" />
                  <span className="text-sm text-success">{stats.salesTrendPercentage.toFixed(1)}% increase from last month</span>
                </div>
              </div>
              <div className="p-3 bg-warning/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Purchases</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalPurchases)}</p>
                <div className="flex items-center mt-2">
                  <TrendingDown className="h-4 w-4 text-destructive mr-1" />
                  <span className="text-sm text-destructive">{stats.purchasesTrendPercentage.toFixed(1)}% decrease from last month</span>
                </div>
              </div>
              <div className="p-3 bg-info/10 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalPaid)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-success mr-1" />
                  <span className="text-sm text-success">{stats.paidTrendPercentage.toFixed(1)}% increase from last month</span>
                </div>
              </div>
              <div className="p-3 bg-success/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profit</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.profit)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-success mr-1" />
                  <span className="text-sm text-success">{stats.profitTrendPercentage.toFixed(1)}% increase from last month</span>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Report Chart */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Sales Report</span>
              <select className="bg-background border rounded px-3 py-1 text-sm">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Sales']} />
                  <Line type="monotone" dataKey="sales" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Most Sales Pie Chart */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Most Sales</span>
              <select className="bg-background border rounded px-3 py-1 text-sm">
                <option value="this-month">This Month</option>
                <option value="this-week">This Week</option>
                <option value="today">Today</option>
              </select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="h-64 w-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={productSales}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {productSales.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="ml-6 space-y-2">
                {productSales.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{item.name} {item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Sales Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Product Sales</span>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Product Name</th>
                  <th className="text-left py-3 px-4">Product ID</th>
                  <th className="text-left py-3 px-4">Product Description</th>
                  <th className="text-left py-3 px-4">Product Type</th>
                  <th className="text-left py-3 px-4">Price</th>
                  <th className="text-left py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{product.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">#{product.code}</td>
                    <td className="py-3 px-4 text-muted-foreground">{product.description || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{product.category || 'General'}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium">{formatCurrency(product.price)}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive">
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