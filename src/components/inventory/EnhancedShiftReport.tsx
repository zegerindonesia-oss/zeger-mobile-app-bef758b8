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

      // Fetch shifts
      const { data: shiftData, error: shiftError } = await supabase
        .from('shift_management')
        .select('*')
        .eq('branch_id', branchId)
        .eq('report_submitted', true)
        .eq('report_verified', false)
        .order('created_at', { ascending: false });

      if (shiftError) throw shiftError;

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

      // Add cash deposits to rider reports
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
        riderMap[riderId].cashDeposit = shift;
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
          total_sales,
          cash_collected,
          report_verified,
          verified_by,
          verified_at,
          profiles!shift_management_rider_id_fkey(full_name)
        `)
        .eq('branch_id', branchId)
        .eq('report_verified', true)
        .gte('shift_date', startDate.toISOString().split('T')[0])
        .lte('shift_date', endDate.toISOString().split('T')[0])
        .order('verified_at', { ascending: false });

      if (selectedUser !== "all") {
        query = query.eq('rider_id', selectedUser);
      }

      const { data, error } = await query;
      if (error) throw error;

      setShiftHistory(data || []);
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            </div>
                            <div className="flex justify-between p-2 bg-white/80 rounded">
                              <span className="font-medium">Setoran Tunai:</span>
                              <span className="font-bold text-green-600">
                                Rp {report.cashDeposit.cash_collected.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex justify-center">
                              <div className="relative">
                                <div className="w-32 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">Foto Setoran</span>
                                </div>
                              </div>
                            </div>
                          </div>
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Rider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Penjualan</TableHead>
                <TableHead>Setoran</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftHistory.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    {format(new Date(shift.shift_date), "dd/MM/yyyy", { locale: id })}
                  </TableCell>
                  <TableCell>{(shift.profiles as any)?.full_name || 'Unknown Rider'}</TableCell>
                  <TableCell>
                    <Badge variant="default">Terverifikasi</Badge>
                  </TableCell>
                  <TableCell>
                    Rp {shift.total_sales.toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell>
                    Rp {shift.cash_collected.toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <Select>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Detail" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">Lihat Detail</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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