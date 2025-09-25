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
  Package,
  Edit,
  Check,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";
import { chunkArray } from "@/lib/array-utils";
import { toast } from "sonner";

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products?: { name: string; cost_price?: number };
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
  const { userProfile } = useAuth();
  
  // Check if user is bh_report for white background styling
  const isBhReport = userProfile?.role === 'bh_report';
  const { assignedRiderId, assignedRiderName, shouldAutoFilter } = useRiderFilter();
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
  
  // Filter states - auto-set for bh_report users
  const [selectedRider, setSelectedRider] = useState(() => {
    if (shouldAutoFilter && assignedRiderId) {
      return assignedRiderId;
    }
    return searchParams.get('rider') || "all";
  });
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
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>('');

  useEffect(() => {
    if (userProfile?.role !== 'bh_report') {
      fetchRiders();
    }
  }, [userProfile]);

  useEffect(() => {
    // Auto-set selected rider for bh_report users
    if (shouldAutoFilter && assignedRiderId && selectedRider !== assignedRiderId) {
      setSelectedRider(assignedRiderId);
    }
  }, [shouldAutoFilter, assignedRiderId, selectedRider]);

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
      console.log("🔍 Fetching transactions for user:", userProfile?.role);
      console.log("🔍 Should auto filter:", shouldAutoFilter);
      console.log("🔍 Selected rider:", selectedRider);
      console.log("🔍 Assigned rider ID:", assignedRiderId);
      console.log("🔍 Assigned rider name:", assignedRiderName);
      
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
        .eq('status', 'completed')
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
      console.log("📊 Fetched transactions:", data?.length || 0);
      if (error) throw error;

      if (!data || data.length === 0) {
        setTransactions([]);
        setSummary({
          totalSales: 0,
          totalTransactions: 0,
          avgPerTransaction: 0,
          totalItemsSold: 0,
          totalFoodCost: 0,
          cashSales: 0,
          nonCashSales: 0
        });
        return;
      }

      // Bulk fetch all related data to avoid N+1 queries
      const transactionIds = data.map(t => t.id);
      const customerIds = [...new Set(data.filter(t => t.customer_id).map(t => t.customer_id))];
      const riderIds = [...new Set(data.filter(t => t.rider_id).map(t => t.rider_id))];

      // Parallel fetch with batched queries to avoid large payload errors
      console.log("🔍 Fetching transaction items for", transactionIds.length, "transactions with batching");
      
      // Batch fetch transaction items to avoid payload size limits
      const transactionChunks = chunkArray(transactionIds, 150);
      const allItems: any[] = [];
      
      for (const chunk of transactionChunks) {
        const { data: batchItems, error: batchError } = await supabase
          .from('transaction_items')
          .select(`
            id,
            transaction_id,
            product_id,
            quantity,
            unit_price,
            total_price
          `)
          .in('transaction_id', chunk);
          
        if (batchError) throw batchError;
        allItems.push(...(batchItems || []));
      }
      
      console.log(`📦 Total transaction items fetched: ${allItems.length}`);
      
      // Fetch other data in parallel
      const [customersResult, ridersResult] = await Promise.all([
        customerIds.length > 0 
          ? supabase.from('customers').select('id, name').in('id', customerIds)
          : Promise.resolve({ data: [] }),
        
        riderIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', riderIds)
          : Promise.resolve({ data: [] })
      ]);

      // Batch fetch products to avoid payload size limits
      const productIds = [...new Set(allItems.map(item => item.product_id))];
      console.log("🔍 Fetching", productIds.length, "unique products with batching");
      
      const productChunks = chunkArray(productIds, 150);
      const allProducts: any[] = [];
      
      for (const chunk of productChunks) {
        const { data: batchProducts } = await supabase
          .from('products')
          .select('id, name, cost_price')
          .in('id', chunk);
        allProducts.push(...(batchProducts || []));
      }

      // Create products map
      const productsMap = new Map(allProducts.map(p => [p.id, p]));

      // Create lookup maps for faster access
      const customersMap = new Map((customersResult.data || []).map(c => [c.id, c]));
      const ridersMap = new Map((ridersResult.data || []).map(r => [r.id, r]));
      const itemsMap = new Map();

      // Group transaction items by transaction_id using batched data
      allItems.forEach(item => {
        if (!itemsMap.has(item.transaction_id)) {
          itemsMap.set(item.transaction_id, []);
        }
        const product = productsMap.get(item.product_id);
        itemsMap.get(item.transaction_id).push({
          ...item,
          products: { 
            name: product?.name || 'Unknown Product', 
            cost_price: product?.cost_price || 0
          }
        });
      });

      console.log(`📦 Transaction items processed: ${allItems.length} items`);
      console.log("📦 Items by transaction:", itemsMap.size, "transactions have items");
      
      // Calculate totals for verification
      let totalItemsCount = 0;
      let totalFoodCostCalc = 0;
      allItems.forEach(item => {
        const qty = Number(item.quantity || 0);
        const product = productsMap.get(item.product_id);
        const costPrice = Number(product?.cost_price || 0);
        totalItemsCount += qty;
        totalFoodCostCalc += qty * costPrice;
        if (costPrice === 0) {
          console.warn(`⚠️ Missing cost_price for product: ${product?.name} (id: ${item.product_id})`);
        }
      });
      console.log(`📊 Verification - Total Items: ${totalItemsCount}, Food Cost: Rp ${totalFoodCostCalc.toLocaleString()}`);

      // Combine all data efficiently
      const transactionsWithDetails = data.map(transaction => ({
        ...transaction,
        customers: { name: customersMap.get(transaction.customer_id)?.name || '-' },
        profiles: { full_name: ridersMap.get(transaction.rider_id)?.full_name || '-' },
        transaction_items: itemsMap.get(transaction.id) || []
      }));

      // Apply search filter
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

      // Calculate food cost from sold items (qty * product cost)
      console.log("🔍 Calculating food cost for", filteredData.length, "transactions");
      
      const totalFoodCost = filteredData.reduce((sum, t) => {
        const transactionCost = t.transaction_items?.reduce((itemSum, item) => {
          const cost = Number(item.products?.cost_price || 0);
          const qty = Number(item.quantity || 0);
          const itemCost = qty * cost;
          return itemSum + itemCost;
        }, 0) || 0;
        return sum + transactionCost;
      }, 0);
      
      console.log(`📊 Final Summary - Items: ${totalItemsSold}, Food Cost: Rp ${totalFoodCost.toLocaleString()}`);

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

  const updatePaymentMethod = async (transactionId: string, paymentMethod: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-transaction-payment', {
        body: {
          transaction_id: transactionId,
          new_payment_method: paymentMethod
        }
      });

      if (error) throw error;
      
      toast.success('Metode pembayaran berhasil diperbarui');
      setEditingPayment(null);
      fetchTransactions(); // Refresh data
    } catch (error: any) {
      console.error('Error updating payment method:', error);
      toast.error('Gagal memperbarui metode pembayaran: ' + error.message);
    }
  };

  const startEditPayment = (transactionId: string, currentMethod: string) => {
    setEditingPayment(transactionId);
    setNewPaymentMethod(currentMethod);
  };

  const cancelEditPayment = () => {
    setEditingPayment(null);
    setNewPaymentMethod('');
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

      {/* Summary Cards - 2 rows layout */}
      <div className="space-y-4 mb-6">
        {/* First row - 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-primary">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalSales)}</p>
                  <p className="text-sm font-medium text-gray-900">Total Penjualan</p>
                  <p className="text-xs text-gray-500">Omset periode</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-blue-600">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{summary.totalTransactions}</p>
                  <p className="text-sm font-medium text-gray-900">Total Transaksi</p>
                  <p className="text-xs text-gray-500">Jumlah transaksi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-purple-600">
                  <Calculator className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.avgPerTransaction)}</p>
                  <p className="text-sm font-medium text-gray-900">Rata-rata per Transaksi</p>
                  <p className="text-xs text-gray-500">Nilai rata-rata</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second row - 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-green-600">
                  <Package className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{summary.totalItemsSold}</p>
                  <p className="text-sm font-medium text-gray-900">Total Item</p>
                  <p className="text-xs text-gray-500">Jumlah terjual</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-red-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalFoodCost)}</p>
                  <p className="text-sm font-medium text-gray-900">Biaya Bahan Baku</p>
                  <p className="text-xs text-gray-500">Food cost periode</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-green-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.cashSales)}</p>
                  <p className="text-sm font-medium text-gray-900">Penjualan Tunai</p>
                  <p className="text-xs text-gray-500">Pembayaran cash</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-gray-100 text-blue-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="text-right flex-1 ml-4">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.nonCashSales)}</p>
                  <p className="text-sm font-medium text-gray-900">Non Tunai</p>
                  <p className="text-xs text-gray-500">QRIS + Transfer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Transaksi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* User/Rider filter - conditional for bh_report users */}
            {userProfile?.role !== 'bh_report' ? (
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
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Assigned Rider</label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm border">
                  {assignedRiderName || 'Loading...'}
                </div>
              </div>
            )}

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
      <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
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
                        <td className="py-3 px-4 text-gray-600">
                          {editingPayment === transaction.id ? (
                            <div className="flex items-center gap-2">
                              <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="qris">QRIS</SelectItem>
                                  <SelectItem value="transfer">Transfer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updatePaymentMethod(transaction.id, newPaymentMethod)}
                                disabled={!newPaymentMethod}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditPayment}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{transaction.payment_method || '-'}</span>
                              {(userProfile?.role === 'ho_admin' || userProfile?.role === 'branch_manager') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditPayment(transaction.id, transaction.payment_method || '')}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
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