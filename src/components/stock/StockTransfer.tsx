import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import { 
  Package, 
  Send, 
  Check, 
  Clock,
  AlertCircle,
  Camera,
  Upload
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
  product?: Product;
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
  const [transfers, setTransfers] = useState<StockTransferItem[]>([]);
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
          products(id, name, category)
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

      setTransfers(data || []);
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
      const transferData = {
        product_id: selectedProduct,
        quantity: parseInt(quantity),
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

    // Catatan: sebelumnya ada validasi mengharuskan laporan shift sebelumnya selesai.
    // Untuk kelancaran operasional, kita tidak lagi memblokir transfer.
    // Jika ingin hanya memberi peringatan tanpa memblokir, aktifkan blok berikut:
    // const canReceive = await checkRiderCanReceiveStock(selectedRider);
    // if (!canReceive) {
    //   toast.info("Catatan: Rider punya laporan shift sebelumnya yang belum selesai. Transfer tetap dilanjutkan.");
    // }

    const rows = products
      .map(p => ({ id: p.id, qty: Number(productQuantities[p.id] || 0) }))
      .filter(p => p.qty > 0);

    if (rows.length === 0) {
      toast.error("Isi jumlah untuk minimal 1 produk");
      return;
    }

    setLoading(true);
    try {
      const expectedDeliveryDate = new Date();
      expectedDeliveryDate.setHours(expectedDeliveryDate.getHours() + 1); // Expected 1 hour from now

      // Create stock movement records with status tracking
      const stockMovements = rows.map(p => ({
        product_id: p.id,
        quantity: p.qty,
        movement_type: 'transfer' as const,
        branch_id: branchId,
        rider_id: selectedRider,
        created_by: userId,
        status: 'sent',
        expected_delivery_date: expectedDeliveryDate.toISOString(),
        notes: 'Stok dikirim dari branch ke rider'
      }));

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert(stockMovements);

      if (movementError) throw movementError;

      toast.success("Transfer stok ke rider berhasil dikirim!");
      setProductQuantities({});
      setSelectedRider("");
      await fetchTransfers();
      await fetchRiderShifts();
      window.dispatchEvent(new Event('stock-sent')); // Trigger notification
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
      const transfer = transfers.find(t => t.id === transferId);
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
          {/* Create Transfer Form */}
          {(role === 'ho_admin' || role === 'branch_manager') && (
            <div className="space-y-4">
              {role === 'ho_admin' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    placeholder="Jumlah"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                  />

                  <Select value={selectedToBranch} onValueChange={setSelectedToBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ke Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} ({branch.branch_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button onClick={createStockTransfer} disabled={loading}>
                    <Send className="h-4 w-4 mr-2" />
                    Kirim
                  </Button>
                </div>
              )}

              {role === 'branch_manager' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                      <Select value={selectedRider} onValueChange={setSelectedRider}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Rider" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg z-50">
                          {riders.filter(r => r.branch_id === branchId).map((rider) => {
                            const shift = riderShifts[rider.id];
                            const canReceive = canRiderReceiveStock(rider.id);
                            const isSelected = selectedRider === rider.id;
                            
                            return (
                              <SelectItem 
                                key={rider.id} 
                                value={rider.id}
                                className={`${isSelected ? 'bg-red-500 text-white' : 'hover:bg-red-50'} cursor-pointer`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{rider.full_name}</span>
                                  <div className="flex items-center gap-2 ml-2">
                                    {shift?.status === 'active' && !shift.report_submitted && (
                                      <Badge variant="destructive" className="text-xs">
                                        Shift Aktif
                                      </Badge>
                                    )}
                                    {canReceive && (
                                      <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                                        Siap Terima
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button onClick={createBulkTransferForRider} disabled={loading || !selectedRider} className="w-full">
                        <Send className="h-4 w-4 mr-2" />
                        Berikan Stok ke Rider
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-3">Masukkan jumlah per produk</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{product.category}</p>
                          </div>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="w-24"
                            value={productQuantities[product.id] ?? 0}
                            onChange={(e) => setProductQuantities(prev => ({ ...prev, [product.id]: Math.max(0, Number(e.target.value)) }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
              {transfers.map((transfer) => (
                  <div key={transfer.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{transfer.product?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Jumlah: {transfer.quantity}
                        </p>
                        {transfer.expected_delivery_date && (
                          <p className="text-xs text-muted-foreground">
                            Target: {new Date(transfer.expected_delivery_date).toLocaleString('id-ID')}
                          </p>
                        )}
                        {transfer.actual_delivery_date && (
                          <p className="text-xs text-green-600">
                            Diterima: {new Date(transfer.actual_delivery_date).toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(transfer.status)}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-3">
                      Dibuat: {new Date(transfer.created_at).toLocaleString('id-ID')}
                    </p>

                    {transfer.notes && (
                      <p className="text-sm text-muted-foreground mb-3 italic">
                        {transfer.notes}
                      </p>
                    )}

                    {/* Verification photo */}
                    {transfer.verification_photo_url && (
                      <div className="mb-3">
                        <img 
                          src={transfer.verification_photo_url} 
                          alt="Verification" 
                          className="max-w-xs rounded-lg border"
                        />
                      </div>
                    )}

                    {/* Action buttons for different roles */}
                    <div className="flex gap-2">
                      {role === 'rider' && transfer.status === 'sent' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => confirmStockReceival(transfer.id)}
                            disabled={loading}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Konfirmasi Terima
                          </Button>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id={`photo-upload-${transfer.id}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                uploadVerificationPhoto(transfer.id, file);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById(`photo-upload-${transfer.id}`)?.click()}
                          >
                            <Camera className="h-4 w-4 mr-1" />
                            Foto Verifikasi
                          </Button>
                        </>
                      )}

                      {role === 'branch_manager' && transfer.status === 'sent' && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-orange-600">Menunggu konfirmasi rider</span>
                        </div>
                      )}

                      {transfer.status === 'received' && (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Stok berhasil diterima</span>
                        </div>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};