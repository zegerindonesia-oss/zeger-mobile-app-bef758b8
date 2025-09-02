import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Receipt, 
  Calculator, 
  Calendar,
  Download,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products?: { name: string };
}

interface Transaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  final_amount: number;
  status: string;
  payment_method: string;
  customers?: { name: string };
  profiles?: { full_name: string };
  transaction_items?: TransactionItem[];
}

interface Summary {
  totalSales: number;
  totalTransactions: number;
  avgPerTransaction: number;
  totalItemsSold: number;
  totalFoodCost: number;
  cashSales: number;
  nonCashSales: number;
}

interface Rider {
  id: string;
  full_name: string;
}

export const TransactionsEnhanced = () => {
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalSales: 0,
    totalTransactions: 0,
    avgPerTransaction: 0,
    totalItemsSold: 0,
    totalFoodCost: 0,
    cashSales: 0,
    nonCashSales: 0
  });
  
  // Filter states
  const [selectedRider, setSelectedRider] = useState(searchParams.get('rider') || "all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRiders();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [selectedRider, selectedPaymentMethod, startDate, endDate]);

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'rider')
        .eq('is_active', true);

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error("Error fetching riders:", error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          transaction_date,
          final_amount,
          status,
          payment_method,
          customer_id,
          rider_id
        `)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate + 'T23:59:59')
        .order('transaction_date', { ascending: false });

      if (selectedRider !== "all") {
        query = query.eq('rider_id', selectedRider);
      }

      if (selectedPaymentMethod !== "all") {
        query = query.eq('payment_method', selectedPaymentMethod);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch additional data separately to avoid relation issues
      const transactionsWithDetails = await Promise.all((data || []).map(async (transaction) => {
        let customerName = '-';
        let riderName = '-';
        let transactionItems: TransactionItem[] = [];

        if (transaction.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', transaction.customer_id)
            .single();
          customerName = customer?.name || '-';
        }

        if (transaction.rider_id) {
          const { data: rider } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', transaction.rider_id)
            .single();
          riderName = rider?.full_name || '-';
        }

        // Fetch transaction items
        const { data: items } = await supabase
          .from('transaction_items')
          .select(`
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products:product_id (name)
          `)
          .eq('transaction_id', transaction.id);

        if (items) {
          transactionItems = items.map(item => ({
            ...item,
            products: { name: item.products?.name || 'Unknown Product' }
          }));
        }

        return {
          ...transaction,
          customers: { name: customerName },
          profiles: { full_name: riderName },
          transaction_items: transactionItems
        };
      }));

      const filteredData = transactionsWithDetails.filter(transaction => 
        searchTerm === "" || 
        transaction.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      setTransactions(filteredData);

      // Calculate summary
      const totalSales = filteredData.reduce((sum, t) => sum + (t.final_amount || 0), 0);
      const totalTransactions = filteredData.length;
      const avgPerTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      const totalItemsSold = filteredData.reduce((sum, t) => 
        sum + (t.transaction_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
      );

      // Calculate cash vs non-cash sales
      const cashSales = filteredData
        .filter(t => t.payment_method === 'cash')
        .reduce((sum, t) => sum + (t.final_amount || 0), 0);
      const nonCashSales = filteredData
        .filter(t => t.payment_method === 'qris' || t.payment_method === 'transfer')
        .reduce((sum, t) => sum + (t.final_amount || 0), 0);

      // Fetch food costs for the same period and riders
      let foodCostQuery = supabase
        .from('daily_operational_expenses')
        .select('amount, rider_id, expense_date')
        .eq('expense_type', 'food')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (selectedRider !== "all") {
        foodCostQuery = foodCostQuery.eq('rider_id', selectedRider);
      }

      const { data: foodCosts } = await foodCostQuery;
      const totalFoodCost = (foodCosts || []).reduce((sum: number, cost: any) => sum + Number(cost.amount || 0), 0);

      setSummary({
        totalSales,
        totalTransactions,
        avgPerTransaction,
        totalItemsSold,
        totalFoodCost,
        cashSales,
        nonCashSales
      });

    } catch (error) {
      console.error("Error fetching transactions:", error);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleRowExpansion = (transactionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedRows(newExpanded);
  };

  const exportToCSV = () => {
    const headers = ['No. Transaksi', 'Tanggal', 'Pelanggan', 'Rider', 'Jumlah', 'Status', 'Metode Bayar', 'Items'];
    const csvData = transactions.map(t => [
      t.transaction_number,
      formatDate(t.transaction_date),
      t.customers?.name || '-',
      t.profiles?.full_name || '-',
      t.final_amount,
      t.status,
      t.payment_method || '-',
      t.transaction_items?.map(item => `${item.products?.name} (${item.quantity}x ${formatCurrency(item.unit_price)})`).join('; ') || '-'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${startDate}_to_${endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-sm text-muted-foreground">Kelola dan analisis data transaksi</p>
        </div>
        <Button onClick={exportToCSV} className="bg-primary hover:bg-primary-dark">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalSales)}</p>
                <p className="text-xs font-medium text-gray-900">Total Penjualan</p>
                <p className="text-xs text-gray-500">Omset periode ini</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-blue-600">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{summary.totalTransactions}</p>
                <p className="text-xs font-medium text-gray-900">Total Transaksi</p>
                <p className="text-xs text-gray-500">Jumlah transaksi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-purple-600">
                <Calculator className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.avgPerTransaction)}</p>
                <p className="text-xs font-medium text-gray-900">Rata-rata per Transaksi</p>
                <p className="text-xs text-gray-500">Nilai rata-rata</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-green-600">
                <Package className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{summary.totalItemsSold}</p>
                <p className="text-xs font-medium text-gray-900">Total Item Terjual</p>
                <p className="text-xs text-gray-500">Jumlah item terjual</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-red-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalFoodCost)}</p>
                <p className="text-xs font-medium text-gray-900">Biaya Bahan Baku</p>
                <p className="text-xs text-gray-500">Food cost periode ini</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-green-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.cashSales)}</p>
                <p className="text-xs font-medium text-gray-900">Penjualan Tunai</p>
                <p className="text-xs text-gray-500">Pembayaran cash</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-gray-100 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.nonCashSales)}</p>
                <p className="text-xs font-medium text-gray-900">Non Tunai</p>
                <p className="text-xs text-gray-500">QRIS + Transfer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Transaksi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">User/Rider</label>
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rider" />
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

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Metode Bayar</label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Metode</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="credit_card">Kartu Kredit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tanggal Mulai</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tanggal Akhir</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Cari</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="No transaksi, pelanggan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={fetchTransactions}
                className="w-full bg-primary hover:bg-primary-dark"
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Data Transaksi ({transactions.length} transaksi)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600 w-8"></th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">No. Transaksi</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Tanggal</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Pelanggan</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Rider</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Jumlah</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Metode Bayar</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <>
                      <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {transaction.transaction_items && transaction.transaction_items.length > 0 && (
                            <button
                              onClick={() => toggleRowExpansion(transaction.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {expandedRows.has(transaction.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-primary">{transaction.transaction_number}</td>
                        <td className="py-3 px-4 text-gray-600">{formatDate(transaction.transaction_date)}</td>
                        <td className="py-3 px-4 text-gray-600">{transaction.customers?.name || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{transaction.profiles?.full_name || '-'}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{formatCurrency(transaction.final_amount)}</td>
                        <td className="py-3 px-4">
                          <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                            {transaction.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{transaction.payment_method || '-'}</td>
                      </tr>
                      {expandedRows.has(transaction.id) && transaction.transaction_items && (
                        <tr>
                          <td colSpan={8} className="py-0">
                            <div className="bg-gray-50 p-4 border-l-4 border-primary">
                              <h4 className="font-medium text-gray-900 mb-3">Detail Menu:</h4>
                              <div className="grid gap-2">
                                {transaction.transaction_items.map((item) => (
                                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border">
                                    <div>
                                      <span className="font-medium text-gray-900">{item.products?.name}</span>
                                      <span className="text-gray-500 ml-2">x{item.quantity}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium text-gray-900">{formatCurrency(item.total_price)}</div>
                                      <div className="text-sm text-gray-500">@{formatCurrency(item.unit_price)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        Tidak ada transaksi ditemukan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};