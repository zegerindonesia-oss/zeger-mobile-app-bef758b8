import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface TransactionData {
  date: string;
  riderName: string;
  productsSold: number;
  totalSales: number;
  totalCKPrice: number;
  totalHPP: number;
  profitCK: number;
}

interface ResumeData {
  dateRange: string;
  riderName: string;
  totalProductsSold: number;
  totalSales: number;
  totalCKPrice: number;
  totalHPP: number;
  totalProfitCK: number;
}

interface PriceChartData {
  product: string;
  ckPrice: number;
  costPrice: number;
  sellingPrice: number;
}

export default function CentralKitchenAnalytics() {
  const { userProfile } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to?: Date } | undefined>();
  const [riders, setRiders] = useState<any[]>([]);
  const [transactionData, setTransactionData] = useState<TransactionData[]>([]);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [chartData, setChartData] = useState<PriceChartData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Central Kitchen Analytics | Zeger ERP";
    fetchRiders();
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [selectedUser, dateFilter, customDateRange, userProfile]);

  const fetchRiders = async () => {
    if (!userProfile) return;

    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .in('role', ['rider', 'bh_rider', 'sb_rider']);

      if (userProfile.role === 'branch_manager') {
        query = query.eq('branch_id', userProfile.branch_id);
      }

      const { data, error } = await query.order('full_name');
      
      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error('Error fetching riders:', error);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    
    switch (dateFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        if (customDateRange?.from && customDateRange?.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const fetchSalesData = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Fetch transactions with rider and transaction items
      let transactionQuery = supabase
        .from('transactions')
        .select(`
          id,
          transaction_date,
          final_amount,
          rider_id,
          branch_id,
          profiles!transactions_rider_id_fkey (
            id,
            full_name
          ),
          transaction_items (
            quantity,
            unit_price,
            product_id,
            products (
              id,
              name,
              ck_price,
              cost_price,
              price
            )
          )
        `)
        .gte('transaction_date', start.toISOString())
        .lte('transaction_date', end.toISOString())
        .eq('status', 'completed');

      if (userProfile.role === 'branch_manager') {
        transactionQuery = transactionQuery.eq('branch_id', userProfile.branch_id);
      }

      if (selectedUser !== 'all') {
        transactionQuery = transactionQuery.eq('rider_id', selectedUser);
      }

      const { data: transactions, error: transactionError } = await transactionQuery;
      if (transactionError) throw transactionError;

      if (!transactions || transactions.length === 0) {
        setTransactionData([]);
        setResumeData(null);
        setChartData([]);
        setLoading(false);
        return;
      }

      // Process transaction data
      const transactionArray: TransactionData[] = [];
      const productPriceMap = new Map<string, { ckPrice: number; costPrice: number; sellingPrice: number; count: number }>();
      
      let totalProductsSold = 0;
      let totalSales = 0;
      let totalCKPrice = 0;
      let totalHPP = 0;

      transactions.forEach(transaction => {
        const riderName = transaction.profiles?.full_name || 'Unknown';
        const items = transaction.transaction_items || [];
        
        let txnProductsSold = 0;
        let txnTotalSales = 0;
        let txnTotalCKPrice = 0;
        let txnTotalHPP = 0;

        items.forEach(item => {
          const product = item.products;
          if (!product) return;

          const quantity = item.quantity;
          const ckPrice = Number(product.ck_price || 0);
          const costPrice = Number(product.cost_price || 0);
          const sellingPrice = Number(item.unit_price || product.price || 0);

          txnProductsSold += quantity;
          txnTotalSales += quantity * sellingPrice;
          txnTotalCKPrice += quantity * ckPrice;
          txnTotalHPP += quantity * costPrice;

          // Aggregate for chart
          const existing = productPriceMap.get(product.name) || {
            ckPrice: 0,
            costPrice: 0,
            sellingPrice: 0,
            count: 0
          };
          existing.ckPrice += ckPrice;
          existing.costPrice += costPrice;
          existing.sellingPrice += sellingPrice;
          existing.count += 1;
          productPriceMap.set(product.name, existing);
        });

        const txnProfitCK = txnTotalHPP - txnTotalCKPrice;

        transactionArray.push({
          date: format(new Date(transaction.transaction_date), 'yyyy-MM-dd'),
          riderName,
          productsSold: txnProductsSold,
          totalSales: txnTotalSales,
          totalCKPrice: txnTotalCKPrice,
          totalHPP: txnTotalHPP,
          profitCK: txnProfitCK
        });

        totalProductsSold += txnProductsSold;
        totalSales += txnTotalSales;
        totalCKPrice += txnTotalCKPrice;
        totalHPP += txnTotalHPP;
      });

      // Sort by date
      transactionArray.sort((a, b) => a.date.localeCompare(b.date));
      setTransactionData(transactionArray);

      // Prepare resume data
      const dateRangeText = customDateRange?.from && customDateRange?.to
        ? `${format(customDateRange.from, 'dd/MM/yyyy')} - ${format(customDateRange.to, 'dd/MM/yyyy')}`
        : dateFilter === 'today'
        ? format(new Date(), 'dd/MM/yyyy')
        : dateFilter === 'week'
        ? `${format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd/MM/yyyy')} - ${format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
        : `${format(startOfMonth(new Date()), 'dd/MM/yyyy')} - ${format(endOfMonth(new Date()), 'dd/MM/yyyy')}`;

      const riderNameText = selectedUser === 'all' 
        ? 'Semua Rider' 
        : riders.find(r => r.id === selectedUser)?.full_name || 'Unknown';

      setResumeData({
        dateRange: dateRangeText,
        riderName: riderNameText,
        totalProductsSold,
        totalSales,
        totalCKPrice,
        totalHPP,
        totalProfitCK: totalHPP - totalCKPrice
      });

      // Prepare chart data (average prices per product)
      const chartArray: PriceChartData[] = Array.from(productPriceMap.entries())
        .map(([product, data]) => ({
          product,
          ckPrice: data.ckPrice / data.count,
          costPrice: data.costPrice / data.count,
          sellingPrice: data.sellingPrice / data.count
        }))
        .sort((a, b) => b.sellingPrice - a.sellingPrice)
        .slice(0, 10); // Top 10 products

      setChartData(chartArray);

    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast.error('Gagal memuat data transaksi');
    } finally {
      setLoading(false);
    }
  };

  const totals = transactionData.reduce((acc, row) => ({
    productsSold: acc.productsSold + row.productsSold,
    totalSales: acc.totalSales + row.totalSales,
    totalCKPrice: acc.totalCKPrice + row.totalCKPrice,
    totalHPP: acc.totalHPP + row.totalHPP,
    profitCK: acc.profitCK + row.profitCK
  }), { productsSold: 0, totalSales: 0, totalCKPrice: 0, totalHPP: 0, profitCK: 0 });

  const averages = transactionData.length > 0 ? {
    avgProductsSold: totals.productsSold / transactionData.length,
    avgSales: totals.totalSales / transactionData.length,
    avgCKPrice: totals.totalCKPrice / transactionData.length,
    avgHPP: totals.totalHPP / transactionData.length,
    avgProfit: totals.profitCK / transactionData.length
  } : { avgProductsSold: 0, avgSales: 0, avgCKPrice: 0, avgHPP: 0, avgProfit: 0 };

  if (!userProfile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Central Kitchen Analytics</h1>
        <p className="text-muted-foreground">Analisis transaksi dan profit central kitchen</p>
      </div>

      {/* Filters */}
      <Card className="p-6 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Rider</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Rider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Rider</SelectItem>
                {riders.map(rider => (
                  <SelectItem key={rider.id} value={rider.id}>
                    {rider.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Periode</label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">Minggu Ini</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === 'custom' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Tanggal Custom</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange?.from ? (
                      customDateRange?.to ? (
                        <>
                          {format(customDateRange.from, "dd/MM/yyyy")} - {format(customDateRange.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(customDateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Pilih tanggal"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">Grafik Harga CK vs HPP vs Harga Jual</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Memuat data...</p>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <XAxis dataKey="product" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip formatter={(value: any) => `Rp ${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="ckPrice" stroke="#22c55e" strokeWidth={2} name="Harga CK" />
              <Line type="monotone" dataKey="costPrice" stroke="#ef4444" strokeWidth={2} name="HPP" />
              <Line type="monotone" dataKey="sellingPrice" stroke="#f97316" strokeWidth={2} name="Harga Jual" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Tidak ada data transaksi</p>
          </div>
        )}
      </Card>

      {/* Resume Analytics Table */}
      {resumeData && (
        <Card className="p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">Resume Analytic Central Kitchen</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama Rider</TableHead>
                  <TableHead className="text-right">Produk Terjual</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Harga CK</TableHead>
                  <TableHead className="text-right">HPP</TableHead>
                  <TableHead className="text-right">Profit CK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{resumeData.dateRange}</TableCell>
                  <TableCell className="font-medium">{resumeData.riderName}</TableCell>
                  <TableCell className="text-right">{resumeData.totalProductsSold.toLocaleString()}</TableCell>
                  <TableCell className="text-right">Rp {resumeData.totalSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">Rp {resumeData.totalCKPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right">Rp {resumeData.totalHPP.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    Rp {resumeData.totalProfitCK.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Transaction Detail Table */}
      <Card className="p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">Transaction Central Kitchen</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Rider</TableHead>
                <TableHead className="text-right">Produk Terjual</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead className="text-right">Harga CK</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Profit CK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : transactionData.length > 0 ? (
                transactionData.map((row, index) => (
                  <TableRow key={`${row.date}-${index}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{format(new Date(row.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{row.riderName}</TableCell>
                    <TableCell className="text-right">{row.productsSold.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rp {row.totalSales.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rp {row.totalCKPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rp {row.totalHPP.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">
                      Rp {row.profitCK.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Tidak ada data transaksi
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {transactionData.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{totals.productsSold.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.totalSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.totalCKPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.totalHPP.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.profitCK.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">Average</TableCell>
                  <TableCell className="text-right font-bold">{Math.round(averages.avgProductsSold).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {Math.round(averages.avgSales).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {Math.round(averages.avgCKPrice).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {Math.round(averages.avgHPP).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {Math.round(averages.avgProfit).toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </Card>
    </div>
  );
}
