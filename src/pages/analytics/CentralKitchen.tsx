import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface ProductionData {
  date: string;
  totalQuantity: number;
  totalCKPrice: number;
  totalHPP: number;
  profitCK: number;
}

interface ChartData {
  product: string;
  quantity: number;
}

export default function CentralKitchenAnalytics() {
  const { userProfile } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to?: Date } | undefined>();
  const [users, setUsers] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Central Kitchen Analytics | Zeger ERP";
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchProductionData();
  }, [selectedUser, dateFilter, customDateRange, userProfile]);

  const fetchUsers = async () => {
    if (!userProfile) return;

    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true);

      if (userProfile.role === 'branch_manager') {
        query = query.eq('branch_id', userProfile.branch_id);
      }

      const { data, error } = await query.order('full_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const fetchProductionData = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Fetch production batches
      let batchQuery = supabase
        .from('production_batches')
        .select('id, produced_at, created_by, branch_id')
        .gte('produced_at', start.toISOString())
        .lte('produced_at', end.toISOString());

      if (userProfile.role === 'branch_manager') {
        batchQuery = batchQuery.eq('branch_id', userProfile.branch_id);
      }

      if (selectedUser !== 'all') {
        batchQuery = batchQuery.eq('created_by', selectedUser);
      }

      const { data: batches, error: batchError } = await batchQuery;
      if (batchError) throw batchError;

      if (!batches || batches.length === 0) {
        setProductionData([]);
        setChartData([]);
        setLoading(false);
        return;
      }

      const batchIds = batches.map(b => b.id);

      // Fetch production items
      const { data: items, error: itemsError } = await supabase
        .from('production_items')
        .select('batch_id, product_id, quantity')
        .in('batch_id', batchIds);

      if (itemsError) throw itemsError;

      // Fetch products
      const productIds = [...new Set(items?.map(i => i.product_id) || [])];
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, cost_price, ck_price')
        .in('id', productIds);

      if (productsError) throw productsError;

      // Create product map
      const productMap = new Map(products?.map(p => [p.id, p]) || []);

      // Aggregate data by date
      const dataByDate = new Map<string, ProductionData>();
      const productQuantities = new Map<string, number>();

      batches.forEach(batch => {
        const dateKey = format(new Date(batch.produced_at), 'yyyy-MM-dd');
        
        const batchItems = items?.filter(i => i.batch_id === batch.id) || [];
        
        batchItems.forEach(item => {
          const product = productMap.get(item.product_id);
          if (!product) return;

          const ckPrice = Number(product.ck_price || 0);
          const costPrice = Number(product.cost_price || 0);
          
          const totalCK = item.quantity * ckPrice;
          const totalHPP = item.quantity * costPrice;

          // Aggregate by date
          const existing = dataByDate.get(dateKey) || {
            date: dateKey,
            totalQuantity: 0,
            totalCKPrice: 0,
            totalHPP: 0,
            profitCK: 0
          };

          existing.totalQuantity += item.quantity;
          existing.totalCKPrice += totalCK;
          existing.totalHPP += totalHPP;
          existing.profitCK = existing.totalHPP - existing.totalCKPrice;

          dataByDate.set(dateKey, existing);

          // Aggregate by product for chart
          const currentQty = productQuantities.get(product.name) || 0;
          productQuantities.set(product.name, currentQty + item.quantity);
        });
      });

      // Convert to array and sort
      const productionArray = Array.from(dataByDate.values()).sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      setProductionData(productionArray);

      // Prepare chart data
      const chartArray = Array.from(productQuantities.entries())
        .map(([product, quantity]) => ({ product, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10); // Top 10 products

      setChartData(chartArray);

    } catch (error) {
      console.error('Error fetching production data:', error);
      toast.error('Gagal memuat data produksi');
    } finally {
      setLoading(false);
    }
  };

  const totals = productionData.reduce((acc, row) => ({
    totalQuantity: acc.totalQuantity + row.totalQuantity,
    totalCKPrice: acc.totalCKPrice + row.totalCKPrice,
    totalHPP: acc.totalHPP + row.totalHPP,
    profitCK: acc.profitCK + row.profitCK
  }), { totalQuantity: 0, totalCKPrice: 0, totalHPP: 0, profitCK: 0 });

  const averages = productionData.length > 0 ? {
    avgQuantity: totals.totalQuantity / productionData.length,
    avgCKPrice: totals.totalCKPrice / productionData.length,
    avgHPP: totals.totalHPP / productionData.length,
    avgProfit: totals.profitCK / productionData.length
  } : { avgQuantity: 0, avgCKPrice: 0, avgHPP: 0, avgProfit: 0 };

  if (!userProfile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Central Kitchen Analytics</h1>
        <p className="text-muted-foreground">Analisis produksi dan profit central kitchen</p>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">User</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua User</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
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
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Grafik Produksi Stok</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Memuat data...</p>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="product" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Jumlah Produksi" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Tidak ada data produksi</p>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Riwayat Produksi Central Kitchen</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Harga CK</TableHead>
                <TableHead className="text-right">Harga HPP</TableHead>
                <TableHead className="text-right">Profit CK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : productionData.length > 0 ? (
                productionData.map((row, index) => (
                  <TableRow key={row.date}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{format(new Date(row.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">{row.totalQuantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rp {row.totalCKPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rp {row.totalHPP.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">
                      Rp {row.profitCK.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Tidak ada data produksi
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {productionData.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{totals.totalQuantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.totalCKPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.totalHPP.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">Rp {totals.profitCK.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Average</TableCell>
                  <TableCell className="text-right font-bold">{Math.round(averages.avgQuantity).toLocaleString()}</TableCell>
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
