import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EnhancedShiftReport } from "@/components/inventory/EnhancedShiftReport";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, CheckCircle, Search, ChevronDown, Upload, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product { id: string; name: string; category: string; code: string; cost_price?: number; }
interface HubInventory { product_id: string; stock_quantity: number; product?: Product }
interface RiderInventory extends HubInventory { rider_id: string }
interface ReturnMovement { id: string; rider_id: string; product_id: string; quantity: number; status: string; verification_photo_url?: string; created_at: string; product?: Product }
interface Rider { id: string; full_name: string }

interface StockAdjustmentItem {
  product_id: string;
  product?: Product;
  system_stock: number;
  real_stock: number;
  variance: number;
  unit_value: number;
  total_value: number;
}

interface StockOpnameHistory {
  id: string;
  transaction_id: string;
  created_at: string;
  total_variance: number;
  total_value: number;
  items: StockAdjustmentItem[];
  created_by?: string;
  notes?: string;
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

interface TransferHistoryItem {
  id: string;
  product_id: string;
  product?: { id: string; name: string; category: string; price?: number };
  quantity: number;
  movement_type: 'transfer' | 'return';
  created_at: string;
  status: string;
  item_value?: number;
}

interface TransferHistoryGroup {
  id: string;
  transaction_id: string;
  created_at: string;
  status: string;
  rider_id?: string;
  branch_id?: string;
  total_quantity: number;
  total_value?: number;
  rider_name?: string;
  branch_name?: string;
  branch_type?: string;
  items: TransferHistoryItem[];
}

export default function Inventory() {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("stock");
  const [hubInventory, setHubInventory] = useState<HubInventory[]>([]);
  const [riderInventory, setRiderInventory] = useState<RiderInventory[]>([]);
  const [riders, setRiders] = useState<Record<string, Rider>>({});
  const [returns, setReturns] = useState<ReturnMovement[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Add missing state variables for date filters and transfer history
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [transferHistory, setTransferHistory] = useState<TransferHistoryGroup[]>([]);
  
  // Inventory adjustment states
  const [stockAdjustmentItems, setStockAdjustmentItems] = useState<StockAdjustmentItem[]>([]);
  const [stockOpnameHistory, setStockOpnameHistory] = useState<StockOpnameHistory[]>([]);
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  useEffect(() => {
    document.title = 'Inventori | Zeger ERP';
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Hub inventory (branch, rider null)
      const { data: hub } = await supabase
        .from('inventory')
        .select('stock_quantity, product_id, products(id, name, category, code, cost_price)')
        .eq('branch_id', userProfile!.branch_id)
        .is('rider_id', null);
      setHubInventory((hub || []).map(i => ({ product_id: i.product_id, stock_quantity: i.stock_quantity, product: (i as any).products })));
      
      // Initialize stock adjustment items from hub inventory
      const adjustmentItems: StockAdjustmentItem[] = (hub || []).map(i => ({
        product_id: i.product_id,
        product: (i as any).products,
        system_stock: i.stock_quantity,
        real_stock: i.stock_quantity,
        variance: 0,
        unit_value: (i as any).products?.cost_price || 0,
        total_value: 0
      }));
      setStockAdjustmentItems(adjustmentItems);

      // Rider inventory in branch
      const { data: riderInv } = await supabase
        .from('inventory')
        .select('stock_quantity, product_id, rider_id, products(id, name, category, code, cost_price)')
        .eq('branch_id', userProfile!.branch_id)
        .not('rider_id', 'is', null);
      setRiderInventory((riderInv || []).map(i => ({ product_id: i.product_id, stock_quantity: i.stock_quantity, rider_id: (i as any).rider_id, product: (i as any).products })));

      // Pending returns (needed before building riders map)
      const { data: ret } = await supabase
        .from('stock_movements')
        .select('id, rider_id, product_id, quantity, status, verification_photo_url, created_at, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .eq('movement_type', 'return')
        .in('status', ['pending', 'returned'])
        .order('created_at', { ascending: false });
      setReturns((ret || []).map(r => ({ ...r, product: (r as any).products })) as any);

      // Riders map - filter to only riders from current branch
      const { data: riderProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, branch_id')
        .in('role', ['rider', 'sb_rider', 'bh_rider'])
        .eq('is_active', true)
        .eq('branch_id', userProfile!.branch_id);
      const map: Record<string, Rider> = {};
      (riderProfiles || []).forEach(r => { map[r.id] = r as Rider; });
      
      // Only include riders from current branch's inventory/returns
      const currentBranchRiderIds = new Set([
        ...Object.keys(map),
        ...(riderInv || [])
          .filter((i: any) => map[i.rider_id]) // Only riders from current branch
          .map((i: any) => i.rider_id),
        ...(ret || [])
          .filter((r: any) => map[r.rider_id]) // Only riders from current branch
          .map((r: any) => r.rider_id)
      ]);
      
      // Build final map with only current branch riders
      const finalMap: Record<string, Rider> = {};
      currentBranchRiderIds.forEach(riderId => {
        if (map[riderId]) {
          finalMap[riderId] = map[riderId];
        }
      });
      
      setRiders(finalMap);

      // Shifts waiting verification - use Jakarta timezone
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const { data: sh, error: shiftError } = await supabase
        .from('shift_management')
        .select('id, rider_id, shift_date, shift_number, shift_start_time, shift_end_time, total_sales, cash_collected, total_transactions, report_submitted, report_verified, notes')
        .eq('branch_id', userProfile!.branch_id)
        .eq('shift_date', today)
        .eq('report_submitted', true)
        .eq('report_verified', false);
      
      if (shiftError) {
        console.error('Error fetching shifts:', shiftError);
        setShifts([]);
      } else {
        setShifts(sh || []);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Gagal memuat data inventory');
    }
  };

  const updateStockAdjustmentItem = (index: number, field: keyof StockAdjustmentItem, value: any) => {
    const updatedItems = [...stockAdjustmentItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate variance and total value
    const item = updatedItems[index];
    item.variance = item.real_stock - item.system_stock;
    item.total_value = Math.abs(item.variance) * item.unit_value;
    
    setStockAdjustmentItems(updatedItems);
  };

  const saveStockOpname = async () => {
    if (!userProfile) return;
    setLoading(true);
    
    try {
      const totalVariance = stockAdjustmentItems.reduce((sum, item) => sum + Math.abs(item.variance), 0);
      const totalValue = stockAdjustmentItems.reduce((sum, item) => sum + item.total_value, 0);
      
      const jakartaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const transactionId = `SO-${jakartaToday.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      
      const opnameRecord: StockOpnameHistory = {
        id: crypto.randomUUID(),
        transaction_id: transactionId,
        created_at: new Date().toISOString(),
        total_variance: totalVariance,
        total_value: totalValue,
        items: stockAdjustmentItems.filter(item => item.variance !== 0),
        created_by: userProfile.full_name,
        notes: adjustmentNotes
      };
      
      setStockOpnameHistory(prev => [opnameRecord, ...prev]);
      toast.success('Stock opname berhasil disimpan');
      setAdjustmentNotes("");
    } catch (error) {
      toast.error('Gagal menyimpan stock opname');
    } finally {
      setLoading(false);
    }
  };

  const hubTotal = useMemo(() => hubInventory.reduce((s,i)=>s + i.stock_quantity,0), [hubInventory]);
  const riderTotalsByRider = useMemo(() => {
    const m: Record<string, number> = {};
    riderInventory.forEach(i => { m[i.rider_id] = (m[i.rider_id]||0)+ i.stock_quantity; });
    return m;
  }, [riderInventory]);

  const approveReturn = async (movement: ReturnMovement) => {
    if (!userProfile) return;
    setLoading(true);
    try {
      // Approve movement
      await supabase.from('stock_movements').update({ status: 'approved', actual_delivery_date: new Date().toISOString(), notes: 'Return disetujui branch' }).eq('id', movement.id);

      // Decrease rider inventory
      const { data: riderInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('rider_id', movement.rider_id)
        .eq('product_id', movement.product_id)
        .maybeSingle();
      if (riderInv) {
        await supabase.from('inventory').update({ stock_quantity: Math.max(0, riderInv.stock_quantity - movement.quantity), last_updated: new Date().toISOString() }).eq('id', riderInv.id);
      }
      // Increase hub inventory
      const { data: hubInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', userProfile.branch_id)
        .eq('product_id', movement.product_id)
        .is('rider_id', null)
        .maybeSingle();
      if (hubInv) {
        await supabase.from('inventory').update({ stock_quantity: hubInv.stock_quantity + movement.quantity, last_updated: new Date().toISOString() }).eq('id', hubInv.id);
      } else {
        await supabase.from('inventory').insert([{ branch_id: userProfile.branch_id, product_id: movement.product_id, stock_quantity: movement.quantity }]);
      }
      toast.success('Pengembalian stok disetujui');
      fetchData();
    } catch (e: any) {
      toast.error('Gagal menyetujui: ' + e.message);
    } finally { setLoading(false); }
  };

  const approveCashDeposit = async (shift: Shift) => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const jakartaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const start = shift.shift_start_time || `${jakartaToday}T00:00:00+07:00`;
      const end = shift.shift_end_time || new Date().toISOString();

      const { data: tx } = await supabase
        .from('transactions')
        .select('final_amount, payment_method')
        .eq('branch_id', userProfile.branch_id)
        .eq('rider_id', shift.rider_id)
        .gte('transaction_date', start)
        .lte('transaction_date', end);
      const cash = (tx||[]).filter(t => (t.payment_method||'').toLowerCase() === 'cash').reduce((s,t:any)=> s + Number(t.final_amount||0), 0);

      // Create financial transaction record
      await supabase.from('financial_transactions').insert([{
        transaction_type: 'asset',
        account_type: 'cash',
        amount: cash,
        description: `Shift cash deposit for shift ${shift.id}`,
        branch_id: userProfile.branch_id,
        created_by: userProfile.id,
        reference_number: `SHIFT-${shift.id}`
      }]);

      // Mark shift verified
      await supabase
        .from('shift_management')
        .update({ report_verified: true, verified_by: userProfile.id, verified_at: new Date().toISOString(), cash_collected: cash })
        .eq('id', shift.id);

      toast.success('Setoran tunai diterima');
      fetchData();
    } catch (e: any) {
      toast.error('Gagal konfirmasi setoran: ' + e.message);
    } finally { setLoading(false); }
  };

  const fetchTransferHistory = async () => {
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          products!inner(id, name, category, price),
          profiles!stock_movements_rider_id_fkey(id, full_name),
          branches!stock_movements_branch_id_fkey(id, name, branch_type)
        `)
        .eq('branch_id', userProfile!.branch_id)
        .in('movement_type', ['transfer', 'return'])
        .gte('created_at', `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(startDate)}T00:00:00+07:00`)
        .lte('created_at', `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(endDate)}T23:59:59+07:00`)
        .order('created_at', { ascending: false });

      if (selectedUser !== "all") {
        query = query.eq('rider_id', selectedUser);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group transfers by reference_id for better organization
      const groupedTransfers: Record<string, TransferHistoryGroup> = {};
      
      data?.forEach((transfer) => {
        const date = transfer.created_at.split('T')[0];
        const groupKey = transfer.reference_id || `single_${transfer.id}`;
        
        if (!groupedTransfers[groupKey]) {
          groupedTransfers[groupKey] = {
            id: groupKey,
            transaction_id: transfer.reference_id || `TRF-${date.replace(/-/g, '')}-${transfer.id.slice(-4).toUpperCase()}`,
            created_at: transfer.created_at,
            status: transfer.status,
            rider_id: transfer.rider_id,
            branch_id: transfer.branch_id,
            total_quantity: 0,
            total_value: 0,
            rider_name: transfer.profiles?.full_name || 'Unknown Rider',
            branch_name: transfer.branches?.name || 'Branch Hub',
            branch_type: transfer.branches?.branch_type || 'hub',
            items: []
          };
        }
        
        const itemValue = (transfer.products?.price || 0) * transfer.quantity;
        groupedTransfers[groupKey].items.push({
          id: transfer.id,
          product_id: transfer.product_id,
          quantity: transfer.quantity,
          movement_type: transfer.movement_type as 'transfer' | 'return',
          created_at: transfer.created_at,
          status: transfer.status,
          item_value: itemValue,
          product: transfer.products
        });
        groupedTransfers[groupKey].total_quantity += transfer.quantity;
        groupedTransfers[groupKey].total_value = (groupedTransfers[groupKey].total_value || 0) + itemValue;
      });

      const sortedGroups = Object.values(groupedTransfers).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransferHistory(sortedGroups);
    } catch (error) {
      console.error('Error fetching transfer history:', error);
      toast.error('Gagal memuat riwayat transfer');
    }
  };

  if (!userProfile) return null;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inventori</h1>
        <p className="text-sm text-muted-foreground">Pantau stok per cabang / rider.</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stock">Stok Management</TabsTrigger>
          <TabsTrigger value="adjustment">Inventory Adjustment</TabsTrigger>
          <TabsTrigger value="laporan">Laporan Shift</TabsTrigger>
          <TabsTrigger value="transfer-history">Riwayat Transfer Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Stok Branch Hub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Total stok</p>
                  <p className="text-2xl font-bold">{hubTotal}</p>
                </div>
                <Accordion type="single" collapsible className="w-full" defaultValue="hub-detail">
                  <AccordionItem value="hub-detail">
                    <AccordionTrigger>Detail Menu</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {[...hubInventory]
                          .sort((a, b) => b.stock_quantity - a.stock_quantity)
                          .map((i, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span>{i.product?.name}</span>
                              <Badge variant="outline">{i.stock_quantity}</Badge>
                            </div>
                          ))}
                        {hubInventory.length === 0 && (
                          <p className="text-sm text-muted-foreground">Belum ada stok</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Stok Rider</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {/* Show all active riders with their stock status */}
                  {Object.keys(riders).sort((a, b) => {
                    const nameA = riders[a]?.full_name || '';
                    const nameB = riders[b]?.full_name || '';
                    return nameA.localeCompare(nameB);
                  }).map(rid => (
                    <AccordionItem key={rid} value={rid}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full">
                          <span>{riders[rid]?.full_name || `Rider ${rid}`}</span>
                          <Badge variant="secondary">{riderTotalsByRider[rid] || 0} item</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {riderInventory.filter(i => i.rider_id === rid).map((i, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span>{i.product?.name}</span>
                              <Badge variant="outline">{i.stock_quantity}</Badge>
                            </div>
                          ))}
                          {riderInventory.filter(i => i.rider_id === rid).length === 0 && (
                            <p className="text-sm text-muted-foreground">Tidak ada stok</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  {Object.keys(riders).length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada rider ditemukan</p>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="adjustment">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="text-lg">Stock Opname Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters and Controls */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="category" className="text-sm">Product Category</Label>
                  <Select defaultValue="all">
                    <SelectTrigger className="h-9 text-sm rounded-full">
                      <SelectValue placeholder="- All -" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">- All -</SelectItem>
                      <SelectItem value="makanan">Makanan</SelectItem>
                      <SelectItem value="minuman">Minuman</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="subcategory" className="text-sm">Product Sub Category</Label>
                  <Select defaultValue="all">
                    <SelectTrigger className="h-9 text-sm rounded-full">
                      <SelectValue placeholder="- All -" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">- All -</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm opacity-0">Export</Label>
                  <Button className="w-full h-9 text-sm rounded-full bg-teal-600 hover:bg-teal-700 text-white">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="file" className="text-sm">File Upload</Label>
                  <Button variant="outline" className="w-full h-9 text-sm rounded-full bg-teal-600 hover:bg-teal-700 text-white border-teal-600">
                    <Upload className="h-4 w-4 mr-1" />
                    Browse ...
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm opacity-0">Upload</Label>
                  <Button className="w-full h-9 text-sm rounded-full bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </div>
              </div>

              {/* Stock Opname Table */}
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="px-3 py-2 text-left text-sm font-medium">Product Name</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Product Code</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Unit</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Stock</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Current Stock</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Estimated Value per Unit (IDR)</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Estimated Total (IDR)</th>
                        <th className="px-3 py-2 text-center text-sm font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockAdjustmentItems.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <div className="text-sm font-medium">{item.product?.name || 'Unknown Product'}</div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="text-sm">{item.product?.code || 'N/A'}</div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="text"
                              defaultValue="pcs"
                              className="w-20 h-8 text-xs text-center rounded-full"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              value={item.system_stock}
                              className="w-20 h-8 text-xs text-center rounded-full bg-muted"
                              readOnly
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              value={item.real_stock}
                              onChange={(e) => updateStockAdjustmentItem(index, 'real_stock', parseInt(e.target.value) || 0)}
                              className="w-20 h-8 text-xs text-center rounded-full"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              value={item.unit_value}
                              onChange={(e) => updateStockAdjustmentItem(index, 'unit_value', parseFloat(e.target.value) || 0)}
                              className="w-24 h-8 text-xs text-center rounded-full"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="text-sm font-medium">
                              {new Intl.NumberFormat('id-ID').format(item.total_value)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button variant="destructive" size="sm" className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 text-white">
                              ✕
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {stockAdjustmentItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            Tidak ada data inventory
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transaction Summary and Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold bg-muted/30 p-2 rounded-full">Transaction Summary</h3>
                  <div className="space-y-2">
                    <Label htmlFor="additional-info" className="text-sm">Additional Information</Label>
                    <textarea
                      id="additional-info"
                      value={adjustmentNotes}
                      onChange={(e) => setAdjustmentNotes(e.target.value)}
                      className="w-full h-24 p-2 text-sm border rounded-lg resize-none"
                      placeholder="Enter additional information..."
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <h3 className="text-sm font-semibold mb-1">Estimated Stock Opname Total</h3>
                    <div className="text-right text-lg font-bold">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
                        stockAdjustmentItems.reduce((sum, item) => sum + item.total_value, 0)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  className="rounded-full text-sm"
                  disabled={loading}
                >
                  📋 Save as Draft
                </Button>
                <Button 
                  className="rounded-full text-sm bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={saveStockOpname}
                  disabled={loading}
                >
                  💾 Save
                </Button>
                <Button 
                  variant="destructive" 
                  className="rounded-full text-sm bg-red-500 hover:bg-red-600 text-white"
                >
                  ✕ Cancel
                </Button>
              </div>

              {/* Stock Opname History */}
              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-semibold">Riwayat Stock Opname</h3>
                <div className="space-y-3">
                  {stockOpnameHistory.map((record) => (
                    <Card key={record.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{record.transaction_id}</span>
                            <Badge variant="outline" className="text-xs">
                              {new Date(record.created_at).toLocaleDateString('id-ID')}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {new Date(record.created_at).toLocaleTimeString('id-ID')}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Total Variance: {record.total_variance} items • Value: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(record.total_value)}
                          </div>
                        </div>
                        <Accordion type="single" collapsible>
                          <AccordionItem value="details" className="border-none">
                            <AccordionTrigger className="py-0 hover:no-underline">
                              <Button variant="outline" size="sm" className="rounded-full text-xs">
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Details
                              </Button>
                            </AccordionTrigger>
                            <AccordionContent className="pt-3">
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">
                                  <strong>Created by:</strong> {record.created_by}
                                </div>
                                {record.notes && (
                                  <div className="text-xs text-muted-foreground">
                                    <strong>Notes:</strong> {record.notes}
                                  </div>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/20">
                                        <th className="px-2 py-1 text-left">Product</th>
                                        <th className="px-2 py-1 text-center">System</th>
                                        <th className="px-2 py-1 text-center">Real</th>
                                        <th className="px-2 py-1 text-center">Variance</th>
                                        <th className="px-2 py-1 text-center">Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {record.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="px-2 py-1">{item.product?.name}</td>
                                          <td className="px-2 py-1 text-center">{item.system_stock}</td>
                                          <td className="px-2 py-1 text-center">{item.real_stock}</td>
                                          <td className="px-2 py-1 text-center font-medium">
                                            {item.variance > 0 ? '+' : ''}{item.variance}
                                          </td>
                                          <td className="px-2 py-1 text-center">
                                            {new Intl.NumberFormat('id-ID').format(item.total_value)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    </Card>
                  ))}
                  {stockOpnameHistory.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Belum ada riwayat stock opname
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laporan">
          <EnhancedShiftReport 
            userProfileId={userProfile?.id || ''}
            branchId={userProfile?.branch_id || ''}
            riders={riders}
          />
        </TabsContent>
        <TabsContent value="transfer-history">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Riwayat Transfer Stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
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
                      <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Button onClick={fetchTransferHistory} className="bg-primary hover:bg-primary-dark">
                    Apply Filter
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {transferHistory.map((transferGroup) => (
                  <Card key={transferGroup.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {transferGroup.transaction_id}
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {new Date(transferGroup.created_at).toLocaleDateString('id-ID')} - 
                            {transferGroup.items.length} item(s)
                          </p>
                          <p className="text-sm font-medium text-blue-600">
                            {transferGroup.branch_name} → {transferGroup.rider_name || 'Branch Tujuan'}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={
                              transferGroup.status === 'received' ? 'default' :
                              transferGroup.status === 'sent' ? 'secondary' : 'outline'
                            }
                            className={
                              transferGroup.status === 'received' ? 'bg-green-100 text-green-800' :
                              transferGroup.status === 'sent' ? 'bg-blue-100 text-blue-800' : ''
                            }
                          >
                            {transferGroup.status === 'received' ? 'Diterima' :
                             transferGroup.status === 'sent' ? 'Dikirim' : transferGroup.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Total: {transferGroup.total_quantity} unit
                          </p>
                          {transferGroup.total_value && transferGroup.total_value > 0 && (
                            <p className="text-xs font-medium text-green-600">
                              Nilai: Rp {transferGroup.total_value.toLocaleString('id-ID')}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="details" className="border-none">
                          <AccordionTrigger className="text-sm font-medium text-primary hover:text-primary/80 py-2">
                            Lihat Detail Item
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                            <div className="space-y-2 text-sm">
                              {transferGroup.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-center py-3 border-b last:border-b-0">
                                  <div className="flex-1">
                                    <span className="font-medium">{item.product?.name || 'Unknown Product'}</span>
                                    <p className="text-xs text-muted-foreground">{item.product?.category}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">{item.quantity} unit</p>
                                    {item.item_value && item.item_value > 0 && (
                                      <p className="text-xs text-green-600 font-medium">
                                        Rp {item.item_value.toLocaleString('id-ID')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
                {transferHistory.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    Tidak ada riwayat transfer ditemukan
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
