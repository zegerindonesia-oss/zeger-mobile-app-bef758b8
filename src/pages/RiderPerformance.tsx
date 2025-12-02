import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar, TrendingUp, Trophy, BarChart3, Users, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";

interface Rider {
  id: string;
  full_name: string;
  code?: string;
}

interface RiderPerformanceData {
  rider_id: string;
  rider_name: string;
  rider_code: string;
  total_transactions: number;
  total_sales: number;
  total_products_sold: number;
}

interface DailySalesData {
  date: string;
  rider_name: string;
  rider_code: string;
  transactions: number;
  total_sales: number;
  total_products_sold: number;
}

const RiderPerformance = () => {
  const { userProfile } = useAuth();
  const { assignedRiderId, shouldAutoFilter } = useRiderFilter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRider, setSelectedRider] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [performanceData, setPerformanceData] = useState<RiderPerformanceData[]>([]);
  const [dailySalesData, setDailySalesData] = useState<DailySalesData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Performa Rider | Zeger ERP';
    fetchRiders();
  }, []);

  useEffect(() => {
    // Auto-select assigned rider for BH Report users
    if (shouldAutoFilter && assignedRiderId) {
      setSelectedRider(assignedRiderId);
    }
  }, [shouldAutoFilter, assignedRiderId]);

  useEffect(() => {
    if (riders.length > 0) {
      fetchPerformanceData();
    }
  }, [riders, selectedRider, selectedPeriod, customStartDate, customEndDate]);

  const fetchRiders = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, branch_id')
        .in('role', ['rider', 'sb_rider', 'bh_rider'])
        .eq('is_active', true)
        .order('full_name');

      // Always filter by branch for branch managers and non-HO users
      if (userProfile?.branch_id && userProfile?.role === 'branch_manager') {
        query = query.eq('branch_id', userProfile.branch_id);
      } else if (userProfile?.branch_id && !shouldAutoFilter && userProfile?.role !== 'ho_admin') {
        query = query.eq('branch_id', userProfile.branch_id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // For BH Report users, only show assigned rider
      let filteredData = data || [];
      if (shouldAutoFilter && assignedRiderId) {
        filteredData = data?.filter(rider => rider.id === assignedRiderId) || [];
      }
      
      // Add rider codes (assuming format like Z-001, Z-002, etc.)
      const ridersWithCodes = filteredData.map((rider, index) => ({
        ...rider,
        code: `Z-${String(index + 1).padStart(3, '0')}`
      }));
      
      setRiders(ridersWithCodes);
    } catch (error) {
      console.error('Error fetching riders:', error);
      toast.error('Gagal memuat data rider');
    }
  };

  const formatJktYMD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = () => {
    const today = new Date();
    const jakartaNow = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const todayStr = formatJktYMD(jakartaNow);
    
    switch (selectedPeriod) {
      case "today":
        return { startDate: todayStr, endDate: todayStr };
      
      case "yesterday":
        const yesterday = new Date(jakartaNow);
        yesterday.setDate(jakartaNow.getDate() - 1);
        const yesterdayStr = formatJktYMD(yesterday);
        return { startDate: yesterdayStr, endDate: yesterdayStr };
      
      case "weekly":
        const weekStart = new Date(jakartaNow);
        weekStart.setDate(jakartaNow.getDate() - jakartaNow.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { 
          startDate: formatJktYMD(weekStart), 
          endDate: formatJktYMD(weekEnd) 
        };
      
      case "monthly":
        // Get first day of current month in Jakarta timezone
        const monthStart = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 1);
        const monthEnd = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() + 1, 0);
        return { 
          startDate: formatJktYMD(monthStart), 
          endDate: formatJktYMD(monthEnd) 
        };
      
      case "custom":
        return { startDate: customStartDate, endDate: customEndDate };
      
      default:
        return { startDate: todayStr, endDate: todayStr };
    }
  };

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      if (!startDate || !endDate) return;

      // Build rider filter
      let riderFilter = riders;
      if (selectedRider !== "all") {
        riderFilter = riders.filter(r => r.id === selectedRider);
      }

      const performanceResults: RiderPerformanceData[] = [];
      const dailySalesResults: DailySalesData[] = [];

      for (const rider of riderFilter) {
        // Fetch transactions with transaction items for this rider in the date range
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select(`
            final_amount, 
            transaction_date, 
            status,
            transaction_items(quantity)
          `)
          .eq('rider_id', rider.id)
          .eq('status', 'completed')
          .eq('is_voided', false)
          .gte('transaction_date', `${startDate}T00:00:00+07:00`)
          .lte('transaction_date', `${endDate}T23:59:59+07:00`)
          .order('transaction_date', { ascending: true });

        if (error) {
          console.error('Error fetching transactions for rider:', rider.id, error);
          continue;
        }

        const totalTransactions = transactions?.length || 0;
        const totalSales = transactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;
        const totalProductsSold = transactions?.reduce((sum, t) => 
          sum + (t.transaction_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0) || 0;

        performanceResults.push({
          rider_id: rider.id,
          rider_name: rider.full_name,
          rider_code: rider.code || `Z-${rider.id.slice(-3)}`,
          total_transactions: totalTransactions,
          total_sales: totalSales,
          total_products_sold: totalProductsSold
        });

        // Group by date for daily sales data using Jakarta timezone
        const dailyGroups: { [date: string]: { transactions: number; sales: number; products: number } } = {};
        
        transactions?.forEach(transaction => {
          const jakartaDate = new Date(transaction.transaction_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
          if (!dailyGroups[jakartaDate]) {
            dailyGroups[jakartaDate] = { transactions: 0, sales: 0, products: 0 };
          }
          dailyGroups[jakartaDate].transactions += 1;
          dailyGroups[jakartaDate].sales += parseFloat(transaction.final_amount.toString());
          dailyGroups[jakartaDate].products += transaction.transaction_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        });

        Object.entries(dailyGroups).forEach(([date, data]) => {
          dailySalesResults.push({
            date,
            rider_name: rider.full_name,
            rider_code: rider.code || `Z-${rider.id.slice(-3)}`,
            transactions: data.transactions,
            total_sales: data.sales,
            total_products_sold: data.products
          });
        });
      }

      setPerformanceData(performanceResults.sort((a, b) => b.total_sales - a.total_sales));
      setDailySalesData(dailySalesResults.sort((a, b) => a.date.localeCompare(b.date)));
      
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast.error('Gagal memuat data performa rider');
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

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit'
    });
  };

  // Prepare chart data
  const chartData = performanceData.map(rider => ({
    name: rider.rider_name,
    code: rider.rider_code,
    sales: rider.total_sales,
    transactions: rider.total_transactions
  }));

  // Prepare multi-line chart data (each rider gets their own line)
  const generateColors = (count: number) => {
    return Array.from({ length: count }, (_, i) => 
      `hsl(${(i * 360) / count}, 70%, 50%)`
    );
  };

  const uniqueRiders = [...new Set(dailySalesData.map(d => d.rider_name))];
  const riderColors = generateColors(uniqueRiders.length);
  
  // Group data by date with each rider as separate data key
  const trendData = dailySalesData.reduce((acc, curr) => {
    const existingDate = acc.find(item => item.date === curr.date);
    if (existingDate) {
      existingDate[`${curr.rider_name}_sales`] = curr.total_sales;
    } else {
      const dateEntry: any = { date: curr.date };
      dateEntry[`${curr.rider_name}_sales`] = curr.total_sales;
      acc.push(dateEntry);
    }
    return acc;
  }, [] as any[]);

  // Sort by date
  trendData.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Performa Rider
        </h1>
        <p className="text-sm text-muted-foreground">
          Analisis performa penjualan rider dalam periode tertentu
        </p>
      </header>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Hide rider selector for BH Report users */}
            {!shouldAutoFilter && (
              <div className="space-y-2">
                <Label>Rider</Label>
                <Select value={selectedRider} onValueChange={setSelectedRider}>
                  <SelectTrigger>
                    <Users className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Pilih rider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Rider</SelectItem>
                    {riders.map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        {rider.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Periode</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="yesterday">Kemarin</SelectItem>
                  <SelectItem value="weekly">Minggu Ini</SelectItem>
                  <SelectItem value="monthly">Bulan Ini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPeriod === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex items-end">
              <Button onClick={fetchPerformanceData} disabled={loading} className="w-full">
                <Filter className="w-4 h-4 mr-2" />
                {loading ? "Loading..." : "Apply Filter"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Multi-Line Chart */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Grafik Performa All Rider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="date" tickFormatter={formatDateShort} />
                <YAxis tickFormatter={formatCurrencyShort} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name.replace('_sales', '').replace(/_/g, ' ')
                  ]}
                  labelFormatter={(label) => formatDate(label)}
                />
                {uniqueRiders.map((rider, index) => (
                  <Line
                    key={rider}
                    type="monotone"
                    dataKey={`${rider}_sales`}
                    stroke={riderColors[index]}
                    strokeWidth={2}
                    dot={{ fill: riderColors[index] }}
                    name={rider}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Rank Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Top Rank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full bg-white">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">No.</th>
                  <th className="text-left p-2">Nama Rider</th>
                   <th className="text-left p-2">Produk Terjual (Avg/day)</th>
                   <th className="text-left p-2">Transaksi (Avg/day)</th>
                   <th className="text-left p-2">Total Sales (Avg/day)</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                 {performanceData.map((rider, index) => {
                   // Calculate working days based on actual transaction dates (like Sales Summary table)
                   const riderDailySales = dailySalesData.filter(d => d.rider_name === rider.rider_name);
                   const uniqueDates = [...new Set(riderDailySales.map(sale => sale.date))];
                   const workingDays = uniqueDates.length || 1; // Fallback to 1 to avoid division by zero
                   
                   const avgProducts = workingDays > 0 ? rider.total_products_sold / workingDays : 0;
                   const avgTransactions = workingDays > 0 ? rider.total_transactions / workingDays : 0;
                   const avgSales = workingDays > 0 ? rider.total_sales / workingDays : 0;
                  
                  return (
                    <tr key={rider.rider_id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {index + 1}
                          {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                          {index === 1 && <Trophy className="w-4 h-4 text-gray-400" />}
                          {index === 2 && <Trophy className="w-4 h-4 text-orange-500" />}
                        </div>
                      </td>
                      <td className="p-2 font-medium">{rider.rider_name}</td>
                       <td className="p-2">
                         <div className="flex items-center gap-2">
                           <Badge variant="outline">{rider.total_products_sold}</Badge>
                           <div className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                             ({avgProducts.toFixed(1)})
                           </div>
                         </div>
                       </td>
                       <td className="p-2">
                         <div className="flex items-center gap-2">
                           <span>{rider.total_transactions}</span>
                           <div className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                             ({avgTransactions.toFixed(1)})
                           </div>
                         </div>
                       </td>
                       <td className="p-2">
                         <div className="flex items-center gap-2">
                           <span className="font-semibold text-green-600">
                             {formatCurrency(rider.total_sales)}
                           </span>
                           <div className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                             ({formatCurrency(avgSales)})
                           </div>
                         </div>
                       </td>
                    </tr>
                  );
                })}
                {performanceData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      Tidak ada data untuk periode yang dipilih
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sales Overview Area Chart */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Sales Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData.map(item => ({
                date: item.date,
                total_sales: Object.keys(item).filter(key => key.includes('_sales')).reduce((sum, key) => sum + (item[key] || 0), 0)
              }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDateShort}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tickFormatter={formatCurrencyShort}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), "Total Sales"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_sales" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#salesAreaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sales Summary Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Sales Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full bg-white">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Tgl/Bln/Thn</th>
                  <th className="text-left p-2">Nama Rider</th>
                  <th className="text-left p-2">Produk Terjual</th>
                  <th className="text-left p-2">Transaksi</th>
                  <th className="text-left p-2">Total Sales</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {dailySalesData.map((sale, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-2">{new Date(sale.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="p-2">{sale.rider_name}</td>
                    <td className="p-2">
                      <Badge variant="outline">{sale.total_products_sold}</Badge>
                    </td>
                    <td className="p-2">{sale.transactions}</td>
                    <td className="p-2 font-semibold text-green-600">
                      {formatCurrency(sale.total_sales)}
                    </td>
                  </tr>
                ))}
                {dailySalesData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      Tidak ada data untuk periode yang dipilih
                    </td>
                  </tr>
                )}
              </tbody>
              {dailySalesData.length > 0 && (() => {
                // Calculate totals
                const totalProducts = dailySalesData.reduce((sum, sale) => sum + sale.total_products_sold, 0);
                const totalTransactions = dailySalesData.reduce((sum, sale) => sum + sale.transactions, 0);
                const totalSales = dailySalesData.reduce((sum, sale) => sum + sale.total_sales, 0);
                
                // Calculate working days based on unique dates
                const uniqueDates = [...new Set(dailySalesData.map(sale => sale.date))];
                const workingDays = uniqueDates.length;
                
                // Calculate daily averages
                const avgProducts = workingDays > 0 ? (totalProducts / workingDays) : 0;
                const avgTransactions = workingDays > 0 ? (totalTransactions / workingDays) : 0;
                const avgSales = workingDays > 0 ? (totalSales / workingDays) : 0;
                
                return (
                  <tfoot>
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="p-2">Total</td>
                      <td className="p-2">-</td>
                      <td className="p-2">{totalProducts}</td>
                      <td className="p-2">{totalTransactions}</td>
                      <td className="p-2 text-green-600">
                        {formatCurrency(totalSales)}
                      </td>
                    </tr>
                    <tr className="border-t font-medium bg-blue-50">
                      <td className="p-2">
                        <span className="text-blue-600">Average/Hari</span>
                        <div className="text-xs text-muted-foreground">({workingDays} hari kerja)</div>
                      </td>
                      <td className="p-2">-</td>
                      <td className="p-2 text-blue-600">
                        <Badge variant="secondary">{avgProducts.toFixed(2)}</Badge>
                      </td>
                      <td className="p-2 text-blue-600">{avgTransactions.toFixed(2)}</td>
                      <td className="p-2 text-blue-600 font-semibold">
                        {formatCurrency(avgSales)}
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default RiderPerformance;