import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, Package, CalendarIcon, History, DollarSign, Eye } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  reference_id: string;
  created_at: string;
  rider_id: string;
  branch_id: string;
  status: string;
  verification_photo_url?: string;
  products: {
    name: string;
    category: string;
  };
  profiles: {
    full_name: string;
  };
}

interface Shift {
  id: string;
  rider_id: string;
  shift_date: string;
  shift_number: number;
  shift_start_time: string | null;
  shift_end_time: string | null;
  total_sales: number;
  cash_collected: number;
  total_transactions: number;
  report_submitted: boolean;
  report_verified: boolean;
  notes?: string;
  operationalExpenses?: Array<{
    shift_id: string;
    amount: number;
    expense_type: string;
    description: string;
  }>;
}

interface Rider {
  id: string;
  full_name: string;
}

interface CombinedRiderReport {
  riderId: string;
  riderName: string;
  stockReturns: StockMovement[];
  cashDeposit?: Shift;
  verificationQuantities: Record<string, number>;
}

interface EnhancedShiftReportProps {
  userProfileId: string;
  branchId: string;
  riders: Record<string, Rider>;
}

export const EnhancedShiftReport = ({ userProfileId, branchId, riders }: EnhancedShiftReportProps) => {
  const [combinedReports, setCombinedReports] = useState<CombinedRiderReport[]>([]);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // History filters
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchCombinedReports();
    fetchShiftHistory();
  }, [branchId, selectedUser, startDate, endDate]);

  const fetchCombinedReports = async () => {
    try {
      // Fetch stock returns
      const { data: stockData, error: stockError } = await supabase
        .from('stock_movements')
        .select(`
          id,
          product_id,
          quantity,
          reference_id,
          created_at,
          rider_id,
          branch_id,
          status,
          verification_photo_url,
          products!inner(name, category),
          profiles!stock_movements_rider_id_fkey(full_name)
        `)
        .eq('movement_type', 'return')
        .eq('branch_id', branchId)
        .in('status', ['pending', 'returned'])
        .order('created_at', { ascending: false });

      if (stockError) throw stockError;

      // Fetch shifts with notes
      const { data: shiftData, error: shiftError } = await supabase
        .from('shift_management')
        .select('id, rider_id, shift_date, shift_number, shift_start_time, shift_end_time, total_sales, cash_collected, total_transactions, report_submitted, report_verified, notes, created_at')
        .eq('branch_id', branchId)
        .eq('report_submitted', true)
        .eq('report_verified', false)
        .order('created_at', { ascending: false });

      if (shiftError) throw shiftError;

      // Fetch operational expenses for shifts
      let operationalExpenses: Record<string, any[]> = {};
      if (shiftData && shiftData.length > 0) {
        const shiftIds = shiftData.map(s => s.id);
        const { data: expensesData, error: expensesError } = await supabase
          .from('daily_operational_expenses')
          .select('shift_id, amount, expense_type, description')
          .in('shift_id', shiftIds);
        
        if (expensesError) throw expensesError;
        
        // Group expenses by shift_id
        (expensesData || []).forEach((expense: any) => {
          if (!operationalExpenses[expense.shift_id]) {
            operationalExpenses[expense.shift_id] = [];
          }
          operationalExpenses[expense.shift_id].push(expense);
        });
      }

      // Combine data by rider
      const riderMap: Record<string, CombinedRiderReport> = {};

      // Add stock returns to rider reports
      stockData?.forEach((movement) => {
        const riderId = movement.rider_id;
        if (!riderMap[riderId]) {
          riderMap[riderId] = {
            riderId,
            riderName: movement.profiles?.full_name || 'Unknown Rider',
            stockReturns: [],
            verificationQuantities: {}
          };
        }
        riderMap[riderId].stockReturns.push(movement);
        riderMap[riderId].verificationQuantities[movement.id] = movement.quantity;
      });

      // Add cash deposits to rider reports with operational expenses
      shiftData?.forEach((shift) => {
        const riderId = shift.rider_id;
        if (!riderMap[riderId]) {
          riderMap[riderId] = {
            riderId,
            riderName: riders[riderId]?.full_name || 'Unknown Rider',
            stockReturns: [],
            verificationQuantities: {}
          };
        }
        riderMap[riderId].cashDeposit = {
          ...shift,
          operationalExpenses: operationalExpenses[shift.id] || []
        };
      });

      setCombinedReports(Object.values(riderMap));
    } catch (error: any) {
      console.error('Error fetching combined reports:', error);
      toast.error('Gagal memuat data laporan shift');
    }
  };

  const updateVerificationQuantity = (riderId: string, itemId: string, quantity: number) => {
    setCombinedReports(prev => prev.map(report => 
      report.riderId === riderId 
        ? {
            ...report,
            verificationQuantities: {
              ...report.verificationQuantities,
              [itemId]: quantity
            }
          }
        : report
    ));
  };

  const updateBranchInventory = async (productId: string, quantity: number) => {
    try {
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .is('rider_id', null)
        .maybeSingle();

      if (existingInventory) {
        await supabase
          .from('inventory')
          .update({
            stock_quantity: existingInventory.stock_quantity + quantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingInventory.id);
      } else {
        await supabase
          .from('inventory')
          .insert([{
            branch_id: branchId,
            product_id: productId,
            stock_quantity: quantity,
            rider_id: null
          }]);
      }
    } catch (error: any) {
      console.error('Error updating branch inventory:', error);
    }
  };

  const handleAcceptRiderReport = async (riderId: string) => {
    const report = combinedReports.find(r => r.riderId === riderId);
    if (!report) return;

    setLoading(true);
    try {
      // Confirm stock returns
      for (const item of report.stockReturns) {
        const verifiedQuantity = report.verificationQuantities[item.id] || 0;
        
        await supabase
          .from('stock_movements')
          .update({
            status: 'received',
            actual_delivery_date: new Date().toISOString(),
            notes: `Verified quantity: ${verifiedQuantity} (expected: ${item.quantity})`
          })
          .eq('id', item.id);

        // Update branch inventory with verified quantity
        await updateBranchInventory(item.product_id, verifiedQuantity);
      }

      // Approve cash deposit if exists
      if (report.cashDeposit) {
        await supabase
          .from('shift_management')
          .update({
            report_verified: true,
            verified_by: userProfileId,
            verified_at: new Date().toISOString()
          })
          .eq('id', report.cashDeposit.id);
      }

      toast.success('Laporan shift berhasil diterima!');
      await fetchCombinedReports();
    } catch (error: any) {
      console.error('Error accepting rider report:', error);
      toast.error('Gagal menerima laporan shift');
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftHistory = async () => {
    try {
      // Fetch shift history based on filters
      let query = supabase
        .from('shift_management')
        .select(`
          id,
          rider_id,
          shift_date,
          shift_number,
          shift_start_time,
          shift_end_time,
          total_sales,
          cash_collected,
          report_verified,
          verified_by,
          verified_at
        `)
        .eq('branch_id', branchId)
        .eq('report_verified', true)
        .gte('shift_date', format(startDate, 'yyyy-MM-dd'))
        .lte('shift_date', format(endDate, 'yyyy-MM-dd'))
        .order('verified_at', { ascending: false });

      if (selectedUser !== "all") {
        query = query.eq('rider_id', selectedUser);
      }

      const { data: shiftsData, error } = await query;
      if (error) throw error;

      const shiftIds = (shiftsData || []).map((s: any) => s.id);
      let returnsByShift: Record<string, any[]> = {};
      let photosByShift: Record<string, string[]> = {};

      if (shiftIds.length > 0) {
        // Get stock returns for these shifts (using rider_id and created date to match shifts)
        const { data: returnsRes, error: returnsError } = await supabase
          .from('stock_movements')
          .select(`
            id, product_id, quantity, status, verification_photo_url, created_at, rider_id,
            products(name, category)
          `)
          .eq('branch_id', branchId)
          .eq('movement_type', 'return')
          .in('rider_id', shiftsData.map((s: any) => s.rider_id));

        if (returnsError) throw returnsError;

        // Match returns to shifts by rider and date
        shiftsData.forEach((shift: any) => {
          const shiftDate = new Date(shift.shift_date).toDateString();
          const matchingReturns = (returnsRes || []).filter((ret: any) => {
            const returnDate = new Date(ret.created_at).toDateString();
            return ret.rider_id === shift.rider_id && returnDate === shiftDate;
          });
          returnsByShift[shift.id] = matchingReturns;
        });

        // Get photos from daily_reports
        const { data: reportsRes, error: reportsError } = await supabase
          .from('daily_reports')
          .select('id, shift_id, photos')
          .in('shift_id', shiftIds);

        if (reportsError) throw reportsError;

        reportsRes?.forEach((rep: any) => {
          const photos = Array.isArray(rep.photos) ? rep.photos : [];
          photosByShift[rep.shift_id] = photos as string[];
        });

        // Calculate payment breakdown per rider per date from transactions using centralized functions
        console.log('Fetching payment breakdown for date range:', { startDate, endDate });
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');
        
        // Use centralized calculation for consistent results
        const salesByRiderDate: Record<string, { cash: number; qris: number; transfer: number; total: number }> = {};
        
        // Get all unique rider IDs from shifts
        const riderIds = [...new Set(shiftsData.map((s: any) => s.rider_id))];
        
        // Calculate sales data for each rider
        for (const riderId of riderIds) {
          try {
            const { data: transData, error: transError } = await supabase
              .from('transactions')
              .select('final_amount, payment_method, rider_id, transaction_date')
              .eq('status', 'completed')
              .eq('rider_id', riderId)
              .gte('transaction_date', `${startStr}T00:00:00+07:00`)
              .lte('transaction_date', `${endStr}T23:59:59+07:00`);
            
            if (transError) throw transError;
            
            console.log(`Rider ${riderId} transaction data:`, transData?.length || 0, 'transactions');
            
            // Group by date using Jakarta timezone
            const dateGroups: Record<string, any[]> = {};
            (transData || []).forEach((t: any) => {
              const transDate = new Date(t.transaction_date);
              const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(transDate);
              if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
              dateGroups[dateKey].push(t);
            });
            
            // Calculate sales breakdown for each date
            Object.entries(dateGroups).forEach(([date, transactions]) => {
              const key = `${riderId}-${date}`;
              if (!salesByRiderDate[key]) {
                salesByRiderDate[key] = { cash: 0, qris: 0, transfer: 0, total: 0 };
              }
              
              transactions.forEach((t: any) => {
                const amt = Number(t.final_amount || 0);
                const method = (t.payment_method || '').toLowerCase().trim();
                
                // Use consistent payment method normalization
                if (method === 'cash' || method === 'tunai') {
                  salesByRiderDate[key].cash += amt;
                } else if (method === 'qris') {
                  salesByRiderDate[key].qris += amt;
                } else if (method === 'transfer' || method === 'bank_transfer') {
                  salesByRiderDate[key].transfer += amt;
                }
                salesByRiderDate[key].total += amt;
              });
            });
          } catch (error) {
            console.error(`Error fetching data for rider ${riderId}:`, error);
          }
        }
        
        console.log('Sales breakdown by rider-date:', salesByRiderDate);

        // Get daily operational expenses (exclude food) per shift
        const { data: opsData, error: opsError } = await supabase
          .from('daily_operational_expenses')
          .select('amount, expense_type, shift_id')
          .in('shift_id', shiftIds);
        if (opsError) throw opsError;
        const opsByShift: Record<string, number> = {};
        (opsData || []).forEach((op: any) => {
          if ((op.expense_type || '').toLowerCase() !== 'food') {
            opsByShift[op.shift_id] = (opsByShift[op.shift_id] || 0) + Number(op.amount || 0);
          }
        });

        // Attach aggregates to each shift record below via closure
        (window as any).__salesByRiderDate = salesByRiderDate;
        (window as any).__opsByShift = opsByShift;
      }

        const records = (shiftsData || []).map((shift: any) => {
        const items = returnsByShift[shift.id] || [];
        const unsoldTotal = items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
        const returnedVerified = items
          .filter((it: any) => ['approved', 'received'].includes((it.status || '').toLowerCase()))
          .reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
        
        const shiftStartTime = shift.shift_start_time ? 
          new Date(shift.shift_start_time).toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
          }) : '';
        
        const salesMap = (window as any).__salesByRiderDate || {};
        const opsMap = (window as any).__opsByShift || {};
        const shiftDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(shift.shift_date));
        const key = `${shift.rider_id}-${shiftDate}`;
        const sales = salesMap[key] || { cash: 0, qris: 0, transfer: 0, total: 0 };
        
        console.log(`Shift ${shift.id} - Key: ${key}, Sales:`, sales);
        const ops = opsMap[shift.id] || 0;
        return {
          ...shift,
          rider_name: riders[shift.rider_id]?.full_name || 'Unknown Rider',
          return_items: items,
          products_unsold: unsoldTotal,
          products_returned: returnedVerified,
          shift_date_time: `${format(new Date(shift.shift_date), 'dd/MM/yyyy')} ${shiftStartTime}`.trim(),
          deposit_photos: photosByShift[shift.id] || [],
          sales_breakdown: sales,
          operational_daily: ops,
          calculated_cash_deposit: Math.max(0, (sales.cash || 0) - (ops || 0))
        };
      });

      setShiftHistory(records);
    } catch (error: any) {
      console.error('Error fetching shift history:', error);
      toast.error('Gagal memuat riwayat shift');
    }
  };

  return (
    <div className="space-y-6">
      {/* Combined Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Laporan Shift - Pengembalian & Setoran
          </CardTitle>
        </CardHeader>
        <CardContent>
          {combinedReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada laporan shift yang perlu dikonfirmasi
            </div>
          ) : (
            <div className="space-y-6">
              {combinedReports.map((report) => (
                <Card key={report.riderId} className="border-2">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{report.riderName}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(), "dd MMM yyyy", { locale: id })}
                        </p>
                      </div>
                      <Badge variant="secondary">Menunggu Verifikasi</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6">
                    {/* Stock Returns Section */}
                    {report.stockReturns.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Pengembalian Barang
                        </h3>
                        
                        <div className="space-y-4">
                          {report.stockReturns.map((item) => (
                            <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                              {item.verification_photo_url && (
                                <img 
                                  src={item.verification_photo_url} 
                                  alt={item.products.name}
                                  className="w-20 h-20 object-cover rounded-lg border"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg">{item.products.name}</h4>
                                <div className="text-sm text-muted-foreground mt-2 space-y-1">
                                  <p className="flex justify-between">
                                    <span>Tidak terjual:</span>
                                    <span className="font-medium">{item.quantity}</span>
                                  </p>
                                  <p className="flex justify-between">
                                    <span>Kembali:</span>
                                    <span className="font-medium">{item.quantity}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                                <Label htmlFor={`verify-${item.id}`} className="text-sm font-medium">
                                  Jumlah Diterima:
                                </Label>
                                <Input
                                  id={`verify-${item.id}`}
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  className="w-20 text-center font-semibold"
                                  value={report.verificationQuantities[item.id] || ''}
                                  onChange={(e) => updateVerificationQuantity(report.riderId, item.id, parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cash Deposit Section */}
                    {report.cashDeposit && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Laporan Setoran Tunai
                        </h3>
                        
                        <div className="p-4 border rounded-lg bg-blue-50/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                              <div className="flex justify-between p-2 bg-white/80 rounded">
                                <span className="font-medium">Total Penjualan:</span>
                                <span className="font-bold">
                                  Rp {report.cashDeposit.total_sales.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div className="flex justify-between p-2 bg-white/80 rounded">
                                <span className="font-medium">Total Transaksi:</span>
                                <span className="font-semibold">
                                  {report.cashDeposit.total_transactions}
                                </span>
                              </div>
                              <div className="flex justify-between p-2 bg-white/80 rounded">
                                <span className="font-medium">Setoran Tunai:</span>
                                <span className="font-bold text-green-600">
                                  Rp {report.cashDeposit.cash_collected.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                            
                            {/* Operational Expenses */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Beban Operasional:</h4>
                              {report.cashDeposit.operationalExpenses && report.cashDeposit.operationalExpenses.length > 0 ? (
                                <div className="space-y-1">
                                  {report.cashDeposit.operationalExpenses.map((expense: any, index: number) => (
                                    <div key={index} className="flex justify-between p-2 bg-white/80 rounded text-sm">
                                      <span>{expense.expense_type}: {expense.description}</span>
                                      <span className="font-medium text-red-600">
                                        -Rp {Number(expense.amount).toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between p-2 bg-white/80 rounded font-semibold border-t">
                                    <span>Total Beban:</span>
                                    <span className="text-red-600">
                                      -Rp {report.cashDeposit.operationalExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0).toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2 bg-white/80 rounded text-sm text-gray-500">
                                  Tidak ada beban operasional
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Notes Section */}
                          {report.cashDeposit.notes && (
                            <div className="mt-4 p-3 bg-white/80 rounded">
                              <h4 className="font-semibold text-sm mb-2">Catatan:</h4>
                              <p className="text-sm text-gray-700">{report.cashDeposit.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Single Accept Button */}
                    <div className="flex justify-center pt-4">
                      <Button 
                        onClick={() => handleAcceptRiderReport(report.riderId)}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg font-semibold"
                        size="lg"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        Terima
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Riwayat Laporan Shift
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Pilih User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua User</SelectItem>
                  {Object.values(riders).map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal Awal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy", { locale: id })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Tanggal Akhir</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy", { locale: id })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button onClick={fetchShiftHistory} className="mb-4">
            Apply Filter
          </Button>

          <div className="hidden md:grid grid-cols-8 gap-2 mb-2 p-2 rounded-lg bg-muted/30">
            <div>No. Transaksi</div>
            <div>Nama Rider</div>
            <div>Shift</div>
            <div>Tanggal</div>
            <div>Produk tidak terjual</div>
            <div>Produk Kembali</div>
            <div>Setoran Tunai</div>
            <div>Status</div>
          </div>
          <Accordion type="multiple" className="w-full">
            {shiftHistory.map((shift: any) => (
              <AccordionItem key={shift.id} value={shift.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="grid grid-cols-8 gap-2 w-full text-left items-center">
                    <span className="font-mono text-xs md:text-sm">{shift.id}</span>
                    <span>{shift.rider_name}</span>
                    <span className="font-medium">#{shift.shift_number}</span>
                    <span>{shift.shift_date_time}</span>
                    <span>{Number(shift.products_unsold || 0)}</span>
                    <span>{Number(shift.products_returned || 0)}</span>
                    <span className="font-semibold text-green-600">Rp {Number(shift.calculated_cash_deposit || 0).toLocaleString('id-ID')}</span>
                    <Badge variant="default">Telah diterima</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {shift.return_items?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Pengembalian Barang</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {shift.return_items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                              {item.verification_photo_url && (
                                <img src={item.verification_photo_url} alt={item.products?.name || 'Foto pengembalian'} className="w-16 h-16 object-cover rounded-md border" loading="lazy" />
                              )}
                              <div className="flex-1">
                                <div className="font-medium">{item.products?.name}</div>
                                <div className="text-sm text-muted-foreground">Qty: {item.quantity}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold mb-2">Setoran Tunai</h4>
                      {shift.sales_breakdown && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="p-2 bg-green-50 rounded">
                              <div className="font-medium">Tunai</div>
                              <div className="text-green-600">Rp {Number(shift.sales_breakdown.cash || 0).toLocaleString('id-ID')}</div>
                            </div>
                            <div className="p-2 bg-blue-50 rounded">
                              <div className="font-medium">QRIS</div>
                              <div className="text-blue-600">Rp {Number(shift.sales_breakdown.qris || 0).toLocaleString('id-ID')}</div>
                            </div>
                            <div className="p-2 bg-purple-50 rounded">
                              <div className="font-medium">Transfer</div>
                              <div className="text-purple-600">Rp {Number(shift.sales_breakdown.transfer || 0).toLocaleString('id-ID')}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50">
                            <span className="font-medium">Total Penjualan</span>
                            <span className="font-bold text-yellow-700">Rp {Number(shift.sales_breakdown.total || 0).toLocaleString('id-ID')}</span>
                          </div>
                           <div className="flex items-center justify-between p-3 rounded-lg border bg-red-500 text-white">
                             <span className="font-medium">Beban Operasional</span>
                             <span className="font-bold text-white">Rp {Number(shift.operational_daily || 0).toLocaleString('id-ID')}</span>
                           </div>
                           <div className="flex items-center justify-between p-3 rounded-lg border bg-red-500 text-white">
                             <span className="font-medium">Setoran Tunai (Tunai - Operasional)</span>
                             <span className="font-bold text-white">Rp {Number(shift.calculated_cash_deposit || 0).toLocaleString('id-ID')}</span>
                           </div>
                        </div>
                      )}
                      {shift.deposit_photos?.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          {shift.deposit_photos.map((url: string, idx: number) => (
                            <img key={idx} src={url} alt={`Foto setoran ${idx + 1}`} className="w-full h-24 object-cover rounded-md border" loading="lazy" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {shiftHistory.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada riwayat ditemukan untuk filter yang dipilih
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};