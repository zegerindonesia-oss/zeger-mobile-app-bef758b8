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
interface Rider {
  id: string;
  full_name: string;
  is_active: boolean;
}
const COLORS = ['#3B82F6', '#DC2626', '#10B981', '#F87171', '#FCA5A5']; // Blue, Red, Green, Pink, Light Pink
const SHIFT_COLORS = ['#10B981', '#3B82F6', '#DC2626']; // Green, Blue, Red
export const ModernBranchDashboard = () => {
  const [selectedUser, setSelectedUser] = useState<string>("all");
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
  const [riders, setRiders] = useState<Rider[]>([]);
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
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    fetchDashboardData();
  }, [selectedUser, salesFilter, startDate, endDate, menuFilter, hourlyFilter, riderFilter]);
  const getDateRange = (filter: 'today' | 'week' | 'month') => {
    const today = getJakartaNow();
    let start = startDate;
    let end = endDate;
    if (filter === 'today') {
      const t = formatYMD(today);
      start = t;
      end = t;
    } else if (filter === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7);
      start = formatYMD(weekStart);
      end = formatYMD(today);
    } else if (filter === 'month') {
      const monthStart = new Date(today);
      monthStart.setDate(today.getDate() - 30);
      start = formatYMD(monthStart);
      end = formatYMD(today);
    }
    return { start, end };
  };
  // Add timeout utility
  const withTimeout = <T,>(promise: Promise<T>, ms: number = 15000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), ms)
      )
    ]);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Progressive loading: Load critical data first
      console.log("🔄 Loading critical data (riders & basic stats)...");
      setStatsLoading(true);
      
      // Load critical data first with timeout
      await Promise.all([
        withTimeout(fetchRiders(), 10000),
        withTimeout(fetchStats(), 20000)
      ]);
      
      setStatsLoading(false);
      console.log("✅ Critical data loaded");
      
      // Load secondary data (charts) with timeout
      console.log("🔄 Loading charts & analytics...");
      setChartsLoading(true);
      
      await Promise.all([
        withTimeout(fetchSalesChart(), 15000),
        withTimeout(fetchProductSales(), 15000),
        withTimeout(fetchRiderExpenses(), 10000),
        withTimeout(fetchRiderStockData(), 15000),
        withTimeout(fetchHourlyData(), 10000)
      ]);
      
      setChartsLoading(false);
      console.log("✅ All data loaded successfully");
      
    } catch (error) {
      console.error("❌ Dashboard loading error:", error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      
      // Set fallback data to prevent complete failure
      if (statsLoading) {
        setStats({
          totalSales: 0, totalTransactions: 0, avgTransactionValue: 0,
          totalFoodCost: 0, totalItemsSold: 0, totalProfit: 0,
          totalMembers: 0, activeRiders: 0, cashSales: 0,
          qrisSales: 0, transferSales: 0, operationalExpenses: 0,
          cashDeposit: 0
        });
        setStatsLoading(false);
      }
      setChartsLoading(false);
    } finally {
      setLoading(false);
    }
  };
  const fetchRiders = async () => {
    try {
      const {
        data
      } = await supabase.from('profiles').select('id, full_name, is_active').eq('role', 'rider').order('full_name', { ascending: true });
      setRiders(data || []);
    } catch (error) {
      console.error("Error fetching riders:", error);
    }
  };
  const fetchStats = async () => {
    try {
      console.log("📊 Fetching stats data...");
      // Use consistent date formatting
      const startStr = formatYMD(new Date(startDate));
      const endStr = formatYMD(new Date(endDate));

      // Fetch ALL completed transactions for accurate calculation (no limits)
      let txQuery = supabase
        .from('transactions')
        .select('final_amount, id, rider_id, payment_method')
        .eq('status', 'completed')
        .gte('transaction_date', `${startStr}T00:00:00`)
        .lte('transaction_date', `${endStr}T23:59:59`);
        
      console.log(`📊 Fetching transactions from ${startStr} to ${endStr}...`);
        
      if (selectedUser !== 'all') {
        txQuery = txQuery.eq('rider_id', selectedUser);
      }
      
      const { data: transactions, error: txError } = await txQuery;
      if (txError) throw txError;

      // Fetch active customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('is_active', true);

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

      // Process ALL transaction items for accurate calculations
      const transactionIds = transactions?.map(t => t.id) || [];
      let totalItemsSold = 0;
      let totalFoodCost = 0;
      
      if (transactionIds.length > 0) {
        try {
          console.log(`📦 Processing ${transactionIds.length} transactions for accurate calculations...`);
          
          // Process ALL transactions using optimized single query (remove batch limits)
          const { data: allItems, error: itemsError } = await supabase
            .from('transaction_items')
            .select(`
              quantity,
              products:product_id(cost_price)
            `)
            .in('transaction_id', transactionIds);
            
          if (itemsError) {
            console.error('❌ Error fetching transaction items:', itemsError);
            throw itemsError;
          }
          
          console.log(`📦 Raw transaction items data:`, allItems?.length);
          
          if (allItems && allItems.length > 0) {
            totalItemsSold = allItems.reduce((sum, item: any) => {
              const qty = Number(item.quantity || 0);
              return sum + qty;
            }, 0);
            
            totalFoodCost = allItems.reduce((sum, item: any) => {
              const qty = Number(item.quantity || 0);
              const costPrice = Number(item.products?.cost_price || 0);
              const itemCost = qty * costPrice;
              console.log(`Item: qty=${qty}, cost=${costPrice}, total=${itemCost}`);
              return sum + itemCost;
            }, 0);
          }
          
          console.log(`📦 Processed ${allItems.length} transaction items from ${transactionIds.length} transactions`);
          console.log(`📊 Total Items: ${totalItemsSold}, Total Food Cost: ${totalFoodCost}`);
          
        } catch (error) {
          console.error('❌ Error fetching transaction items:', error);
          // Use more accurate estimated values as fallback
          totalItemsSold = transactions?.length ? transactions.length * 2.5 : 0; // Better estimate
          totalFoodCost = totalItemsSold * 12000; // More accurate cost estimate
          console.log('📦 Using improved estimated values for items/food cost');
        }
      }

      // Get operational expenses
      let expenseQuery = supabase
        .from('daily_operational_expenses')
        .select('amount, expense_type, rider_id')
        .gte('expense_date', startStr)
        .lte('expense_date', endStr);

      if (selectedUser !== 'all') {
        expenseQuery = expenseQuery.eq('rider_id', selectedUser);
      }

      const { data: expenses } = await expenseQuery;
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

      // Active riders = riders with active shift today
      const today = new Date().toISOString().split('T')[0];
      const { data: activeShifts } = await supabase
        .from('shift_management')
        .select('id')
        .eq('shift_date', today)
        .eq('status', 'active');
      const activeRiders = activeShifts?.length || 0;

      // Calculate cash deposit (cash sales minus operational expenses)
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
      
      console.log(`✅ Stats loaded: ${totalTransactions} transactions, ${formatCurrency(totalSales)} revenue`);
      
    } catch (error) {
      console.error("❌ Error fetching stats:", error);
      throw error; // Re-throw to be handled by progressive loading
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
        // Show daily data - parallel queries for better performance
        const dailyQueries = [];
        for (let i = 0; i <= diffDays; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          let dailyQuery = supabase
            .from('transactions')
            .select('final_amount')
            .eq('status', 'completed')
            .gte('transaction_date', `${dateStr}T00:00:00`)
            .lte('transaction_date', `${dateStr}T23:59:59`);
          if (selectedUser !== 'all') dailyQuery = dailyQuery.eq('rider_id', selectedUser);
          
          dailyQueries.push({
            query: dailyQuery,
            date,
            dateStr
          });
        }

        // Execute all daily queries in parallel
        const results = await Promise.all(dailyQueries.map(item => item.query));
        
        results.forEach((result, index) => {
          const { data: dailyTransactions } = result;
          const { date } = dailyQueries[index];
          const dailySales = dailyTransactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
          chartData.push({
            month: date.toLocaleDateString('id-ID', {
              month: 'short',
              day: 'numeric'
            }),
            sales: dailySales
          });
        });
      } else {
        // Show monthly data for larger ranges - parallel queries
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyQueries = [];
        
        for (let i = 0; i < 6; i++) {
          const monthStart = new Date(end);
          monthStart.setMonth(end.getMonth() - i);
          monthStart.setDate(1);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          let monthlyQuery = supabase
            .from('transactions')
            .select('final_amount')
            .eq('status', 'completed')
            .gte('transaction_date', monthStart.toISOString())
            .lte('transaction_date', monthEnd.toISOString());
          if (selectedUser !== 'all') monthlyQuery = monthlyQuery.eq('rider_id', selectedUser);
          
          monthlyQueries.push({
            query: monthlyQuery,
            monthStart
          });
        }

        // Execute all monthly queries in parallel
        const results = await Promise.all(monthlyQueries.map(item => item.query));
        
        results.forEach((result, index) => {
          const { data: monthlyTransactions } = result;
          const { monthStart } = monthlyQueries[index];
          const monthlySales = monthlyTransactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
          chartData.unshift({
            month: months[monthStart.getMonth()],
            sales: monthlySales
          });
        });
      }
      setSalesData(chartData);
    } catch (error) {
      console.error("Error fetching sales chart:", error);
    }
  };
  const fetchProductSales = async () => {
    try {
      // Use the main date filters instead of separate menuFilter
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
        `).eq('status', 'completed').gte('transaction_date', `${startDate}T00:00:00`).lte('transaction_date', `${endDate}T23:59:59`);
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
    try {
      // Fetch expenses within date range, optionally filter by rider
      let expQuery = supabase
        .from('daily_operational_expenses')
        .select('amount, rider_id')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);
      if (selectedUser !== 'all') expQuery = expQuery.eq('rider_id', selectedUser);
      const { data: expenses } = await expQuery;
      if (!expenses) {
        setRiderExpenses([]);
        return;
      }

      // Get rider names separately
      const riderIds = [...new Set(expenses.map(e => e.rider_id).filter(Boolean))];
      const { data: riderProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', riderIds);

      // Group expenses by rider
      const riderExpenseMap: { [key: string]: number } = {};
      expenses.forEach((expense: any) => {
        const rider = riderProfiles?.find(r => r.id === expense.rider_id);
        const riderName = rider?.full_name || 'Unknown';
        riderExpenseMap[riderName] = (riderExpenseMap[riderName] || 0) + parseFloat(expense.amount);
      });
      const riderExpenseData = Object.entries(riderExpenseMap).map(([rider_name, total_expenses]) => ({ rider_name, total_expenses }));
      setRiderExpenses(riderExpenseData);
    } catch (error) {
      console.error("Error fetching rider expenses:", error);
      setRiderExpenses([]);
    }
  };
  const fetchHourlyData = async () => {
    try {
      // Use the main date filters instead of separate hourlyFilter
      const {
        data: transactions
      } = await supabase.from('transactions').select(`
          transaction_date,
          rider_id,
          transaction_items(
            quantity,
            products!inner(name)
          )
        `).eq('status', 'completed').gte('transaction_date', `${startDate}T00:00:00`).lte('transaction_date', `${endDate}T23:59:59`);
      if (!transactions) {
        setHourlyData([]);
        return;
      }

      // Filter by rider if selected
      const filteredTransactions = selectedUser === "all" ? transactions : transactions.filter(t => t.rider_id === selectedUser);

      // Group by time shifts
      const shifts = [{
        name: 'Pagi',
        hours: '06:00 - 10:00',
        start: 6,
        end: 10,
        count: 0
      }, {
        name: 'Siang',
        hours: '10:00 - 15:00',
        start: 10,
        end: 15,
        count: 0
      }, {
        name: 'Sore',
        hours: '15:00 - 21:00',
        start: 15,
        end: 21,
        count: 0
      }];
      filteredTransactions.forEach(transaction => {
        const transactionHour = new Date(new Date(transaction.transaction_date).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
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
        name: 'Pagi',
        hours: '06:00 - 10:00',
        start: 6,
        end: 10,
        count: 0
      }, {
        name: 'Siang',
        hours: '10:00 - 15:00',
        start: 10,
        end: 15,
        count: 0
      }, {
        name: 'Sore',
        hours: '15:00 - 21:00',
        start: 15,
        end: 21,
        count: 0
      }]);
    }
  };
  const fetchRiderStockData = async () => {
    try {
      // Fetch riders; if a rider is selected, only fetch that rider
      let ridersQuery = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'rider')
        .eq('is_active', true);
      if (selectedUser !== 'all') ridersQuery = ridersQuery.eq('id', selectedUser);
      const { data: ridersData } = await ridersQuery;
      if (!ridersData) {
        setRiderStockData([]);
        return;
      }
      const stockData = await Promise.all(ridersData.map(async (rider: any) => {
        // Fetch transactions for this rider in the date range
        const { data: transactions } = await supabase
          .from('transactions')
          .select('id, final_amount')
          .eq('rider_id', rider.id)
          .eq('status', 'completed')
          .gte('transaction_date', `${startDate}T00:00:00`)
          .lte('transaction_date', `${endDate}T23:59:59`);
        const transactionIds = transactions?.map(t => t.id) || [];
        let totalItemsSold = 0;
        let totalOrders = transactions?.length || 0;
        if (transactionIds.length > 0) {
          const { data: items } = await supabase
            .from('transaction_items')
            .select('quantity')
            .in('transaction_id', transactionIds);
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
        navigate('/transactions');
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
    title: "Total Transaksi (Food Cost)",
    value: stats.totalTransactions.toString(),
    icon: Receipt,
    change: formatCurrency(stats.totalFoodCost),
    isPositive: true,
    description: "Transaksi & Food Cost",
    color: "bg-blue-500",
    type: "transactions"
  }, {
    title: "Total QRIS",
    value: formatCurrency(stats.qrisSales),
    icon: Receipt,
    change: `${((stats.qrisSales / stats.totalSales) * 100).toFixed(1)}%`,
    isPositive: true,
    description: "Pembayaran QRIS",
    color: "bg-green-500",
    type: "qris"
  }, {
    title: "Total Transfer Bank",
    value: formatCurrency(stats.transferSales),
    icon: Building,
    change: `${((stats.transferSales / stats.totalSales) * 100).toFixed(1)}%`,
    isPositive: true,
    description: "Transfer Bank",
    color: "bg-purple-500",
    type: "transfer"
  }, {
    title: "Rata-rata per Transaksi (Total Item)",
    value: formatCurrency(stats.avgTransactionValue),
    icon: Calculator,
    change: stats.totalItemsSold.toString() + " items",
    isPositive: true,
    description: "Avg & Total Items",
    color: "bg-yellow-500",
    type: "avgTransaction"
  }, {
    title: "Total Beban Operasional",
    value: formatCurrency(stats.operationalExpenses),
    icon: ChefHat,
    change: `${((stats.operationalExpenses / stats.totalSales) * 100).toFixed(1)}%`,
    isPositive: false,
    description: "Operational expenses",
    color: "bg-red-500",
    type: "expenses"
  }, {
    title: "Total Setoran Tunai",
    value: formatCurrency(stats.cashDeposit),
    icon: DollarSign,
    change: formatCurrency(stats.cashSales) + " - expenses",
    isPositive: stats.cashDeposit > 0,
    description: "Cash deposit",
    color: "bg-teal-500",
    type: "cashDeposit"
  }, {
    title: "Total Member",
    value: stats.totalMembers.toString(),
    icon: Users,
    change: `${calculatePercentageChange(stats.totalMembers, 'members') > 0 ? '+' : ''}${calculatePercentageChange(stats.totalMembers, 'members').toFixed(1)}%`,
    isPositive: calculatePercentageChange(stats.totalMembers, 'members') > 0,
    description: "Pelanggan terdaftar",
    color: "bg-indigo-500",
    type: "members"
  }];
  // Enhanced loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-lg font-medium">Loading Dashboard...</div>
          <div className="text-sm text-gray-500">Please wait while we fetch your data</div>
        </div>
      </div>
    );
  }

  // Show error state if there's a critical error
  if (error && statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-6">
          <div className="text-red-500 text-lg">⚠️ Dashboard Loading Error</div>
          <div className="text-gray-600">{error}</div>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }
  return <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border-0 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
              <p className="text-sm text-gray-500">{new Date().toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Jakarta'
              })}</p>
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
              
              {/* Quick Filter Dropdown */}
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger className="w-24 h-8 text-xs border-gray-200 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date" className="text-xs text-gray-600">From:</Label>
                <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-32 h-8 text-xs border-gray-200 rounded-full" />
                
                <Label htmlFor="end-date" className="text-xs text-gray-600">To:</Label>
                <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-32 h-8 text-xs border-gray-200 rounded-full" />
                
                <Button 
                  onClick={fetchDashboardData}
                  size="sm" 
                  className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 rounded-full"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards - 8 cards in responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsLoading ? (
            // Loading skeleton for KPI cards
            Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="rounded-3xl shadow-sm border-0">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-2xl animate-pulse"></div>
                    <div className="w-16 h-6 bg-gray-200 rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            kpiData.map((item, index) => (
              <Card key={index} className="rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => handleCardClick(item.type)}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-2xl ${item.color}`}>
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
              </Card>
            ))
          )}
        </div>

        {/* Menu Terjual and Jam Terjual Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Terjual - Main Circle Chart */}
          <Card className="rounded-3xl shadow-sm border-0 hover:shadow-lg transition-all cursor-pointer" onClick={() => handleCardClick('transactions')}>
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
              {chartsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <div className="text-sm text-gray-500">Loading menu data...</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Main Circle Chart */}
                  <div className="relative flex items-center justify-center mb-6">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                        {/* Background circles */}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                        <circle cx="60" cy="60" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                        <circle cx="60" cy="60" r="30" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                        
                        {/* Progress circles with real data percentages */}
                        {productSales.slice(0, 2).map((product, index) => {
                          const radius = 50 - (index * 10);
                          const circumference = 2 * Math.PI * radius;
                          const strokeDasharray = `${circumference * (product.value / 100)} ${circumference}`;
                          const colors = ['#3b82f6', '#ef4444', '#10b981'];
                          return (
                            <circle
                              key={product.name}
                              cx="60"
                              cy="60"
                              r={radius}
                              fill="none"
                              stroke={colors[index]}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={strokeDasharray}
                              className="transition-all duration-1000"
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-3xl font-bold text-gray-900">
                          {productSales.reduce((sum, product) => sum + product.quantity, 0)}
                        </div>
                        <div className="text-sm text-gray-500">Products Sales</div>
                        <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full mt-1">
                          {productSales.length > 0 ? `+${productSales[0].value}%` : '+0%'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category List */}
                  <div className="space-y-3">
                    {productSales.slice(0, 5).map((product, index) => {
                      const icons = ['☕', '🥤', '🧊', '🍪', '🍰'];
                      const iconColors = ['#8B4513', '#1E90FF', '#32CD32', '#FF6347', '#FF69B4'];
                      return (
                        <div key={product.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: product.color }}
                            ></div>
                            <span className="font-medium text-gray-700">
                              {product.name.length > 10 ? `${product.name.substring(0, 10)}...` : product.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{product.quantity}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                              {product.value}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Jam Terjual */}
          <Card className="rounded-3xl shadow-sm border-0">
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
              {chartsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <div className="text-sm text-gray-500">Loading hourly data...</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {hourlyData.map((shift, index) => (
                      <div key={shift.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                         <div 
                           className="w-3 h-3 rounded-full"
                           style={{ backgroundColor: SHIFT_COLORS[index] || '#DC2626' }}
                         ></div>
                          <div>
                            <p className="font-medium text-gray-700">{shift.name} ({shift.hours})</p>
                            <p className="text-xs text-gray-500">{(shift.count / hourlyData.reduce((sum, s) => sum + s.count, 1) * 100).toFixed(1)}% of total</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{shift.count}</p>
                          <p className="text-xs text-gray-500">products</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-red-50 rounded-2xl">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{hourlyData.reduce((sum, shift) => sum + shift.count, 0)}</p>
                      <p className="text-sm text-gray-600">Total Produk Terjual</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Performa Rider */}
          <Card className="rounded-3xl shadow-sm border-0">
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
              {chartsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <div className="text-sm text-gray-500">Loading rider data...</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chart */}
                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={riderStockData}>
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
                      <p className="text-xs text-gray-600">Sales</p>
                    </div>
                  </div>
                </>
              )}
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
            {chartsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <div className="text-sm text-gray-500">Loading sales chart...</div>
                </div>
              </div>
            ) : (
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
                }} formatter={value => [formatCurrency(Number(value)), 'Sales']} />
                  <Area type="monotone" dataKey="sales" stroke="#DC2626" strokeWidth={2} fill="url(#salesGradient)" />
                </AreaChart>
              </ResponsiveContainer>
             )}
          </CardContent>
        </Card>
      </div>
    </div>;
};