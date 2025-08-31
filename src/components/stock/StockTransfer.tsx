import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockTransferProps {
  role: 'ho_admin' | 'branch_manager' | 'rider';
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
  items: StockTransferItem[];
}

interface Rider {
  id: string;
  full_name: string;
  branch_id: string;
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('is_active', true);
      setProducts(productsData || []);

      // Fetch riders
      const { data: ridersData } = await supabase
        .from('profiles')
        .select('id, full_name, branch_id')
        .eq('role', 'rider')
        .eq('is_active', true);
      setRiders(ridersData || []);

      // Fetch branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, branch_type')
        .eq('is_active', true);
      setBranches(branchesData || []);

      // Fetch rider shift statuses
      await fetchRiderShifts();

      // Fetch active shift for current rider if role is rider
      if (role === 'rider') {
        await fetchActiveShift();
      }

      // Fetch stock movements/transfers
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal memuat data");
    }
  };

  const fetchRiderShifts = async () => {
    try {
      const { data: shifts } = await supabase
        .from('shift_management')
        .select('rider_id, status, report_submitted, shift_start_time, shift_end_time')
        .eq('shift_date', new Date().toISOString().split('T')[0]);

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
      const { data: shift } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', userId)
        .eq('shift_date', new Date().toISOString().split('T')[0])
        .eq('status', 'active')
        .maybeSingle();

      setActiveShift(shift || null);
    } catch (error: any) {
      console.error("Error fetching active shift:", error);
    }
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
        .eq('movement_type', 'transfer')
        .order('created_at', { ascending: false });

      if (role === 'branch_manager' && branchId) {
        query = query.eq('branch_id', branchId);
      } else if (role === 'rider') {
        query = query.eq('rider_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group transfers by reference_id for better organization
      const groupedTransfers: Record<string, StockTransferGroup> = {};
      
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
            branch_name: transfer.branches?.name || 'Unknown Branch',
            branch_type: transfer.branches?.branch_type || 'hub',
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

    if (role === 'branch_manager' && !selectedRider) {
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
        rider_id: role === 'branch_manager' ? selectedRider : null,
        created_by: userId,
        notes: `Transfer ${role === 'ho_admin' ? 'to branch' : 'to rider'}`
      };

      const { error } = await supabase
        .from('stock_movements')
        .insert([transferData]);

      if (error) throw error;

      // Reduce branch hub stock when transferring to rider
      if (role === 'branch_manager' && selectedRider) {
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
      // Check branch hub inventory before transfer
      for (const row of rows) {
        const { data: hubInventory, error: hubError } = await supabase
          .from('inventory')
          .select('*')
          .eq('branch_id', branchId)
          .eq('product_id', row.id)
          .is('rider_id', null)
          .maybeSingle();

        if (hubError) throw hubError;

        if (!hubInventory || hubInventory.stock_quantity < row.qty) {
          const productName = products.find(p => p.id === row.id)?.name || 'Unknown';
          toast.error(`Stok branch hub tidak mencukupi untuk ${productName}`);
          return;
        }
      }

      const expectedDeliveryDate = new Date();
      expectedDeliveryDate.setHours(expectedDeliveryDate.getHours() + 1);

      // Generate unique reference ID for this batch transfer
      const referenceId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

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
    const shift = riderShifts[riderId];
    return !shift || shift.report_submitted;
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
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manajemen Transfer Stok
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Transfer Form for Branch Manager */}
          {role === 'branch_manager' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Kirim Stok ke Rider</h3>
              
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rider" />
                </SelectTrigger>
                <SelectContent>
                  {riders
                    .filter(rider => rider.branch_id === branchId)
                    .map((rider) => (
                      <SelectItem 
                        key={rider.id} 
                        value={rider.id}
                        disabled={!canRiderReceiveStock(rider.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{rider.full_name}</span>
                          {!canRiderReceiveStock(rider.id) && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Belum laporan shift
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

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

              <Button 
                onClick={createBulkTransferForRider} 
                disabled={loading || !selectedRider}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Mengirim..." : "Berikan Stok ke Rider"}
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="0"
                      className="w-20"
                      value={productQuantities[product.id] || ''}
                      onChange={(e) => setProductQuantities(prev => ({
                        ...prev,
                        [product.id]: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfers List */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Riwayat Transfer Stok</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {transfers.map((transferGroup) => (
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
                                  <Button size="sm" variant="outline" className="w-full">
                                    <Check className="h-3 w-3 mr-1" />
                                    Konfirmasi Penerimaan Batch
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
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
                                      className="w-full"
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