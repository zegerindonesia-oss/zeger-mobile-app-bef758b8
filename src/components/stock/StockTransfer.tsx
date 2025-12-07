import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams } from "react-router-dom";
import { 
  Package, 
  Send, 
  Check, 
  Clock,
  AlertCircle,
  Camera,
  Upload,
  CheckCircle,
  ChevronDown,
  Search,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserRole } from "@/lib/types";

interface StockTransferProps {
  role: UserRole;
  userId: string;
  branchId?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
}

interface StockTransferItem {
  id: string;
  product_id: string;
  product?: Product & { price?: number };
  quantity: number;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment' | 'return';
  created_at: string;
  branch_id?: string;
  rider_id?: string;
  notes?: string;
  status: string;
  verification_photo_url?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  reference_id?: string;
  item_value?: number;
  profiles?: { full_name: string };
  branches?: { name: string; branch_type: string };
}

interface StockTransferGroup {
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
  movement_type?: string;
  items: StockTransferItem[];
}

interface Rider {
  id: string;
  full_name: string;
  branch_id: string;
  branches?: {
    name: string;
    code?: string;
    branch_code?: string;
  };
}

interface ShiftInfo {
  id: string;
  status: string;
  report_submitted: boolean;
  shift_start_time: string;
  shift_end_time?: string;
}

