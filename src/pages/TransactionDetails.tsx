import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TransactionDetailItem {
  id: string;
  transaction_number: string;
  transaction_date: string;
  menu_name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  profit: number;
  payment_method: string;
}

interface Summary {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  totalQuantity: number;
}

export const TransactionDetails = () => {
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetailItem[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalSales: 0,
    totalCost: 0,
    totalProfit: 0,
    totalQuantity: 0
  });
  
  // Filter states
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

  useEffect(() => {
    fetchTransactionDetails();
  }, [startDate, endDate]);

  const fetchTransactionDetails = async () => {
    setLoading(true);
    try {
      // Fetch transactions with items
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          transaction_date,
          payment_method,
          transaction_items (
            quantity,
            unit_price,
            products (
              name,
              cost_price
            )
          )
        `)
        .eq('status', 'completed')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate + 'T23:59:59')
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      // Transform data to flat structure
      const details: TransactionDetailItem[] = [];
      
      transactions?.forEach(transaction => {
        transaction.transaction_items?.forEach((item: any) => {
          const costPrice = Number(item.products?.cost_price || 0);
          const sellingPrice = Number(item.unit_price || 0);
          const quantity = Number(item.quantity || 0);
          const totalCost = costPrice * quantity;
          const totalSelling = sellingPrice * quantity;
          const profit = totalSelling - totalCost;

          details.push({
            id: `${transaction.id}-${item.products?.name}`,
            transaction_number: transaction.transaction_number,
            transaction_date: transaction.transaction_date,
            menu_name: item.products?.name || 'Unknown Product',
            quantity: quantity,
            cost_price: costPrice,
            selling_price: sellingPrice,
            profit: profit,
            payment_method: transaction.payment_method || 'Unknown'
          });
        });
      });

      // Filter by search term
      const filteredDetails = details.filter(detail => 
        searchTerm === "" || 
        detail.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        detail.menu_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      setTransactionDetails(filteredDetails);

      // Calculate summary
      const totalQuantity = filteredDetails.reduce((sum, item) => sum + item.quantity, 0);
      const totalCost = filteredDetails.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
      const totalSales = filteredDetails.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
      const totalProfit = totalSales - totalCost;

      setSummary({
        totalSales,
        totalCost,
        totalProfit,
        totalQuantity
      });

    } catch (error) {
      console.error("Error fetching transaction details:", error);
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

  const exportToCSV = () => {
    const headers = ['ID Transaksi', 'Tanggal', 'Nama Menu', 'Jumlah', 'Harga Bahan Baku', 'Harga Jual', 'Profit', 'Metode Bayar'];
    const csvData = transactionDetails.map(item => [
      item.transaction_number,
      formatDate(item.transaction_date),
      item.menu_name,
      item.quantity,
      item.cost_price,
      item.selling_price,
      item.profit,
      item.payment_method
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction_details_${startDate}_to_${endDate}.csv`;
    a.click();
  };

  const getPaymentMethodBadge = (method: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'cash': 'default',
      'transfer': 'secondary', 
      'qris': 'outline',
      'credit_card': 'destructive'
    };
    return variants[method] || 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detail Transaksi</h1>
          <p className="text-sm text-muted-foreground">Detail transaksi per menu dengan analisis profit</p>
        </div>
        <Button onClick={exportToCSV} className="bg-primary hover:bg-primary-dark">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalSales)}</p>
              <p className="text-sm font-medium text-gray-700">Total Penjualan</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalCost)}</p>
              <p className="text-sm font-medium text-gray-700">Total Biaya Bahan</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalProfit)}</p>
              <p className="text-sm font-medium text-gray-700">Total Profit</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.totalQuantity}</p>
              <p className="text-sm font-medium text-gray-700">Total Item Terjual</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Data
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  placeholder="No transaksi, nama menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Detail Transaksi Per Menu ({transactionDetails.length} item)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Transaksi</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama Menu</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead className="text-right">Harga Bahan Baku</TableHead>
                    <TableHead className="text-right">Harga Jual</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-center">Metode Bayar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionDetails.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.transaction_number}
                      </TableCell>
                      <TableCell>{formatDate(item.transaction_date)}</TableCell>
                      <TableCell>{item.menu_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cost_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.selling_price)}</TableCell>
                      <TableCell className="text-right">
                        <span className={item.profit >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(item.profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getPaymentMethodBadge(item.payment_method)}>
                          {item.payment_method?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactionDetails.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Tidak ada data transaksi ditemukan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};