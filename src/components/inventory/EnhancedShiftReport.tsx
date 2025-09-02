import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, ChevronDown, Package, AlertCircle, CalendarIcon, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  branches: {
    name: string;
  };
}

interface GroupedStockReturn {
  reference_id: string;
  transaction_title: string;
  date: string;
  time: string;
  rider_name: string;
  branch_name: string;
  total_items: number;
  items: StockMovement[];
  verification_quantities: Record<string, number>;
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

interface ShiftHistoryItem {
  id: string;
  transaction_id: string;
  created_at: string;
  rider_name: string;
  type: 'stock_return' | 'cash_deposit';
  details: any;
  status: string;
}

interface EnhancedShiftReportProps {
  userProfileId: string;
  branchId: string;
  riders: Record<string, Rider>;
}

export const EnhancedShiftReport = ({ userProfileId, branchId, riders }: EnhancedShiftReportProps) => {
  const [groupedReturns, setGroupedReturns] = useState<GroupedStockReturn[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftHistory, setShiftHistory] = useState<ShiftHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // History filters
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchPendingReturns();
    fetchPendingShifts();
  }, [branchId]);

  const fetchPendingReturns = async () => {
    try {
      const { data, error } = await supabase
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
          profiles!stock_movements_rider_id_fkey(full_name),
          branches!stock_movements_branch_id_fkey(name)
        `)
        .eq('movement_type', 'return')
        .eq('branch_id', branchId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by reference_id
      const grouped: Record<string, GroupedStockReturn> = {};

      data?.forEach((movement) => {
        const refId = movement.reference_id || movement.id;
        const date = new Date(movement.created_at).toLocaleDateString('id-ID');
        const time = new Date(movement.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });

        if (!grouped[refId]) {
          grouped[refId] = {
            reference_id: refId,
            transaction_title: `Return ID: ${refId.slice(-6).toUpperCase()}`,
            date,
            time,
            rider_name: movement.profiles?.full_name || 'Unknown Rider',
            branch_name: movement.branches?.name || 'Unknown Branch',
            total_items: 0,
            items: [],
            verification_quantities: {}
          };
        }

        grouped[refId].items.push(movement);
        grouped[refId].total_items += movement.quantity;
        grouped[refId].verification_quantities[movement.id] = movement.quantity; // Default to expected quantity
      });

      setGroupedReturns(Object.values(grouped));
    } catch (error: any) {
      console.error('Error fetching pending returns:', error);
      toast.error('Gagal memuat data pengembalian stok');
    }
  };

  const fetchPendingShifts = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('shift_management')
        .select('*')
        .eq('branch_id', branchId)
        .eq('shift_date', today)
        .eq('report_submitted', true)
        .eq('report_verified', false);

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      console.error('Error fetching shifts:', error);
      toast.error('Gagal memuat data shift');
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

      // Transform to ShiftHistoryItem format
      const historyItems: ShiftHistoryItem[] = (data || []).map(shift => ({
        id: shift.id,
        transaction_id: `SHIFT-${shift.shift_date}-${shift.shift_number}`,
        created_at: shift.verified_at || shift.shift_date,
        rider_name: (shift.profiles as any)?.full_name || 'Unknown Rider',
        type: 'cash_deposit' as const,
        details: {
          shift_date: shift.shift_date,
          shift_number: shift.shift_number,
          total_sales: shift.total_sales,
          cash_collected: shift.cash_collected,
          verified_by: shift.verified_by
        },
        status: 'verified'
      }));

      setShiftHistory(historyItems);
    } catch (error: any) {
      console.error('Error fetching shift history:', error);
      toast.error('Gagal memuat riwayat shift');
    }
  };

  const updateVerificationQuantity = (refId: string, itemId: string, quantity: number) => {
    setGroupedReturns(prev => prev.map(group => 
      group.reference_id === refId 
        ? {
            ...group,
            verification_quantities: {
              ...group.verification_quantities,
              [itemId]: quantity
            }
          }
        : group
    ));
  };

  const confirmStockReturn = async (refId: string) => {
    const group = groupedReturns.find(g => g.reference_id === refId);
    if (!group) return;

    setLoading(true);
    try {
      // Update each item with verified quantity
      for (const item of group.items) {
        const verifiedQuantity = group.verification_quantities[item.id] || 0;
        
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

      toast.success('Pengembalian stok berhasil dikonfirmasi!');
      await fetchPendingReturns();
    } catch (error: any) {
      console.error('Error confirming stock return:', error);
      toast.error('Gagal konfirmasi pengembalian stok');
    } finally {
      setLoading(false);
    }
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

  const approveCashDeposit = async (shift: Shift) => {
    setLoading(true);
    try {
      await supabase
        .from('shift_management')
        .update({
          report_verified: true,
          verified_by: userProfileId,
          verified_at: new Date().toISOString()
        })
        .eq('id', shift.id);

      toast.success('Setoran tunai berhasil diverifikasi');
      await fetchPendingShifts();
    } catch (error: any) {
      console.error('Error approving cash deposit:', error);
      toast.error('Gagal verifikasi setoran tunai');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stock Returns Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Konfirmasi Pengembalian Barang
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupedReturns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada pengembalian stok yang perlu dikonfirmasi
            </div>
          ) : (
            <div className="space-y-4">
              {groupedReturns.map((group) => (
                <div key={group.reference_id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{group.transaction_title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {group.rider_name} • {group.date} {group.time}
                      </p>
                    </div>
                    <Badge variant="outline">Menunggu Verifikasi</Badge>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-3 bg-muted/30 rounded">
                        {item.verification_photo_url && (
                          <div className="col-span-2">
                            <img
                              src={item.verification_photo_url}
                              alt="Return evidence"
                              className="w-12 h-12 rounded object-cover"
                            />
                          </div>
                        )}
                        <div className={item.verification_photo_url ? "col-span-4" : "col-span-6"}>
                          <p className="font-medium text-sm">{item.products.name}</p>
                          <p className="text-xs text-muted-foreground">{item.products.category}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-xs text-muted-foreground">Tidak Terjual</p>
                          <p className="font-medium">{item.quantity}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-xs text-muted-foreground">Kembali</p>
                          <p className="font-medium">{item.quantity}</p>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Diterima</Label>
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={group.verification_quantities[item.id] || 0}
                            onChange={(e) => updateVerificationQuantity(
                              group.reference_id, 
                              item.id, 
                              parseInt(e.target.value) || 0
                            )}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={() => confirmStockReturn(group.reference_id)}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Terima
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Deposit Section */}
      <Card>
        <CardHeader>
          <CardTitle>Laporan Setoran Tunai</CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada setoran tunai yang perlu diverifikasi
            </div>
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div key={shift.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">
                        Rider: {riders[shift.rider_id]?.full_name || 'Unknown Rider'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(shift.shift_date).toLocaleDateString('id-ID')} • Shift {shift.shift_number}
                      </p>
                    </div>
                    <Badge variant="secondary">Menunggu Verifikasi</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Penjualan</p>
                      <p className="font-medium">
                        {new Intl.NumberFormat('id-ID', { 
                          style: 'currency', 
                          currency: 'IDR', 
                          minimumFractionDigits: 0 
                        }).format(shift.total_sales)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Transaksi</p>
                      <p className="font-medium">{shift.total_transactions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Setoran Tunai</p>
                      <p className="font-medium text-green-600">
                        {new Intl.NumberFormat('id-ID', { 
                          style: 'currency', 
                          currency: 'IDR', 
                          minimumFractionDigits: 0 
                        }).format(shift.cash_collected)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={() => approveCashDeposit(shift)}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Terima Setoran
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shift History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Riwayat Laporan Shift
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-end">
            <div>
              <Label>Filter User:</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Semua User" />
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
              <Label>Tanggal Awal:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Tanggal Akhir:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={fetchShiftHistory} className="bg-primary hover:bg-primary-dark">
              Apply Filter
            </Button>
          </div>

          {/* History Table */}
          <div className="space-y-3">
            {shiftHistory.map((item) => (
              <Card key={item.id} className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="outline" className="mb-1">
                        {item.transaction_id}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('id-ID')} - {item.rider_name}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Verified
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="details" className="border-none">
                      <AccordionTrigger className="text-sm font-medium text-primary hover:text-primary/80 py-2">
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Lihat Detail
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Tanggal Shift:</span>
                            <span className="font-medium">
                              {new Date(item.details.shift_date).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Shift Nomor:</span>
                            <span className="font-medium">{item.details.shift_number}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Penjualan:</span>
                            <span className="font-medium">
                              {new Intl.NumberFormat('id-ID', { 
                                style: 'currency', 
                                currency: 'IDR', 
                                minimumFractionDigits: 0 
                              }).format(item.details.total_sales)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-medium">Setoran Tunai:</span>
                            <span className="font-semibold text-green-600">
                              {new Intl.NumberFormat('id-ID', { 
                                style: 'currency', 
                                currency: 'IDR', 
                                minimumFractionDigits: 0 
                              }).format(item.details.cash_collected)}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
            {shiftHistory.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada riwayat ditemukan untuk filter yang dipilih
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};