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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";
import { chunkArray } from "@/lib/array-utils";
import { toast } from "sonner";
import { calculateSalesData, calculateRawMaterialCost, type SalesData } from "@/lib/financial-utils";
import { DateFilter } from "@/components/common/DateFilter";
import { getTodayJakarta } from "@/lib/date";

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
  is_voided?: boolean;
  voided_at?: string;
  void_reason?: string;
  customers?: { name: string };
  profiles?: { full_name: string };
  transaction_items?: TransactionItem[];
}

interface Summary {
  grossSales: number;
  netSales: number;
  totalDiscounts: number;
  totalTransactions: number;
  avgPerTransaction: number;
  totalItemsSold: number;
  totalFoodCost: number;
  cashSales: number;
  qrisSales: number;
  transferSales: number;
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
    grossSales: 0,
    netSales: 0,
    totalDiscounts: 0,
    totalTransactions: 0,
    avgPerTransaction: 0,
    totalItemsSold: 0,
    totalFoodCost: 0,
    cashSales: 0,
    qrisSales: 0,
    transferSales: 0
  });
  
  // Filter states - auto-set for bh_report users
  const [selectedRider, setSelectedRider] = useState(() => {
    if (shouldAutoFilter && assignedRiderId) {
      return assignedRiderId;
    }
    return searchParams.get('rider') || "all";
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const getJakartaDate = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  };

  const formatYMD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const now = getJakartaDate();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return formatYMD(monthStart);
  });
  const [endDate, setEndDate] = useState(() => {
    return formatYMD(getJakartaDate());
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>('');
  const [voidRequests, setVoidRequests] = useState<Map<string, any>>(new Map());
  const [reviewingVoid, setReviewingVoid] = useState<any | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [activeTab, setActiveTab] = useState<"active" | "voided">("active");
  const [voidedTransactions, setVoidedTransactions] = useState<Transaction[]>([]);

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
    if (activeTab === "active") {
      fetchTransactions();
    } else {
      fetchVoidedTransactions();
    }
  }, [selectedRider, selectedPaymentMethod, startDate, endDate, activeTab]);

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['rider', 'sb_rider', 'bh_rider'])
        .eq('is_active', true);

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error("Error fetching riders:", error);
    }
  };

  const fetchVoidRequests = async (transactionIds: string[]) => {
    if (transactionIds.length === 0) {
      setVoidRequests(new Map());
      return;
    }

    try {
      console.log("🔍 Fetching void requests for", transactionIds.length, "transactions");
      
      const { data, error } = await supabase
        .from('transaction_void_requests')
        .select(`
          id,
          transaction_id,
          rider_id,
          branch_id,
          reason,
          status,
          created_at,
          profiles:rider_id (
            full_name,
            role
          )
        `)
        .in('transaction_id', transactionIds)
        .eq('status', 'pending');

      if (error) throw error;

      const voidMap = new Map();
      data?.forEach(req => {
        voidMap.set(req.transaction_id, req);
      });
      
      console.log("✅ Fetched void requests:", voidMap.size);
      setVoidRequests(voidMap);
    } catch (error) {
      console.error("❌ Error fetching void requests:", error);
    }
  };

  const fetchVoidedTransactions = async () => {
    setLoading(true);
    try {
      console.log("🔍 Fetching voided transactions");
      
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
          rider_id,
          is_voided,
          voided_at,
          void_reason,
          voided_by_profile:profiles!voided_by(full_name)
        `)
        .eq('is_voided', true)
        .gte('transaction_date', `${startDate}T00:00:00+07:00`)
        .lte('transaction_date', `${endDate}T23:59:59+07:00`)
        .order('voided_at', { ascending: false });

      if (selectedRider !== "all") {
        query = query.eq('rider_id', selectedRider);
      }

      if (selectedPaymentMethod !== "all") {
        query = query.eq('payment_method', selectedPaymentMethod);
      }

      const { data, error } = await query;
      console.log("📊 Fetched voided transactions:", data?.length || 0);

      if (error) throw error;

      setVoidedTransactions(data || []);

    } catch (error) {
      console.error("Error fetching voided transactions:", error);
    } finally {
      setLoading(false);
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
        .eq('is_voided', false)
        .gte('transaction_date', `${startDate}T00:00:00+07:00`)
        .lte('transaction_date', `${endDate}T23:59:59+07:00`)
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
          grossSales: 0,
          netSales: 0,
          totalDiscounts: 0,
          totalTransactions: 0,
          avgPerTransaction: 0,
          totalItemsSold: 0,
          totalFoodCost: 0,
          cashSales: 0,
          qrisSales: 0,
          transferSales: 0
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

      // Fetch void requests for all transactions
      await fetchVoidRequests(transactionIds);

      // Use centralized sales calculation for consistency
      const salesData = await calculateSalesData(
        new Date(startDate + 'T00:00:00+07:00'),
        new Date(endDate + 'T23:59:59+07:00'),
        selectedRider === "all" ? undefined : selectedRider
      );

      // Use centralized raw material cost calculation for consistency
      const rawMaterialCost = await calculateRawMaterialCost(
        new Date(startDate + 'T00:00:00+07:00'),
        new Date(endDate + 'T23:59:59+07:00'),
        selectedRider === "all" ? undefined : selectedRider
      );

      console.log(`📊 Centralized calculations - Sales: ${formatCurrency(salesData.netSales)}, Raw Material Cost: ${formatCurrency(rawMaterialCost)}`);

      setSummary({
        grossSales: salesData.grossSales,
        netSales: salesData.netSales,
        totalDiscounts: salesData.totalDiscount,
        totalTransactions: salesData.totalTransactions,
        avgPerTransaction: salesData.averageSalePerTransaction,
        totalItemsSold: salesData.totalItems,
        totalFoodCost: rawMaterialCost,
        cashSales: salesData.salesByPaymentMethod.cash,
        qrisSales: salesData.salesByPaymentMethod.qris,
        transferSales: salesData.salesByPaymentMethod.transfer
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

  const handleVoidRequest = async (action: 'approve' | 'reject') => {
    if (!reviewingVoid) return;

    try {
      const { error } = await supabase.functions.invoke('process-void-transaction', {
        body: {
          void_request_id: reviewingVoid.id,
          action,
          reviewer_notes: reviewerNotes.trim() || null
        }
      });

      if (error) throw error;

      toast.success(action === 'approve' ? 'Transaksi berhasil dibatalkan!' : 'Permohonan void ditolak');
      setReviewingVoid(null);
      setReviewerNotes('');
      fetchTransactions();
    } catch (error: any) {
      console.error('Error processing void request:', error);
      toast.error('Gagal memproses void request: ' + error.message);
    }
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
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.netSales)}</p>
                  <p className="text-sm font-medium text-gray-900">Total Penjualan (Bersih)</p>
                  <p className="text-xs text-gray-500">Setelah diskon: {formatCurrency(summary.totalDiscounts)}</p>
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
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.qrisSales + summary.transferSales)}</p>
                  <p className="text-sm font-medium text-gray-900">Non Tunai</p>
                  <p className="text-xs text-gray-500">QRIS + Transfer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Enhanced Date Filter */}
        <div className="lg:col-span-2">
          <DateFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            showUserFilter={userProfile?.role !== 'bh_report'}
            selectedUser={selectedRider}
            onUserChange={setSelectedRider}
            users={riders}
            userLabel="Rider"
            showQuickFilters={true}
            className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}
          />
        </div>
        
        {/* Additional Filters */}
        <div className="lg:col-span-2">
          <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Tambahan
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4">
                {/* Assigned Rider Display for BH Report users */}
                {userProfile?.role === 'bh_report' && (
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
                      <SelectValue placeholder="Semua metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Metode</SelectItem>
                      <SelectItem value="cash">Tunai</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
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

                <div>
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
        </div>
      </div>

      {/* Transactions Table with Tabs */}
      <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Data Transaksi ({activeTab === "active" ? transactions.length : voidedTransactions.length} transaksi)
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={activeTab === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("active")}
              >
                Transaksi Aktif
              </Button>
              <Button
                variant={activeTab === "voided" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("voided")}
              >
                Transaksi Void
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeTab === "active" ? (
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
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Void Request</th>
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
                        <td className="py-3 px-4">
                          {voidRequests.has(transaction.id) ? (
                            <div className="space-y-2 min-w-[200px]">
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700">Permohonan Void</Badge>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {voidRequests.get(transaction.id).reason}
                              </p>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  onClick={() => setReviewingVoid(voidRequests.get(transaction.id))}
                                  className="h-7 text-xs"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Setuju
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => {
                                    setReviewingVoid(voidRequests.get(transaction.id));
                                    setReviewerNotes('');
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Tidak
                                </Button>
                              </div>
                            </div>
                          ) : transaction.is_voided ? (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700">Dibatalkan</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                      </tr>
                      {expandedRows.has(transaction.id) && transaction.transaction_items && (
                        <tr>
                          <td colSpan={9} className="py-0">
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
          ) : (
            /* Voided Transactions Table */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">No. Transaksi</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Tanggal Void</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Jumlah</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Metode Bayar</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Alasan</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Dibatalkan Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {voidedTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-primary">{transaction.transaction_number}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {transaction.voided_at ? formatDate(transaction.voided_at) : '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{formatCurrency(transaction.final_amount)}</td>
                      <td className="py-3 px-4 text-gray-600">{transaction.payment_method || '-'}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate" title={transaction.void_reason || ''}>
                        {transaction.void_reason || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {(transaction as any).voided_by_profile?.full_name || '-'}
                      </td>
                    </tr>
                  ))}
                  {voidedTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        Tidak ada transaksi void ditemukan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewingVoid} onOpenChange={(open) => !open && setReviewingVoid(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Permohonan Void</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm"><span className="font-medium">Nomor Transaksi:</span> {transactions.find(t => t.id === reviewingVoid?.transaction_id)?.transaction_number}</p>
              <p className="text-sm"><span className="font-medium">Alasan Rider:</span></p>
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">{reviewingVoid?.reason}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan Manager (opsional)</label>
              <Textarea placeholder="Tambahkan catatan jika diperlukan..." value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setReviewingVoid(null); setReviewerNotes(''); }}>Tutup</Button>
            <Button variant="destructive" onClick={() => handleVoidRequest('reject')}>Tolak</Button>
            <Button variant="default" onClick={() => handleVoidRequest('approve')}>Setujui & Batalkan Transaksi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};