import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Package, 
  ShoppingCart,
  MapPin,
  Calendar,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceHistory {
  id: string;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_location?: string;
  check_out_location?: string;
  status: string;
}

interface StockHistory {
  id: string;
  product?: { name: string; category: string };
  quantity: number;
  status: string;
  created_at: string;
  movement_type: string;
  actual_delivery_date?: string;
}

interface TransactionHistory {
  id: string;
  transaction_number: string;
  total_amount: number;
  payment_method: string;
  status: string;
  transaction_date: string;
  transaction_items?: Array<{
    product?: { name: string };
    quantity: number;
    unit_price: number;
  }>;
}

interface CheckpointHistory {
  id: string;
  checkpoint_name: string;
  created_at: string;
  address_info: string;
  notes?: string;
}

interface ShiftReportHistory {
  id: string;
  shift_date: string;
  shift_number: number;
  shift_start_time?: string;
  shift_end_time?: string;
  total_sales: number;
  cash_collected: number;
  total_transactions: number;
  status: string;
  report_submitted: boolean;
  actualSalesBreakdown?: {
    cash: number;
    qris: number;
    transfer: number;
    total: number;
  };
  actualTransactions?: number;
  operationalExpenses?: number;
  actualCashDeposit?: number;
}

const MobileHistory = () => {
  const { userProfile } = useAuth();
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistory[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory[]>([]);
  const [checkpointHistory, setCheckpointHistory] = useState<CheckpointHistory[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReportHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchHistoryData();
  }, [dateFilter]);

  const fetchHistoryData = async () => {
    if (!userProfile?.id) return;
    
    setLoading(true);
    try {
      // Fetch attendance history
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('rider_id', userProfile.id)
        .gte('work_date', dateFilter.from)
        .lte('work_date', dateFilter.to)
        .order('work_date', { ascending: false });

      // Fetch stock history
      const { data: stock } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products(name, category)
        `)
        .eq('rider_id', userProfile.id)
        .gte('created_at', `${dateFilter.from}T00:00:00+07:00`)
        .lte('created_at', `${dateFilter.to}T23:59:59+07:00`)
        .order('created_at', { ascending: false });

      // Fetch transaction history
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          *,
          transaction_items(
            *,
            products(name)
          )
        `)
        .eq('rider_id', userProfile.id)
        .gte('transaction_date', `${dateFilter.from}T00:00:00+07:00`)
        .lte('transaction_date', `${dateFilter.to}T23:59:59+07:00`)
        .order('transaction_date', { ascending: false });

      // Fetch checkpoint history
      const { data: checkpoints } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('rider_id', userProfile.id)
        .gte('created_at', `${dateFilter.from}T00:00:00+07:00`)
        .lte('created_at', `${dateFilter.to}T23:59:59+07:00`)
        .order('created_at', { ascending: false });

      // Fetch shift reports with proper calculation (only completed shifts)
      const { data: shifts } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', userProfile.id)
        .gte('shift_date', dateFilter.from)
        .lte('shift_date', dateFilter.to)
        .eq('status', 'completed')
        .order('shift_date', { ascending: false })
        .order('shift_number', { ascending: false });

      // For each shift, calculate proper totals
      const shiftsWithTotals = await Promise.all(
        (shifts || []).map(async (shift) => {
          // Get all transactions in this shift
          const { data: shiftTransactions } = await supabase
            .from('transactions')
            .select('final_amount, payment_method')
            .eq('rider_id', userProfile.id)
            .gte('transaction_date', shift.shift_start_time || `${shift.shift_date}T00:00:00+07:00`)
            .lt('transaction_date', shift.shift_end_time || `${shift.shift_date}T23:59:59+07:00`);

          // Get operational expenses for this shift
          const { data: expenses } = await supabase
            .from('daily_operational_expenses')
            .select('amount')
            .eq('rider_id', userProfile.id)
            .eq('shift_id', shift.id);
          
          const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
          
          // Calculate totals by payment method
          const cashSales = shiftTransactions?.filter(t => t.payment_method === 'cash')
            .reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;
          const qrisSales = shiftTransactions?.filter(t => t.payment_method === 'qris')
            .reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;
          const transferSales = shiftTransactions?.filter(t => t.payment_method === 'bank_transfer')
            .reduce((sum, t) => sum + Number(t.final_amount), 0) || 0;
          
          const totalSales = cashSales + qrisSales + transferSales;
          const totalCashDeposit = cashSales - totalExpenses;

          return {
            ...shift,
            total_sales: totalSales,
            cash_collected: Math.max(0, cashSales - totalExpenses),
            actualSalesBreakdown: {
              cash: cashSales,
              qris: qrisSales,
              transfer: transferSales,
              total: totalSales
            },
            operationalExpenses: totalExpenses,
            actualCashDeposit: Math.max(0, cashSales - totalExpenses),
            actualTransactions: shiftTransactions?.length || 0
          };
        })
      );

      setAttendanceHistory(attendance || []);
      setStockHistory(stock || []);
      setTransactionHistory(transactions || []);
      setCheckpointHistory(checkpoints || []);
      setShiftReports(shiftsWithTotals);
    } catch (error: any) {
      console.error('Error loading history:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'checked_out':
      case 'received':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Selesai</Badge>;
      case 'pending':
      case 'checked_in':
      case 'sent':
        return <Badge className="bg-orange-100 text-orange-800"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'cancelled':
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Gagal</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header with Date Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Riwayat Aktivitas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Dari:</label>
                <Input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Sampai:</label>
                <Input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
            </div>
            <Button 
              onClick={fetchHistoryData} 
              disabled={loading}
              size="sm"
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </CardContent>
        </Card>

        {/* History Tabs */}
        <Card>
          <CardContent className="p-4">
            <Tabs defaultValue="attendance" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5 text-xs">
                <TabsTrigger value="attendance">Absensi</TabsTrigger>
                <TabsTrigger value="stock">Stok</TabsTrigger>
                <TabsTrigger value="transactions">Jual</TabsTrigger>
                <TabsTrigger value="shifts">Shift</TabsTrigger>
                <TabsTrigger value="checkpoints">Check</TabsTrigger>
              </TabsList>

              {/* Attendance History - Enhanced */}
              <TabsContent value="attendance" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Detail Absensi</h4>
                  <Badge variant="outline">{attendanceHistory.length} Records</Badge>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {attendanceHistory.map((item) => (
                      <Card key={item.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{formatDate(item.work_date)}</h4>
                            {getStatusBadge(item.status)}
                          </div>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="font-medium text-green-600">Check In</p>
                                {item.check_in_time && (
                                  <p>🕒 {new Date(item.check_in_time).toLocaleTimeString('id-ID')}</p>
                                )}
                                {item.check_in_location && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" />
                                    <p className="text-xs">{item.check_in_location}</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-red-600">Check Out</p>
                                {item.check_out_time ? (
                                  <>
                                    <p>🕒 {new Date(item.check_out_time).toLocaleTimeString('id-ID')}</p>
                                    {item.check_out_location && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <MapPin className="h-3 w-3" />
                                        <p className="text-xs">{item.check_out_location}</p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-orange-500">Belum Check Out</p>
                                )}
                              </div>
                            </div>
                            {item.check_in_time && item.check_out_time && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium">
                                  Durasi Kerja: {
                                    Math.round(
                                      (new Date(item.check_out_time).getTime() - new Date(item.check_in_time).getTime()) 
                                      / (1000 * 60 * 60 * 100)
                                    ) / 100
                                  } jam
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {attendanceHistory.length === 0 && (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tidak ada riwayat absensi</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Stock History - Enhanced Summary */}
              <TabsContent value="stock" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Detail Pergerakan Stok</h4>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50">
                      Masuk: {stockHistory.filter(s => s.movement_type === 'transfer').reduce((sum, s) => sum + s.quantity, 0)}
                    </Badge>
                    <Badge variant="outline" className="bg-red-50">
                      Keluar: {stockHistory.filter(s => s.movement_type === 'return').reduce((sum, s) => sum + s.quantity, 0)}
                    </Badge>
                  </div>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {/* Summary Card */}
                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Shift 1</h4>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />Selesai
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <p className="text-muted-foreground">Stok Masuk</p>
                            <p className="font-bold text-lg text-green-600">
                              {stockHistory.filter(s => s.movement_type === 'transfer').reduce((sum, s) => sum + s.quantity, 0)}
                            </p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span className="text-xs text-green-600">Telah Diterima</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Terjual</p>
                            <p className="font-bold text-lg text-blue-600">
                              {transactionHistory.reduce((sum, t) => sum + (t.transaction_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Stok Kembali</p>
                            <p className="font-bold text-lg text-red-600">
                              {stockHistory.filter(s => s.movement_type === 'return').reduce((sum, s) => sum + s.quantity, 0)}
                            </p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span className="text-xs text-green-600">Dikembalikan</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Stock In Details */}
                    {stockHistory.filter(s => s.movement_type === 'transfer').length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h5 className="font-medium mb-3">Rincian Stok Masuk</h5>
                          <div className="space-y-2">
                            {stockHistory
                              .filter(s => s.movement_type === 'transfer')
                              .reduce((acc: any[], item) => {
                                const existing = acc.find(a => a.product?.name === item.product?.name);
                                if (existing) {
                                  existing.quantity += item.quantity;
                                } else {
                                  acc.push({ ...item });
                                }
                                return acc;
                              }, [])
                              .map((item, index) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <span>- {item.product?.name}</span>
                                  <span className="font-medium">{item.quantity}</span>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Stock Return Details */}
                    {stockHistory.filter(s => s.movement_type === 'return').length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h5 className="font-medium mb-3">Rincian Stok Kembali</h5>
                          <div className="space-y-2">
                            {stockHistory
                              .filter(s => s.movement_type === 'return')
                              .reduce((acc: any[], item) => {
                                const existing = acc.find(a => a.product?.name === item.product?.name);
                                if (existing) {
                                  existing.quantity += item.quantity;
                                } else {
                                  acc.push({ ...item });
                                }
                                return acc;
                              }, [])
                              .map((item, index) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <span>- {item.product?.name}</span>
                                  <span className="font-medium">{item.quantity}</span>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {stockHistory.length === 0 && (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tidak ada riwayat stok</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Transaction History - Enhanced with Menu Names */}
              <TabsContent value="transactions" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Detail Transaksi</h4>
                  <Button variant="outline" size="sm" onClick={() => {
                    // Sort by highest/lowest menu sales
                    setTransactionHistory(prev => [...prev.sort((a, b) => b.total_amount - a.total_amount)]);
                  }}>
                    Sort by Sales
                  </Button>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {transactionHistory.map((item) => (
                      <Card key={item.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">#{item.transaction_number}</h4>
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />Selesai
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-green-600 font-medium">Total: {formatCurrency(item.total_amount)}</span>
                              <span className="font-medium">{item.payment_method?.toUpperCase()}</span>
                            </div>
                            <p className="text-muted-foreground">Waktu: {formatDateTime(item.transaction_date)}</p>
                            
                            {/* Menu Items Detail */}
                            {item.transaction_items && item.transaction_items.length > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium mb-2">Detail Item:</p>
                                 <div className="space-y-1">
                                   {item.transaction_items.map((transItem, idx) => (
                                     <div key={idx} className="flex items-center justify-between text-xs">
                                       <span>• {transItem.product?.name || 'Produk Tidak Dikenal'} x{transItem.quantity}</span>
                                       <span>{formatCurrency(transItem.unit_price * transItem.quantity)}</span>
                                     </div>
                                   ))}
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs font-medium">
                                  <span>Total Item: {item.transaction_items.length}</span>
                                  <span>Nilai: {formatCurrency(item.total_amount)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {transactionHistory.length === 0 && (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tidak ada riwayat transaksi</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Shift Reports - Detailed */}
              <TabsContent value="shifts" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Riwayat Laporan Shift</h4>
                  <Badge variant="outline">{shiftReports.length} Shift</Badge>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {shiftReports.map((shift) => {
                      // Use actual data instead of estimates
                      const salesData = shift.actualSalesBreakdown || { cash: 0, qris: 0, transfer: 0, total: 0 };
                      const operationalExpenses = shift.operationalExpenses || 0;
                      const cashDeposit = shift.actualCashDeposit || 0;

                      return (
                        <Card key={shift.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">Shift {shift.shift_number} - {formatDate(shift.shift_date)}</h4>
                              <Badge variant="default">
                                Selesai
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                              <div>
                                <p className="text-blue-600 font-medium mb-2">Waktu Kerja</p>
                                <div className="space-y-1">
                                  {shift.shift_start_time && (
                                    <p>🕒 Mulai: {new Date(shift.shift_start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-green-600 font-medium mb-2">Transaksi</p>
                                <div className="space-y-1">
                                  <p>📊 Total: {shift.actualTransactions || shift.total_transactions}</p>
                                </div>
                              </div>
                            </div>

                            {/* Sales Breakdown */}
                            <div className="space-y-4">
                              <div className="bg-green-50 p-3 rounded-lg">
                                <h5 className="font-medium text-green-700 mb-3">Total Penjualan</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span>Penjualan Tunai:</span>
                                    <span className="font-medium">{formatCurrency(salesData.cash)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>QRIS:</span>
                                    <span className="font-medium">{formatCurrency(salesData.qris)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Transfer Bank:</span>
                                    <span className="font-medium">{formatCurrency(salesData.transfer)}</span>
                                  </div>
                                  <div className="border-t pt-2 flex justify-between font-bold text-green-700">
                                    <span>Total Penjualan:</span>
                                    <span>{formatCurrency(salesData.total)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-blue-50 p-3 rounded-lg">
                                <h5 className="font-medium text-blue-700 mb-3">Setoran Tunai</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span>Penjualan Tunai:</span>
                                    <span className="font-medium">{formatCurrency(salesData.cash)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Beban Operasional:</span>
                                    <span className="font-medium text-red-600">({formatCurrency(operationalExpenses)})</span>
                                  </div>
                                  <div className="border-t pt-2 flex justify-between font-bold text-blue-700">
                                    <span>Setoran Tunai:</span>
                                    <span>{formatCurrency(cashDeposit)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {shiftReports.length === 0 && (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tidak ada riwayat shift</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Checkpoint History - Enhanced */}
              <TabsContent value="checkpoints" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Detail Checkpoint</h4>
                  <Badge variant="outline">{checkpointHistory.length} Lokasi</Badge>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {checkpointHistory.map((item) => (
                      <Card key={item.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{item.checkpoint_name}</h4>
                            <Badge className="bg-orange-100 text-orange-800">
                              <MapPin className="h-3 w-3 mr-1" />
                              Lokasi
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <p>{formatDateTime(item.created_at)}</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium">Alamat:</p>
                                <p className="text-xs">{item.address_info}</p>
                              </div>
                            </div>
                            {item.notes && (
                              <div className="bg-muted p-2 rounded mt-2">
                                <p className="text-xs font-medium mb-1">Catatan:</p>  
                                <p className="text-xs">{item.notes}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {checkpointHistory.length === 0 && (
                      <div className="text-center py-8">
                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tidak ada riwayat checkpoint</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileHistory;