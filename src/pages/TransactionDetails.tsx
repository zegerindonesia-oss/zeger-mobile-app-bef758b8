import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, Search, FileText, MessageCircle, Mail } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";
import { calculateSalesData, calculateRawMaterialCost, type SalesData } from "@/lib/financial-utils";
import { DateFilter } from "@/components/common/DateFilter";
import { getTodayJakarta } from "@/lib/date";

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
  brand: string;
}

interface Summary {
  grossSales: number;
  netSales: number;
  totalDiscounts: number;
  totalCost: number;
  totalProfit: number;
  totalQuantity: number;
}

interface Rider {
  id: string;
  full_name: string;
}

export const TransactionDetails = () => {
  const { userProfile } = useAuth();
  const { assignedRiderId, assignedRiderName, shouldAutoFilter } = useRiderFilter();
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetailItem[]>([]);
  
  // Check if user is bh_report for white background styling
  const isBhReport = userProfile?.role === 'bh_report';
  const [summary, setSummary] = useState<Summary>({
    grossSales: 0,
    netSales: 0,
    totalDiscounts: 0,
    totalCost: 0,
    totalProfit: 0,
    totalQuantity: 0
  });

  const getJakartaDate = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  };

  const formatYMD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Filter states - auto-set for bh_report users
  const [selectedRider, setSelectedRider] = useState(() => {
    if (shouldAutoFilter && assignedRiderId) {
      return assignedRiderId;
    }
    return "all";
  });

  const [riders, setRiders] = useState<Rider[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const defaultDate = (() => {
      const now = getJakartaDate();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return formatYMD(monthStart);
    })();
    return params.get('start_date') || defaultDate;
  });
  const [endDate, setEndDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('end_date') || formatYMD(getJakartaDate());
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [loading, setLoading] = useState(true);

  const canPickBranch = ['ho_admin', 'ho_owner', 'ho_staff', 'finance', '1_HO_Admin', '1_HO_Owner', '1_HO_Staff'].includes(userProfile?.role || '');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState(() => new URLSearchParams(window.location.search).get('branch') || 'all');
  const branchFilter: string | undefined = canPickBranch
    ? (selectedBranch === 'all' ? undefined : selectedBranch)
    : (userProfile?.branch_id || undefined);

  useEffect(() => {
    if (userProfile?.role !== 'bh_report') {
      fetchRiders();
    }
    if (canPickBranch) {
      supabase.from('branches').select('id, name').eq('is_active', true).order('name')
        .then(({ data }) => setBranches(data || []));
    }
  }, [userProfile]);

  useEffect(() => {
    // Auto-set selected rider for bh_report users
    if (shouldAutoFilter && assignedRiderId && selectedRider !== assignedRiderId) {
      setSelectedRider(assignedRiderId);
    }
  }, [shouldAutoFilter, assignedRiderId, selectedRider]);

  useEffect(() => {
    fetchTransactionDetails();
  }, [startDate, endDate, selectedRider, branchFilter, selectedBrand]);

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

  const fetchTransactionDetails = async () => {
    setLoading(true);
    try {
      console.log("🔍 Fetching transaction details for user:", userProfile?.role);
      console.log("🔍 Selected rider:", selectedRider);
      console.log("🔍 Date range:", { startDate, endDate });
      
      // Use centralized sales calculation for consistency
      const salesData = await calculateSalesData(
        new Date(startDate + 'T00:00:00+07:00'),
        new Date(endDate + 'T23:59:59+07:00'),
        selectedRider === "all" ? undefined : selectedRider,
        branchFilter
      );

      // Fetch detailed transaction items for the table
      let query = supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          transaction_date,
          payment_method,
          rider_id,
          transaction_items (
            quantity,
            unit_price,
            products (
              name,
              cost_price,
              brand
            )
          )
        `)
        .eq('status', 'completed')
        .eq('is_voided', false)
        .gte('transaction_date', startDate + 'T00:00:00+07:00')
        .lte('transaction_date', endDate + 'T23:59:59+07:00')
        .order('transaction_date', { ascending: false });

      if (selectedRider !== "all") {
        query = query.eq('rider_id', selectedRider);
      }
      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data: transactions, error } = await query;

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
            payment_method: transaction.payment_method || 'Unknown',
            brand: item.products?.brand || 'Tanpa Brand'
          });
        });
      });

      // Outlet / cashier POS items (only when not filtered to a single rider)
      const brandMap = new Map<string, string>();
      if (selectedRider === "all") {
        const { data: prods } = await supabase.from('products').select('id, brand');
        (prods || []).forEach((p: any) => brandMap.set(p.id, p.brand || 'Tanpa Brand'));
      }
      if (selectedRider === "all") {
        for (let from = 0; ; from += 1000) {
          let pq = supabase
            .from('pos_transactions')
            .select('id, transaction_number, created_at, payment_method_1, pos_transaction_items(product_name, qty, price, product_id)')
            .eq('status', 'paid')
            .is('void_at', null)
            .gte('created_at', startDate + 'T00:00:00+07:00')
            .lte('created_at', endDate + 'T23:59:59+07:00')
            .order('created_at', { ascending: false });
          if (branchFilter) pq = pq.eq('branch_id', branchFilter);
          const { data: page } = await pq.range(from, from + 999);
          (page || []).forEach((t: any) => {
            (t.pos_transaction_items || []).forEach((i: any, idx: number) => {
              const qty = Number(i.qty || 0);
              const price = Number(i.price || 0);
              details.push({
                id: `${t.id}-${idx}`,
                transaction_number: t.transaction_number || '-',
                transaction_date: t.created_at,
                menu_name: i.product_name || 'Unknown Product',
                quantity: qty,
                cost_price: 0,
                selling_price: price,
                profit: price * qty,
                payment_method: t.payment_method_1 || 'Unknown',
                brand: brandMap.get(i.product_id) || 'Tanpa Brand',
              });
            });
          });
          if (!page || page.length < 1000) break;
        }
        details.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
      }

      // Filter by search term
      setBrands(Array.from(new Set(details.map(d => d.brand))).sort());
      const filteredDetails = details.filter(detail => 
        (selectedBrand === 'all' || detail.brand === selectedBrand)
      ).filter(detail =>
        searchTerm === "" || 
        detail.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        detail.menu_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      setTransactionDetails(filteredDetails);

      // Use centralized raw material cost calculation for consistency
      const rawMaterialCost = await calculateRawMaterialCost(
        new Date(startDate + 'T00:00:00+07:00'),
        new Date(endDate + 'T23:59:59+07:00'),
        selectedRider === "all" ? undefined : selectedRider,
        branchFilter
      );

      const totalQuantity = filteredDetails.reduce((sum, item) => sum + item.quantity, 0);
      const totalProfit = salesData.netSales - rawMaterialCost;

      console.log(`📊 Transaction Details - Sales: ${formatCurrency(salesData.netSales)}, Raw Material Cost: ${formatCurrency(rawMaterialCost)}`);

      if (selectedBrand !== 'all') {
        const sales = filteredDetails.reduce((s, d) => s + d.selling_price * d.quantity, 0);
        const cost = filteredDetails.reduce((s, d) => s + d.cost_price * d.quantity, 0);
        setSummary({ grossSales: sales, netSales: sales, totalDiscounts: 0, totalCost: cost, totalProfit: sales - cost, totalQuantity });
        return;
      }

      setSummary({
        grossSales: salesData.grossSales,
        netSales: salesData.netSales,
        totalDiscounts: salesData.totalDiscount,
        totalCost: rawMaterialCost,
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

  const buildPdf = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), m = 10;
    const branchName = selectedBranch === 'all' ? 'Semua Cabang' : (branches.find(b => b.id === selectedBranch)?.name || '-');
    const riderName = selectedRider === 'all' ? 'Semua User' : (riders.find(r => r.id === selectedRider)?.full_name || assignedRiderName || '-');
    let y = 14;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Laporan Penjualan - Detail Transaksi", m, y); y += 6;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text(`Periode: ${startDate} s/d ${endDate}  |  Cabang: ${branchName}  |  Brand: ${selectedBrand === 'all' ? 'Semua Brand' : selectedBrand}  |  User: ${riderName}`, m, y); y += 6;
    pdf.text(`Penjualan Bersih: ${formatCurrency(summary.netSales)}   Kotor: ${formatCurrency(summary.grossSales)}   Biaya Bahan: ${formatCurrency(summary.totalCost)}   Profit: ${formatCurrency(summary.totalProfit)}   Item: ${summary.totalQuantity}`, m, y); y += 8;
    const head = ['ID Transaksi', 'Tanggal', 'Menu', 'Brand', 'Qty', 'Harga Bahan', 'Harga Jual', 'Profit', 'Bayar'];
    const widths = [38, 32, 60, 30, 12, 26, 26, 26, 27];
    const row = (r: (string | number)[], bold = false) => {
      if (y > H - 10) { pdf.addPage(); y = 14; }
      pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(7.5);
      let x = m;
      r.forEach((c, i) => { pdf.text(pdf.splitTextToSize(String(c ?? ""), widths[i] - 1)[0] || "", x, y); x += widths[i]; });
      y += 5;
    };
    row(head, true); pdf.line(m, y - 3.5, W - m, y - 3.5);
    transactionDetails.forEach(d => row([d.transaction_number, formatDate(d.transaction_date), d.menu_name, d.brand, d.quantity, formatCurrency(d.cost_price), formatCurrency(d.selling_price), formatCurrency(d.profit), d.payment_method]));
    return pdf;
  };
  const pdfName = () => `Laporan-Penjualan-${selectedBrand === 'all' ? 'Semua' : selectedBrand}-${startDate}_${endDate}.pdf`;

  const exportPDF = () => buildPdf().save(pdfName());

  const sharePDF = async (channel: 'wa' | 'email') => {
    const pdf = buildPdf();
    const file = new File([pdf.output('blob')], pdfName(), { type: 'application/pdf' });
    const text = `Laporan Penjualan ${startDate} s/d ${endDate} - Penjualan Bersih ${formatCurrency(summary.netSales)}`;
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try { await nav.share({ files: [file], title: 'Laporan Penjualan', text }); return; } catch { return; }
    }
    pdf.save(pdfName());
    toast.info('PDF sudah diunduh, lampirkan file tersebut di pesan.');
    if (channel === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    else window.location.href = `mailto:?subject=${encodeURIComponent('Laporan Penjualan')}&body=${encodeURIComponent(text)}`;
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
        <div className="flex flex-wrap gap-2 justify-end">
          <Button onClick={exportPDF} disabled={loading}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => sharePDF('wa')} disabled={loading}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Kirim WhatsApp
          </Button>
          <Button variant="outline" onClick={() => sharePDF('email')} disabled={loading}>
            <Mail className="h-4 w-4 mr-2" />
            Kirim Email
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.netSales)}</p>
              <p className="text-sm font-medium text-gray-700">Total Penjualan (Bersih)</p>
              <p className="text-xs text-gray-500">Setelah diskon</p>
            </div>
          </CardContent>
        </Card>

        <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-600">{formatCurrency(summary.grossSales)}</p>
              <p className="text-sm font-medium text-gray-700">Penjualan (Kotor)</p>
              <p className="text-xs text-gray-500">Sebelum diskon</p>
            </div>
          </CardContent>
        </Card>

        <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalCost)}</p>
              <p className="text-sm font-medium text-gray-700">Total Biaya Bahan</p>
            </div>
          </CardContent>
        </Card>

        <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalProfit)}</p>
              <p className="text-sm font-medium text-gray-700">Total Profit</p>
            </div>
          </CardContent>
        </Card>

        <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.totalQuantity}</p>
              <p className="text-sm font-medium text-gray-700">Total Item Terjual</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Enhanced Date and User Filter */}
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
            userLabel="User"
            showQuickFilters={true}
            className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}
          />
        </div>
        
        {/* Search Filter */}
        <div className="lg:col-span-1">
          <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Search className="h-4 w-4" />
                Pencarian
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Assigned Rider Display for BH Report users */}
                {userProfile?.role === 'bh_report' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Assigned User</label>
                    <div className="px-3 py-2 bg-muted rounded-md text-sm border">
                      {assignedRiderName || 'Loading...'}
                    </div>
                  </div>
                )}
                {canPickBranch && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Cabang</label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger><SelectValue placeholder="Semua cabang" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Cabang</SelectItem>
                        {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Brand</label>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger><SelectValue placeholder="Semua brand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Brand</SelectItem>
                      {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
        </div>
      </div>

      {/* Transaction Details Table */}
      <Card className={isBhReport ? "bg-white shadow-sm border" : "dashboard-card"}>
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