export const StockTransfer = ({ role, userId, branchId }: StockTransferProps) => {
  const [transfers, setTransfers] = useState<StockTransferGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [selectedRider, setSelectedRider] = useState("");
  const [selectedToBranch, setSelectedToBranch] = useState("");
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [riderShifts, setRiderShifts] = useState<Record<string, ShiftInfo>>({});
  const [activeShift, setActiveShift] = useState<ShiftInfo | null>(null);
  const [historyType, setHistoryType] = useState<'transfer' | 'return'>('transfer');
  const [filterType, setFilterType] = useState<'sent' | 'received' | 'all'>('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasPendingShifts, setHasPendingShifts] = useState(false);
  const [pendingShiftsCount, setPendingShiftsCount] = useState(0);
  
  // New filter states
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Product filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Espresso Based",
    "Milk Based", 
    "Refresher",
    "Botol 200ml",
    "Botol 1 Liter"
  ]);

  const getJakartaNow = () => {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  };
  
  const formatYMD = (d: Date) => {
    const jakartaDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const y = jakartaDate.getFullYear();
    const m = String(jakartaDate.getMonth() + 1).padStart(2, '0');
    const day = String(jakartaDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Helper functions for dynamic styling based on movement type
  const getTransferCardStyle = (movementType: string) => {
    return movementType === 'return'
      ? 'border-l-4 border-l-destructive shadow-lg shadow-destructive/10' 
      : 'border-l-4 border-l-success shadow-lg shadow-success/10';
  };

  const getTransferHeaderStyle = (movementType: string) => {
    return movementType === 'return'
      ? 'bg-destructive/5 border-destructive/20'
      : 'bg-success/5 border-success/20';
  };

  const getTransferTextStyle = (movementType: string) => {
    return movementType === 'return'
      ? 'text-destructive'
      : 'text-success';
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [historyType, selectedUserFilter, dateRangeFilter, customStartDate, customEndDate]);

  const fetchData = async () => {
    try {
      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('is_active', true);
      setProducts(productsData || []);

      // Fetch riders - filter by branch for branch managers
      console.log('Fetching riders for role:', role, 'branchId:', branchId);
      let ridersQuery = supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          branch_id,
          branches(name, code, branch_code)
        `)
        .in('role', ['rider', 'sb_rider', 'bh_rider'])
        .eq('is_active', true)
        .not('branch_id', 'is', null);

      // Filter by branch for branch managers and small branch managers
      if ((role === 'branch_manager' || role === 'sb_branch_manager') && branchId) {
        // Both branch managers and small branch managers only see riders from their own branch
        // Small branches (like Zeger Coffee Malang, Zeger Coffee Graha Kota) are separate entities
        ridersQuery = ridersQuery.eq('branch_id', branchId);
        console.log('Filtering riders for branch_id:', branchId, 'role:', role);
      }

      const { data: ridersData, error: ridersError } = await ridersQuery.order('full_name');
      
      if (ridersError) {
        console.error('Error fetching riders:', ridersError);
        toast.error('Failed to load riders');
        return;
      }
      
      console.log(`✅ Fetched ${ridersData?.length || 0} riders for role: ${role}, branch: ${branchId}`);
      setRiders(ridersData || []);

      // Fetch branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, branch_type')
        .eq('is_active', true);
      setBranches(branchesData || []);

      // Fetch rider shift statuses
      await fetchRiderShifts();
      
      // Check for pending shift reports
      await checkPendingShifts();

      // Fetch active shift for current rider if role is rider
      if (['rider', 'sb_rider', 'bh_rider'].includes(role)) {
        await fetchActiveShift();
      }

      // Fetch stock movements/transfers
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal memuat data");
    }
  };

  const checkPendingShifts = async () => {
    if (!branchId) return;
    
    try {
      const { data, error } = await supabase
        .from('shift_management')
        .select('id, rider_id, shift_date, profiles!inner(full_name)')
        .eq('branch_id', branchId)
        .eq('report_submitted', true)
        .eq('report_verified', false);
      
      if (error) throw error;
      
      const hasPending = (data?.length || 0) > 0;
      setHasPendingShifts(hasPending);
      setPendingShiftsCount(data?.length || 0);
      
      if (hasPending) {
        console.log('⚠️ Found', data?.length, 'pending shift reports');
      }
    } catch (error: any) {
      console.error("Error checking pending shifts:", error);
    }
  };

  const fetchRiderShifts = async () => {
    try {
      // Fetch rider shift statuses using Jakarta timezone
      const jakartaToday = formatYMD(getJakartaNow());
      const { data: shifts } = await supabase
        .from('shift_management')
        .select('rider_id, status, report_submitted, shift_start_time, shift_end_time')
        .eq('shift_date', jakartaToday);

      const shiftMap: Record<string, ShiftInfo> = {};
      shifts?.forEach(shift => {
        shiftMap[shift.rider_id] = {
          id: shift.rider_id,
          status: shift.status,
          report_submitted: shift.report_submitted,
          shift_start_time: shift.shift_start_time,
          shift_end_time: shift.shift_end_time
        };
      });
      setRiderShifts(shiftMap);
    } catch (error: any) {
      console.error("Error fetching rider shifts:", error);
    }
  };

  const fetchActiveShift = async () => {
    try {
      // Fetch active shift for current rider if role is rider using Jakarta timezone
      const jakartaToday = formatYMD(getJakartaNow());
      const { data: shift } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', userId)
        .eq('shift_date', jakartaToday)
        .eq('status', 'active')
        .maybeSingle();

      setActiveShift(shift || null);
    } catch (error: any) {
      console.error("Error fetching active shift:", error);
    }
  };

  const getDateRangeFilter = () => {
    const jakartaNow = getJakartaNow();
    let startDate: string, endDate: string;
    
    switch (dateRangeFilter) {
      case 'today':
        startDate = formatYMD(jakartaNow);
        endDate = formatYMD(jakartaNow);
        break;
      case 'yesterday':
        const yesterday = new Date(jakartaNow);
        yesterday.setDate(jakartaNow.getDate() - 1);
        startDate = formatYMD(yesterday);
        endDate = formatYMD(yesterday);
        break;
      case 'this_week':
        const weekStart = new Date(jakartaNow);
        weekStart.setDate(jakartaNow.getDate() - jakartaNow.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        startDate = formatYMD(weekStart);
        endDate = formatYMD(weekEnd);
        break;
      case 'this_month':
        const monthStart = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 1);
        const monthEnd = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() + 1, 0);
        startDate = formatYMD(monthStart);
        endDate = formatYMD(monthEnd);
        break;
      case 'custom':
        startDate = customStartDate || formatYMD(jakartaNow);
        endDate = customEndDate || formatYMD(jakartaNow);
        break;
      default:
        startDate = formatYMD(jakartaNow);
        endDate = formatYMD(jakartaNow);
    }
    
    return { startDate, endDate };
  };

  const fetchTransfers = async () => {
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          products!inner(id, name, category, price),
          profiles!stock_movements_rider_id_fkey(id, full_name),
          branches!stock_movements_branch_id_fkey(id, name, branch_type)
        `)
        .eq('movement_type', historyType)
        .order('created_at', { ascending: false });
      
      // Apply filter by status if not 'all'
      if (filterType !== 'all') {
        query = query.eq('status', filterType);
      }

      // Apply date range filter
      const { startDate, endDate } = getDateRangeFilter();
      query = query.gte('created_at', `${startDate}T00:00:00+07:00`)
                   .lte('created_at', `${endDate}T23:59:59+07:00`);

      // Apply user filter
      if (selectedUserFilter !== 'all') {
        query = query.eq('rider_id', selectedUserFilter);
      }

      if ((role === 'branch_manager' || role === 'sb_branch_manager') && branchId) {
        query = query.eq('branch_id', branchId);
      } else if (['rider', 'sb_rider', 'bh_rider'].includes(role)) {
        query = query.eq('rider_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group transfers by reference_id for better organization with improved labeling
      const groupedTransfers: Record<string, StockTransferGroup> = {};
      
      data?.forEach((transfer) => {
        const date = transfer.created_at.split('T')[0];
        const time = new Date(transfer.created_at).toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const groupKey = transfer.reference_id || `single_${transfer.id}`;
        
        if (!groupedTransfers[groupKey]) {
          const riderName = transfer.profiles?.full_name || 'Unknown Rider';
          const branchName = transfer.branches?.name || 'Unknown Branch';
          
          // Create descriptive transaction titles based on movement_type
          const isReturn = transfer.movement_type === 'return';
          const transactionTitle = isReturn 
            ? `Pengembalian Stok - ${riderName} → ${branchName} ${date} ${time}`
            : `Pengiriman Stok - ${branchName} → ${riderName} ${date} ${time}`;
          
          groupedTransfers[groupKey] = {
            id: groupKey,
            transaction_id: transactionTitle,
            created_at: transfer.created_at,
            status: transfer.status,
            rider_id: transfer.rider_id,
            branch_id: transfer.branch_id,
            total_quantity: 0,
            total_value: 0,
            rider_name: riderName,
            branch_name: branchName,
            branch_type: transfer.branches?.branch_type || 'hub',
            movement_type: transfer.movement_type,
            items: []
          };
        }
        
        const itemValue = (transfer.products?.price || 0) * transfer.quantity;
        groupedTransfers[groupKey].items.push({
          ...transfer,
          item_value: itemValue,
          product: transfer.products
        });
        groupedTransfers[groupKey].total_quantity += transfer.quantity;
        groupedTransfers[groupKey].total_value += itemValue;
      });

      setTransfers(Object.values(groupedTransfers).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error: any) {
      toast.error("Gagal memuat transfer stok");
    }
  };

  const createStockTransfer = async () => {
    if (!selectedProduct || !quantity) {
      toast.error("Pilih produk dan masukkan jumlah");
      return;
    }

    if (role === 'ho_admin' && !selectedToBranch) {
      toast.error("Pilih branch tujuan");
      return;
    }

    if ((role === 'branch_manager' || role === 'sb_branch_manager') && !selectedRider) {
      toast.error("Pilih rider");
      return;
    }

    setLoading(true);
    try {
      // Check branch hub inventory before transfer
      const { data: hubInventory, error: hubError } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branchId)
        .eq('product_id', selectedProduct)
        .is('rider_id', null)
        .maybeSingle();

      if (hubError) throw hubError;

      const transferQuantity = parseInt(quantity);
      if (!hubInventory || hubInventory.stock_quantity < transferQuantity) {
        toast.error("Stok branch hub tidak mencukupi");
        return;
      }

      const transferData = {
        product_id: selectedProduct,
        quantity: transferQuantity,
        movement_type: 'transfer' as const,
        branch_id: role === 'ho_admin' ? selectedToBranch : branchId,
        rider_id: (role === 'branch_manager' || role === 'sb_branch_manager') ? selectedRider : null,
        created_by: userId,
        notes: `Transfer ${role === 'ho_admin' ? 'to branch' : 'to rider'}`
      };

      const { error } = await supabase
        .from('stock_movements')
        .insert([transferData]);

      if (error) throw error;

      // Reduce branch hub stock when transferring to rider
      if ((role === 'branch_manager' || role === 'sb_branch_manager') && selectedRider) {
        await supabase
          .from('inventory')
          .update({ 
            stock_quantity: hubInventory.stock_quantity - transferQuantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', hubInventory.id);
      }

      toast.success("Transfer stok berhasil dibuat!");
      setSelectedProduct("");
      setQuantity("");
      setSelectedRider("");
      setSelectedToBranch("");
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal membuat transfer: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createBulkTransferForRider = async () => {
    if (!branchId) {
      toast.error("Branch tidak diketahui");
      return;
    }
    if (!selectedRider) {
      toast.error("Pilih rider terlebih dahulu");
      return;
    }

    const rows = products
      .map(p => ({ id: p.id, qty: Number(productQuantities[p.id] || 0) }))
      .filter(p => p.qty > 0);

    if (rows.length === 0) {
      toast.error("Isi jumlah untuk minimal 1 produk");
      return;
    }

    const totalItems = rows.reduce((sum, row) => sum + row.qty, 0);

    setLoading(true);
    try {
      // Check branch inventory before transfer using RPC function
      const branchType = role === 'sb_branch_manager' ? 'cabang' : 'branch hub';
      
      for (const row of rows) {
        const { data: availableStock, error: stockError } = await supabase
          .rpc('get_branch_stock', {
            p_branch_id: branchId,
            p_product_id: row.id
          });

        if (stockError) {
          console.error("Error checking stock:", stockError);
          toast.error("Gagal memeriksa stok");
          return;
        }

        const productName = products.find(p => p.id === row.id)?.name || 'Unknown';
        
        if ((availableStock || 0) < row.qty) {
          toast.error(`Stok ${branchType} tidak mencukupi untuk ${productName}. Tersedia: ${availableStock || 0} unit, diminta: ${row.qty} unit`);
          return;
        }
      }

      const expectedDeliveryDate = new Date();
      expectedDeliveryDate.setHours(expectedDeliveryDate.getHours() + 1);

      // Generate unique reference ID for this batch transfer
      const referenceId = crypto.randomUUID();

      // Create stock movement records
      const stockMovements = rows.map(p => ({
        product_id: p.id,
        quantity: p.qty,
        movement_type: 'transfer' as const,
        branch_id: branchId,
        rider_id: selectedRider,
        created_by: userId,
        status: 'sent',
        reference_id: referenceId,
        expected_delivery_date: expectedDeliveryDate.toISOString(),
        notes: 'Stok dikirim dari branch ke rider'
      }));

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert(stockMovements);

      if (movementError) throw movementError;

      // Reduce branch hub inventory for each product
      for (const row of rows) {
        const { data: hubInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('branch_id', branchId)
          .eq('product_id', row.id)
          .is('rider_id', null)
          .maybeSingle();

        if (hubInventory) {
          await supabase
            .from('inventory')
            .update({ 
              stock_quantity: hubInventory.stock_quantity - row.qty,
              last_updated: new Date().toISOString()
            })
            .eq('id', hubInventory.id);
        }
      }

      toast.success(`Transfer stok ke rider berhasil dikirim! Total: ${totalItems} items`);
      setProductQuantities({});
      setSelectedRider("");
      await fetchTransfers();
      await fetchRiderShifts();
      window.dispatchEvent(new Event('stock-sent'));
    } catch (error: any) {
      toast.error("Gagal membuat transfer: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkRiderCanReceiveStock = async (riderId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('can_receive_stock', { rider_uuid: riderId });
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error("Error checking rider eligibility:", error);
      return false;
    }
  };

  const confirmStockReceival = async (transferId: string) => {
    setLoading(true);
    try {
      const currentTime = new Date().toISOString();
      
      const { error } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'received',
          actual_delivery_date: currentTime,
          notes: 'Stok diterima dan dikonfirmasi oleh rider'
        })
        .eq('id', transferId);

      if (error) throw error;

      // Also update rider inventory
      const transfer = transfers
        .flatMap(group => group.items)
        .find(t => t.id === transferId);
      
      if (transfer) {
        await updateRiderInventory(transfer.product_id, transfer.quantity, 'add');
      }

      toast.success("Stok dikonfirmasi diterima!");
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal konfirmasi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRiderInventory = async (productId: string, quantity: number, operation: 'add' | 'subtract') => {
    try {
      // Check if inventory exists for this rider and product
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('rider_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingInventory) {
        // Update existing inventory
        const newQuantity = operation === 'add' 
          ? existingInventory.stock_quantity + quantity
          : Math.max(0, existingInventory.stock_quantity - quantity);

        await supabase
          .from('inventory')
          .update({ 
            stock_quantity: newQuantity,
            last_updated: new Date().toISOString() 
          })
          .eq('id', existingInventory.id);
      } else if (operation === 'add') {
        // Create new inventory record
        await supabase
          .from('inventory')
          .insert([{
            rider_id: userId,
            product_id: productId,
            stock_quantity: quantity,
            branch_id: branchId
          }]);
      }
    } catch (error: any) {
      console.error("Error updating rider inventory:", error);
    }
  };

  const uploadVerificationPhoto = async (transferId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${transferId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('stock-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stock-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('stock_movements')
        .update({ 
          verification_photo_url: publicUrl,
          notes: 'Foto verifikasi terupload'
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      toast.success("Foto verifikasi berhasil diupload!");
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal upload foto: " + error.message);
    }
  };

  const canRiderReceiveStock = (riderId: string): boolean => {
    // Allow transfers even during active shifts (per user request)
    return true;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Dikirim</Badge>;
      case 'received':
        return <Badge variant="default" className="bg-green-100 text-green-800">Diterima</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTotalStockToSend = () => {
    return Object.values(productQuantities).reduce((sum, qty) => sum + (qty || 0), 0);
  };

  return (
    <div className="space-y-6">
      <Card className="dashboard-card bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manajemen Transfer Stok
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Transfer Form for Branch Manager and Small Branch Manager */}
          {(role === 'branch_manager' || role === 'sb_branch_manager') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Kirim Stok ke Rider</h3>
              
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger className="bg-background/95 backdrop-blur-md border-red-500 hover:bg-red-50 rounded-full">
                  <SelectValue placeholder="Pilih rider" />
                </SelectTrigger>
                <SelectContent className="bg-white border-red-500 shadow-lg z-50 rounded-2xl">
                  {riders
                    .filter(rider => 
                      // For sb_branch_manager, only show riders from same branch
                      role === 'sb_branch_manager' 
                        ? rider.branch_id === branchId 
                        : true
                    )
                    .map((rider) => (
                      <SelectItem 
                        key={rider.id} 
                        value={rider.id}
                        className="hover:bg-red-50 hover:text-red-700 focus:bg-red-100 focus:text-red-800 rounded-full"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{rider.full_name}</span>
                          {riderShifts[rider.id] && (
                            <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700">
                              {riderShifts[rider.id].status === 'active' ? 'Shift Aktif' : 'Shift Selesai'}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Pending Shifts Warning */}
              {hasPendingShifts && (
                <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-900">Perhatian - Laporan Shift Belum Diterima</p>
                      <p className="text-sm text-amber-800 mt-1">
                        Ada {pendingShiftsCount} laporan shift yang belum diterima. 
                        Silahkan selesaikan penerimaan laporan shift di halaman 
                        <span className="font-semibold"> Stock Management → Laporan Shift</span> 
                        sebelum mengirim stok.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Stock Summary - Highlighted */}
              {getTotalStockToSend() > 0 && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-800">Total Stok yang Akan Dikirim:</span>
                      <span className="text-lg font-bold text-red-600">
                        {getTotalStockToSend()} unit
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-red-700">
                      {Object.entries(productQuantities)
                        .filter(([id, qty]) => qty > 0)
                        .map(([id, qty]) => {
                          const product = products.find(p => p.id === id);
                          return `${product?.name}: ${qty}`;
                        })
                        .join(', ')
                      }
                    </div>
                  </CardContent>
                </Card>
              )}

              <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={loading || !selectedRider || getTotalStockToSend() === 0 || hasPendingShifts}
                    className="w-full rounded-full hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {hasPendingShifts ? 'Selesaikan Laporan Shift Dulu' : (loading ? "Mengirim..." : "Berikan Stok ke Rider")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Pengiriman Stok</AlertDialogTitle>
                    <AlertDialogDescription>
                      Apakah jumlah yang anda input sesuai dengan produk fisik?
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <p className="font-medium">Total: {getTotalStockToSend()} unit</p>
                          <div className="text-sm space-y-1">
                            {Object.entries(productQuantities)
                              .filter(([id, qty]) => qty > 0)
                              .map(([id, qty]) => {
                                const product = products.find(p => p.id === id);
                                return (
                                  <div key={id} className="flex justify-between">
                                    <span>{product?.name}</span>
                                    <span>{qty} unit</span>
                                  </div>
                                );
                              })
                            }
                          </div>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Tidak (tidak sesuai)</AlertDialogCancel>
                    <AlertDialogAction onClick={createBulkTransferForRider}>
                      Ya Kirim (stok sudah sesuai)
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Filter & Search Section */}
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Search Input */}
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Search className="h-4 w-4" />
                        Cari Product
                      </Label>
                      <Input 
                        placeholder="Ketik nama product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    
                    {/* Category Checkboxes */}
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Filter className="h-4 w-4" />
                        Filter Kategori
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {["Espresso Based", "Milk Based", "Refresher", "Botol 200ml", "Botol 1 Liter"].map(cat => (
                          <div key={cat} className="flex items-center space-x-2">
                            <Checkbox 
                              id={cat}
                              checked={selectedCategories.includes(cat)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCategories([...selectedCategories, cat]);
                                } else {
                                  setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                }
                              }}
                            />
                            <label htmlFor={cat} className="text-sm cursor-pointer">
                              {cat}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products
                  .filter(p => {
                    // Filter by search query
                    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
                    
                    // Filter by selected categories
                    const matchesCategory = selectedCategories.length === 0 || 
                                           selectedCategories.includes(p.category);
                    
                    return matchesSearch && matchesCategory;
                  })
                  .sort((a, b) => a.name.localeCompare(b.name)) // Sort A-Z
                  .map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded bg-white">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-red-500 border-red-500 text-white hover:bg-red-600"
                        disabled={!productQuantities[product.id] || productQuantities[product.id] <= 0}
                        onClick={() => setProductQuantities(prev => ({
                          ...prev,
                          [product.id]: Math.max(0, (prev[product.id] || 0) - 1)
                        }))}
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        className="w-16 h-8 text-center border-red-500 focus:border-red-600 focus:ring-red-500"
                        value={productQuantities[product.id] || 0}
                        onChange={(e) => {
                          const value = Math.max(0, parseInt(e.target.value) || 0);
                          setProductQuantities(prev => ({
                            ...prev,
                            [product.id]: value
                          }));
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-red-500 border-red-500 text-white hover:bg-red-600"
                        onClick={() => setProductQuantities(prev => ({
                          ...prev,
                          [product.id]: (prev[product.id] || 0) + 1
                        }))}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfers List */}
      <Card className="dashboard-card bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Riwayat Transfer Stok</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={historyType} onValueChange={(value: 'transfer' | 'return') => setHistoryType(value)}>
                <SelectTrigger className="w-48 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="transfer">Pengiriman Stok</SelectItem>
                  <SelectItem value="return">Pengembalian Stok</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={(value: 'sent' | 'received' | 'all') => setFilterType(value)}>
                <SelectTrigger className="w-32 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="sent">Terkirim</SelectItem>
                  <SelectItem value="received">Diterima</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
              
              {/* User Filter */}
              {role === 'branch_manager' && (
                <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                  <SelectTrigger className="w-40 bg-white">
                    <SelectValue placeholder="Pilih Rider" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Semua Rider</SelectItem>
                    {riders.map(rider => {
                      const branchCode = rider.branches?.branch_code || rider.branches?.code || '';
                      const branchName = rider.branches?.name || 'Unknown Branch';
                      return (
                        <SelectItem key={rider.id} value={rider.id}>
                          {branchCode && `${branchCode} — `}{rider.full_name} ({branchName})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              
              {/* Date Range Filter */}
              <Select value={dateRangeFilter} onValueChange={(value: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom') => setDateRangeFilter(value)}>
                <SelectTrigger className="w-36 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="yesterday">Kemarin</SelectItem>
                  <SelectItem value="this_week">Minggu Ini</SelectItem>
                  <SelectItem value="this_month">Bulan Ini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Custom Date Inputs */}
              {dateRangeFilter === 'custom' && (
                <>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-36 bg-white"
                    placeholder="Tanggal Mulai"
                  />
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-36 bg-white"
                    placeholder="Tanggal Akhir"
                  />
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {transfers.map((transferGroup) => (
                <Card key={transferGroup.id} className={`bg-white ${getTransferCardStyle(transferGroup.movement_type || 'transfer')}`}>
                  <CardHeader className="pb-2">
                     <div className="flex items-center justify-between">
                       <div>
                        <div className={`p-3 rounded-lg border ${getTransferHeaderStyle(transferGroup.movement_type || 'transfer')}`}>
                          <div className={`font-medium mb-1 ${getTransferTextStyle(transferGroup.movement_type || 'transfer')}`}>
                            {transferGroup.transaction_id}
                          </div>
                          <div className={`text-sm ${getTransferTextStyle(transferGroup.movement_type || 'transfer')}`}>
                            {transferGroup.items.length} item(s) • Total: {transferGroup.total_quantity} unit
                            {transferGroup.total_value && (
                              <span className="ml-2">• Nilai: Rp {transferGroup.total_value.toLocaleString('id-ID')}</span>
                            )}
                          </div>
                        </div>
                       </div>
                       <div className="text-right">
                         {getStatusBadge(transferGroup.status)}
                         <p className="text-xs text-muted-foreground mt-1">
                           Total: {transferGroup.total_quantity} unit
                         </p>
                         {transferGroup.total_value && (
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
                                   {item.item_value && (
                                     <p className="text-xs text-green-600 font-medium">
                                       Rp {item.item_value.toLocaleString('id-ID')}
                                     </p>
                                   )}
                                 </div>
                               </div>
                             ))}
                          </div>
                          {role === 'rider' && transferGroup.status === 'sent' && transferGroup.rider_id === userId && (
                            <div className="mt-4 pt-3 border-t">
                              <Popover>
                                 <PopoverTrigger asChild>
                                   <Button size="sm" variant="outline" className="w-full rounded-full hover:bg-accent">
                                     <Check className="h-3 w-3 mr-1" />
                                     Konfirmasi Penerimaan Batch
                                   </Button>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-80 bg-background border-input shadow-lg z-50">
                                   <div className="space-y-4">
                                     <h4 className="font-medium">Konfirmasi Penerimaan Batch</h4>
                                     <p className="text-sm text-muted-foreground">
                                       Konfirmasi bahwa Anda telah menerima seluruh item dalam batch ini
                                     </p>
                                     <div className="space-y-2">
                                       <label className="text-sm font-medium">Upload Foto Verifikasi</label>
                                       <input
                                         type="file"
                                         accept="image/*"
                                         onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file && transferGroup.items[0]) {
                                             uploadVerificationPhoto(transferGroup.items[0].id, file);
                                           }
                                         }}
                                         className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary"
                                       />
                                     </div>
                                     <Button
                                       onClick={() => {
                                         transferGroup.items.forEach((item) => {
                                           confirmStockReceival(item.id);
                                         });
                                       }}
                                       className="w-full rounded-full hover:bg-primary/90"
                                       size="sm"
                                     >
                                       <CheckCircle className="h-3 w-3 mr-1" />
                                       Konfirmasi Terima Batch
                                     </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                           )}
                         </AccordionContent>
                       </AccordionItem>
                     </Accordion>
                   </CardContent>
                 </Card>
               ))}
             </div>
           </ScrollArea>
         </CardContent>
       </Card>
     </div>
   );
 };