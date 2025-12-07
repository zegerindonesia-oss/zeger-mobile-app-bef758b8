import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarIcon, Package, TrendingDown, TrendingUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface Rider {
  id: string;
  full_name: string;
}

interface StockCardItem {
  product_name: string;
  stock_in: number;
  stock_sold: number;
  remaining_stock: number;
  stock_returned: number;
  stock_value: number;
}

export default function StockCardRider() {
  const { userProfile } = useAuth();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRider, setSelectedRider] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [stockCardData, setStockCardData] = useState<StockCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalStockIn: 0,
    totalStockSold: 0,
    totalRemainingStock: 0,
    totalStockReturned: 0
  });

  // Fetch riders based on user role
  useEffect(() => {
    fetchRiders();
  }, [userProfile]);

  const fetchRiders = async () => {
    if (!userProfile) return;

    let query = supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['rider', 'sb_rider', 'bh_rider'])
      .eq('is_active', true);

    // Branch managers and Small Branch managers only see their branch riders
    if (['branch_manager', 'sb_branch_manager', '2_Hub_Branch_Manager', '3_SB_Branch_Manager'].includes(userProfile.role) && userProfile.branch_id) {
      query = query.eq('branch_id', userProfile.branch_id);
    }

    const { data, error } = await query.order('full_name');

    if (error) {
      toast.error('Gagal memuat data rider');
      console.error(error);
      return;
    }

    setRiders(data || []);
    if (data && data.length > 0) {
      setSelectedRider(data[0].id);
    }
  };

  // Get date range based on filter - use Jakarta timezone
  const getDateRange = () => {
    const getJakartaDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Jakarta', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(date);
    
    const today = new Date();
    const jakartaToday = getJakartaDate(today);

    switch (dateFilter) {
      case 'today':
        return { start: jakartaToday, end: jakartaToday };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: getJakartaDate(yesterday), end: getJakartaDate(yesterday) };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        return { start: getJakartaDate(weekStart), end: jakartaToday };
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(monthStart.getDate() - 30);
        return { start: getJakartaDate(monthStart), end: jakartaToday };
      case 'custom':
        if (customDateFrom && customDateTo) {
          return { start: getJakartaDate(customDateFrom), end: getJakartaDate(customDateTo) };
        }
        return { start: jakartaToday, end: jakartaToday };
      default:
        return { start: jakartaToday, end: jakartaToday };
    }
  };

  // Fetch stock card data
  useEffect(() => {
    if (selectedRider) {
      fetchStockCardData();
    }
  }, [selectedRider, dateFilter, customDateFrom, customDateTo]);

  const fetchStockCardData = async () => {
    if (!selectedRider) return;

    setLoading(true);
    const { start, end } = getDateRange();

    try {
      // Fetch stock movements (stock in)
      const { data: stockIn, error: stockInError } = await supabase
        .from('stock_movements')
        .select(`
          created_at,
          quantity,
          movement_type,
          product_id,
          products(name, cost_price)
        `)
        .eq('rider_id', selectedRider)
        .in('movement_type', ['transfer', 'in', 'adjustment'])
        .gte('created_at', `${start}T00:00:00+07:00`)
        .lte('created_at', `${end}T23:59:59+07:00`)
        .order('created_at', { ascending: true });

      if (stockInError) throw stockInError;

      // Fetch transactions (stock sold)
      const { data: transactions, error: transError } = await supabase
        .from('transaction_items')
        .select(`
          transactions!inner(created_at, rider_id, is_voided),
          quantity,
          product_id,
          products(name, cost_price)
        `)
        .eq('transactions.rider_id', selectedRider)
        .eq('transactions.is_voided', false)
        .gte('transactions.created_at', `${start}T00:00:00+07:00`)
        .lte('transactions.created_at', `${end}T23:59:59+07:00`);

      if (transError) throw transError;

      // Fetch current inventory
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('product_id, stock_quantity, products(name, cost_price)')
        .eq('rider_id', selectedRider);

      if (invError) throw invError;

      // Fetch stock returns
      const { data: stockReturns, error: returnError } = await supabase
        .from('stock_movements')
        .select(`
          quantity,
          product_id,
          products(name, cost_price)
        `)
        .eq('rider_id', selectedRider)
        .in('movement_type', ['return', 'out'])
        .gte('created_at', `${start}T00:00:00+07:00`)
        .lte('created_at', `${end}T23:59:59+07:00`);

      if (returnError) throw returnError;

      // Process data by product
      const productMap = new Map<string, StockCardItem>();

      // Process stock in
      stockIn?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown';

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            stock_in: 0,
            stock_sold: 0,
            remaining_stock: 0,
            stock_returned: 0,
            stock_value: 0
          });
        }

        const existing = productMap.get(productId)!;
        existing.stock_in += item.quantity;
        productMap.set(productId, existing);
      });

      // Process stock sold
      transactions?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown';

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            stock_in: 0,
            stock_sold: 0,
            remaining_stock: 0,
            stock_returned: 0,
            stock_value: 0
          });
        }

        const existing = productMap.get(productId)!;
        existing.stock_sold += item.quantity;
        productMap.set(productId, existing);
      });

      // Process stock returned
      stockReturns?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown';

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            stock_in: 0,
            stock_sold: 0,
            remaining_stock: 0,
            stock_returned: 0,
            stock_value: 0
          });
        }

        const existing = productMap.get(productId)!;
        existing.stock_returned += item.quantity;
        productMap.set(productId, existing);
      });

      // Calculate remaining stock and value
      productMap.forEach((item, productId) => {
        // Get cost price from inventory
        const invItem = inventory?.find((inv: any) => inv.product_id === productId);
        const costPrice = invItem?.products?.cost_price || 0;

        // Calculate remaining stock = stock_in - stock_sold
        item.remaining_stock = item.stock_in - item.stock_sold;
        
        // Calculate stock value = remaining_stock * cost_price
        item.stock_value = item.remaining_stock * costPrice;
      });

      const stockCardArray = Array.from(productMap.values())
        .filter(item => item.stock_in > 0 || item.stock_sold > 0 || item.remaining_stock > 0 || item.stock_returned > 0)
        .sort((a, b) => a.product_name.localeCompare(b.product_name));
      setStockCardData(stockCardArray);

      // Calculate summary
      const summary = stockCardArray.reduce(
        (acc, item) => ({
          totalStockIn: acc.totalStockIn + item.stock_in,
          totalStockSold: acc.totalStockSold + item.stock_sold,
          totalRemainingStock: acc.totalRemainingStock + item.remaining_stock,
          totalStockReturned: acc.totalStockReturned + item.stock_returned
        }),
        { totalStockIn: 0, totalStockSold: 0, totalRemainingStock: 0, totalStockReturned: 0 }
      );

      setSummaryData(summary);
    } catch (error: any) {
      console.error('Error fetching stock card:', error);
      toast.error(`Gagal memuat data stock card: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (stockCardData.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const selectedRiderName = riders.find(r => r.id === selectedRider)?.full_name || 'Unknown';
    const { start, end } = getDateRange();

    const worksheet = XLSX.utils.json_to_sheet(
      stockCardData.map((item, index) => ({
        No: index + 1,
        'Nama Menu': item.product_name,
        'Stock Masuk': item.stock_in,
        'Stock Terjual': item.stock_sold,
        'Sisa Stock': item.remaining_stock,
        'Stock Kembali': item.stock_returned,
        'Nilai Stock': new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR'
        }).format(item.stock_value)
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Card');

    XLSX.writeFile(workbook, `Stock_Card_${selectedRiderName}_${start}_${end}.xlsx`);
    toast.success('Data berhasil diekspor ke Excel');
  };

  const totalStockValue = stockCardData.reduce((sum, item) => sum + item.stock_value, 0);
  const avgStockValue = stockCardData.length > 0 ? totalStockValue / stockCardData.length : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Stock Card Rider</h1>
        <p className="text-muted-foreground">Riwayat pergerakan stok rider</p>
      </div>

      {/* Filter Section */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Rider</Label>
            <Select value={selectedRider} onValueChange={setSelectedRider}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih rider" />
              </SelectTrigger>
              <SelectContent>
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
            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="yesterday">Kemarin</SelectItem>
                <SelectItem value="week">Minggu Ini</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>Dari Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customDateFrom && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateFrom ? format(customDateFrom, 'PPP', { locale: idLocale }) : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Sampai Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customDateTo && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateTo ? format(customDateTo, 'PPP', { locale: idLocale }) : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stok Masuk</p>
              <h3 className="text-2xl font-bold">{summaryData.totalStockIn}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stok Terjual</p>
              <h3 className="text-2xl font-bold">{summaryData.totalStockSold}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sisa Stok</p>
              <h3 className="text-2xl font-bold">{summaryData.totalRemainingStock}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stock Kembali</p>
              <h3 className="text-2xl font-bold">{summaryData.totalStockReturned}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Stock Card Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Riwayat Stock Card</h2>
          <Button onClick={handleExportToExcel} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Menu</TableHead>
                <TableHead className="text-right">Stock Masuk</TableHead>
                <TableHead className="text-right">Stock Terjual</TableHead>
                <TableHead className="text-right">Sisa Stock</TableHead>
                <TableHead className="text-right">Stock Kembali</TableHead>
                <TableHead className="text-right">Nilai Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : stockCardData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Tidak ada data untuk periode yang dipilih
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {stockCardData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.stock_in}</TableCell>
                      <TableCell className="text-right">{item.stock_sold}</TableCell>
                      <TableCell className="text-right">{item.remaining_stock}</TableCell>
                      <TableCell className="text-right">{item.stock_returned}</TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR'
                        }).format(item.stock_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{summaryData.totalStockIn}</TableCell>
                    <TableCell className="text-right">{summaryData.totalStockSold}</TableCell>
                    <TableCell className="text-right">{summaryData.totalRemainingStock}</TableCell>
                    <TableCell className="text-right">{summaryData.totalStockReturned}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR'
                      }).format(totalStockValue)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={2}>Rata-rata</TableCell>
                    <TableCell className="text-right font-semibold">
                      {stockCardData.length > 0 ? (summaryData.totalStockIn / stockCardData.length).toFixed(1) : 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {stockCardData.length > 0 ? (summaryData.totalStockSold / stockCardData.length).toFixed(1) : 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {stockCardData.length > 0 ? (summaryData.totalRemainingStock / stockCardData.length).toFixed(1) : 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {stockCardData.length > 0 ? (summaryData.totalStockReturned / stockCardData.length).toFixed(1) : 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR'
                      }).format(avgStockValue)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
