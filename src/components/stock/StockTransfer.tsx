import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

export const StockTransfer = ({ role, userId, branchId }: StockTransferProps) => {
  const [transfers, setTransfers] = useState<StockTransferItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [selectedRider, setSelectedRider] = useState("");
  const [selectedToBranch, setSelectedToBranch] = useState("");

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

      // Fetch stock movements/transfers
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal memuat data");
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

  const confirmStockReceival = async (transferId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('stock_movements')
        .update({ 
          notes: 'Confirmed by receiver'
        })
        .eq('id', transferId);

      if (error) throw error;

      toast.success("Stok dikonfirmasi diterima!");
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal konfirmasi: " + error.message);
    } finally {
      setLoading(false);
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

      const { error: updateError } = await supabase
        .from('stock_movements')
        .update({ 
          notes: `Verification photo: ${fileName}`
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      toast.success("Foto verifikasi berhasil diupload!");
      fetchTransfers();
    } catch (error: any) {
      toast.error("Gagal upload foto: " + error.message);
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

              {role === 'ho_admin' && (
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
              )}

              {role === 'branch_manager' && (
                <Select value={selectedRider} onValueChange={setSelectedRider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ke Rider" />
                  </SelectTrigger>
                  <SelectContent>
                    {riders.filter(r => r.branch_id === branchId).map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        {rider.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button onClick={createStockTransfer} disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                Kirim
              </Button>
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
                    </div>
                    <Badge variant={
                      transfer.notes?.includes('Confirmed') ? 'default' : 'secondary'
                    }>
                      {transfer.notes?.includes('Confirmed') ? 'Diterima' : 'Dikirim'}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-3">
                    {new Date(transfer.created_at).toLocaleString('id-ID')}
                  </p>

                  {/* Action buttons for different roles */}
                  <div className="flex gap-2">
                    {role === 'rider' && !transfer.notes?.includes('Confirmed') && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => confirmStockReceival(transfer.id)}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Konfirmasi Terima
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Foto Verifikasi
                        </Button>
                      </>
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