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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useAuth } from "@/hooks/useAuth";

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
}

interface DailySalesData {
  date: string;
  rider_name: string;
  rider_code: string;
  transactions: number;
  total_sales: number;
}

const RiderPerformance = () => {
  const { userProfile } = useAuth();
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
    if (riders.length > 0) {
      fetchPerformanceData();
    }
  }, [riders, selectedRider, selectedPeriod, customStartDate, customEndDate]);

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'rider')
        .eq('is_active', true)
        .eq('branch_id', userProfile?.branch_id)
        .order('full_name');
      
      if (error) throw error;
      
      // Add rider codes (assuming format like Z-001, Z-002, etc.)
      const ridersWithCodes = data?.map((rider, index) => ({
        ...rider,
        code: `Z-${String(index + 1).padStart(3, '0')}`
      })) || [];
      
      setRiders(ridersWithCodes);
    } catch (error) {
      console.error('Error fetching riders:', error);
      toast.error('Gagal memuat data rider');
    }
  };

  const getDateRange = () => {
    const today = new Date();
    const jakartaNow = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    
    switch (selectedPeriod) {
      case "today":
        const todayStr = jakartaNow.toISOString().split('T')[0];
        return { startDate: todayStr, endDate: todayStr };
      
      case "weekly":
        const weekStart = new Date(jakartaNow);
        weekStart.setDate(jakartaNow.getDate() - jakartaNow.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { 
          startDate: weekStart.toISOString().split('T')[0], 
          endDate: weekEnd.toISOString().split('T')[0] 
        };
      
      case "monthly":
        const monthStart = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 1);
        const monthEnd = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() + 1, 0);
        return { 
          startDate: monthStart.toISOString().split('T')[0], 
          endDate: monthEnd.toISOString().split('T')[0] 
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
        // Fetch transactions for this rider in the date range
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('final_amount, transaction_date, status')
          .eq('rider_id', rider.id)
          .eq('status', 'completed')
          .gte('transaction_date', `${startDate}T00:00:00`)
          .lte('transaction_date', `${endDate}T23:59:59`)
          .order('transaction_date', { ascending: true });

        if (error) {
          console.error('Error fetching transactions for rider:', rider.id, error);
          continue;
        }

        const totalTransactions = transactions?.length || 0;
        const totalSales = transactions?.reduce((sum, t) => sum + parseFloat(t.final_amount.toString()), 0) || 0;

        performanceResults.push({
          rider_id: rider.id,
          rider_name: rider.full_name,
          rider_code: rider.code || `Z-${rider.id.slice(-3)}`,
          total_transactions: totalTransactions,
          total_sales: totalSales
        });

        // Group by date for daily sales data
        const dailyGroups: { [date: string]: { transactions: number; sales: number } } = {};
        
        transactions?.forEach(transaction => {
          const date = transaction.transaction_date.split('T')[0];
          if (!dailyGroups[date]) {
            dailyGroups[date] = { transactions: 0, sales: 0 };
          }
          dailyGroups[date].transactions += 1;
          dailyGroups[date].sales += parseFloat(transaction.final_amount.toString());
        });

        Object.entries(dailyGroups).forEach(([date, data]) => {
          dailySalesResults.push({
            date,
            rider_name: rider.full_name,
            rider_code: rider.code || `Z-${rider.id.slice(-3)}`,
            transactions: data.transactions,
            total_sales: data.sales
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Prepare chart data
  const chartData = performanceData.map(rider => ({
    name: rider.rider_name,
    code: rider.rider_code,
    sales: rider.total_sales,
    transactions: rider.total_transactions
  }));

  // Prepare line chart data (sales trend over time)
  const trendData = dailySalesData.reduce((acc, curr) => {
    const existingDate = acc.find(item => item.date === curr.date);
    if (existingDate) {
      existingDate.total_sales += curr.total_sales;
      existingDate.total_transactions += curr.transactions;
    } else {
      acc.push({
        date: curr.date,
        total_sales: curr.total_sales,
        total_transactions: curr.transactions
      });
    }
    return acc;
  }, [] as { date: string; total_sales: number; total_transactions: number }[]);

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
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <div className="space-y-2">
              <Label>Periode</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hari Ini</SelectItem>
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

      {/* Performance Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Grafik Performa All Rider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="horizontal" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "Total Sales"]} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Rank Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Top Rank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">No.</th>
                  <th className="text-left p-2">Nama Rider</th>
                  <th className="text-left p-2">Code</th>
                  <th className="text-left p-2">Transaksi</th>
                  <th className="text-left p-2">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((rider, index) => (
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
                      <Badge variant="outline">{rider.rider_code}</Badge>
                    </td>
                    <td className="p-2">{rider.total_transactions}</td>
                    <td className="p-2 font-semibold text-green-600">
                      {formatCurrency(rider.total_sales)}
                    </td>
                  </tr>
                ))}
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

      {/* Sales Overview Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Sales Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), "Total Sales"]}
                  labelFormatter={(label) => formatDate(label)}
                />
                <Line 
                  type="monotone" 
                  dataKey="total_sales" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sales Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Tgl/Bln/Thn</th>
                  <th className="text-left p-2">Nama Rider</th>
                  <th className="text-left p-2">Kode</th>
                  <th className="text-left p-2">Transaksi</th>
                  <th className="text-left p-2">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {dailySalesData.map((sale, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-2">{formatDate(sale.date)}</td>
                    <td className="p-2">{sale.rider_name}</td>
                    <td className="p-2">
                      <Badge variant="outline">{sale.rider_code}</Badge>
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
              {dailySalesData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-muted/30">
                    <td className="p-2">Total</td>
                    <td className="p-2">-</td>
                    <td className="p-2">-</td>
                    <td className="p-2">
                      {dailySalesData.reduce((sum, sale) => sum + sale.transactions, 0)}
                    </td>
                    <td className="p-2 text-green-600">
                      {formatCurrency(dailySalesData.reduce((sum, sale) => sum + sale.total_sales, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default RiderPerformance;