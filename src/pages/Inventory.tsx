import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, CheckCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product { id: string; name: string; category: string; }
interface HubInventory { product_id: string; stock_quantity: number; product?: Product }
interface RiderInventory extends HubInventory { rider_id: string }
interface ReturnMovement { id: string; rider_id: string; product_id: string; quantity: number; status: string; verification_photo_url?: string; created_at: string; product?: Product }
interface Rider { id: string; full_name: string }
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
  const { userProfile } = useAuth();
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
        .select('stock_quantity, product_id, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .is('rider_id', null);
      setHubInventory((hub || []).map(i => ({ product_id: i.product_id, stock_quantity: i.stock_quantity, product: (i as any).products })));

      // Rider inventory in branch
      const { data: riderInv } = await supabase
        .from('inventory')
        .select('stock_quantity, product_id, rider_id, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .not('rider_id', 'is', null);
      setRiderInventory((riderInv || []).map(i => ({ product_id: i.product_id, stock_quantity: i.stock_quantity, rider_id: (i as any).rider_id, product: (i as any).products })));

      // Riders map
      const { data: riderProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('branch_id', userProfile!.branch_id)
        .eq('role', 'rider');
      const map: Record<string, Rider> = {};
      (riderProfiles || []).forEach(r => { map[r.id] = r as Rider; });
      setRiders(map);

      // Pending returns
      const { data: ret } = await supabase
        .from('stock_movements')
        .select('id, rider_id, product_id, quantity, status, verification_photo_url, created_at, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .eq('movement_type', 'return')
        .in('status', ['pending', 'returned'])
        .order('created_at', { ascending: false });
      setReturns((ret || []).map(r => ({ ...r, product: (r as any).products })) as any);

      // Shifts waiting verification
      const today = new Date().toISOString().split('T')[0];
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
      const today = new Date().toISOString().split('T')[0];
      const start = shift.shift_start_time || `${today}T00:00:00`;
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
        .gte('created_at', startDate.toISOString().split('T')[0])
        .lte('created_at', endDate.toISOString().split('T')[0] + 'T23:59:59')
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stock">Stok Management</TabsTrigger>
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
                  {Object.keys(riderTotalsByRider).map(rid => (
                    <AccordionItem key={rid} value={rid}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full">
                          <span>{riders[rid]?.full_name || rid}</span>
                          <Badge variant="secondary">{riderTotalsByRider[rid]} item</Badge>
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
                  {Object.keys(riderTotalsByRider).length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada stok rider</p>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="laporan">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Konfirmasi Pengembalian Stok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {returns.map(ret => (
                  <div key={ret.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{ret.product?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Rider: {riders[ret.rider_id]?.full_name || ret.rider_id} • Qty {ret.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ret.created_at).toLocaleDateString('id-ID')} {new Date(ret.created_at).toLocaleTimeString('id-ID')}
                        </p>
                      </div>
                      <Badge variant="outline">{ret.status}</Badge>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="details">
                        <AccordionTrigger className="text-sm">Lihat Rincian</AccordionTrigger>
                        <AccordionContent className="space-y-2">
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>Produk:</span>
                              <span className="font-medium">{ret.product?.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Kategori:</span>
                              <span className="font-medium">{ret.product?.category || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Jumlah:</span>
                              <span className="font-medium">{ret.quantity} item</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <Badge variant="outline">{ret.status}</Badge>
                            </div>
                          </div>
                          {ret.verification_photo_url && (
                            <div className="mt-2">
                              <p className="text-xs font-medium mb-1">Foto Verifikasi:</p>
                              <img src={ret.verification_photo_url} alt="Foto verifikasi pengembalian" className="w-full max-w-xs rounded border" />
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    
                    <div className="flex items-center gap-2">
                      <Button size="sm" disabled={loading} onClick={() => approveReturn(ret)}>
                        Terima
                      </Button>
                    </div>
                  </div>
                ))}
                {returns.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pengembalian menunggu persetujuan</p>}
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Penerimaan Setoran Tunai</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {shifts.map(s => {
                  const riderCashPhoto = s.notes?.includes('Cash deposit photo:') ? s.notes.split('Cash deposit photo: ')[1] : null;
                  return (
                    <div key={s.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Rider: {riders[s.rider_id]?.full_name || s.rider_id}</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.shift_date).toLocaleDateString('id-ID')} • Shift {s.shift_number}
                          </p>
                        </div>
                        <Badge variant="secondary">Butuh verifikasi</Badge>
                      </div>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="details">
                          <AccordionTrigger className="text-sm">Lihat Rincian</AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Total Penjualan:</span>
                                <span className="font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.total_sales)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Transaksi:</span>
                                <span className="font-medium">{s.total_transactions}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1">
                                <span className="font-medium">Total Setoran Tunai:</span>
                                <span className="font-semibold text-green-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.cash_collected)}</span>
                              </div>
                            </div>
                            {riderCashPhoto && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">Foto Setoran dari Rider:</p>
                                <img src={riderCashPhoto} alt="Foto setoran tunai" className="w-full max-w-xs rounded border" />
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      
                      <div className="flex items-center gap-2">
                        <Button size="sm" disabled={loading} onClick={() => approveCashDeposit(s)}>
                          Terima
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {shifts.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada shift menunggu verifikasi</p>}
              </CardContent>
            </Card>
          </div>
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
