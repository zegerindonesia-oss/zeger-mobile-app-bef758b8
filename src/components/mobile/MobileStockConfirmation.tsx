import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Package, 
  Check, 
  X, 
  Camera, 
  CheckCircle2,
  AlertCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockItem {
  id: string;
  product_id: string;
  product?: {
    id: string;
    name: string;
    category: string;
  };
  quantity: number;
  status: string;
  notes?: string;
  created_at: string;
}

interface MobileStockConfirmationProps {
  riderId: string;
  branchId?: string;
}

export const MobileStockConfirmation = ({ riderId, branchId }: MobileStockConfirmationProps) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationPhoto, setVerificationPhoto] = useState<File | null>(null);

  useEffect(() => {
    fetchPendingStock();
  }, [riderId]);

  const fetchPendingStock = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products(id, name, category)
        `)
        .eq('rider_id', riderId)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStockItems(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data stock: " + error.message);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: checked
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    setIsSelectAll(checked);
    const newSelected: Record<string, boolean> = {};
    stockItems.forEach(item => {
      newSelected[item.id] = checked;
    });
    setSelectedItems(newSelected);
  };

  const getSelectedCount = () => {
    return Object.values(selectedItems).filter(Boolean).length;
  };

  const getTotalQuantity = () => {
    return stockItems
      .filter(item => selectedItems[item.id])
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const confirmSelectedStock = async () => {
    const selectedItemIds = Object.keys(selectedItems).filter(id => selectedItems[id]);
    
    if (selectedItemIds.length === 0) {
      toast.error("Pilih minimal 1 item untuk dikonfirmasi");
      return;
    }

    setLoading(true);
    try {
      const currentTime = new Date().toISOString();
      
      // Update selected items to received
      const { error: updateError } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'received',
          actual_delivery_date: currentTime,
          notes: 'Stock diterima dan dikonfirmasi oleh rider'
        })
        .in('id', selectedItemIds);

      if (updateError) throw updateError;

      // Update rider inventory for each confirmed item
      for (const itemId of selectedItemIds) {
        const item = stockItems.find(s => s.id === itemId);
        if (item) {
          await updateRiderInventory(item.product_id, item.quantity, 'add');
        }
      }

      // Upload verification photo if available
      if (verificationPhoto) {
        await uploadVerificationPhoto(selectedItemIds[0], verificationPhoto);
      }

      toast.success(`${selectedItemIds.length} item stock berhasil dikonfirmasi!`);
      setSelectedItems({});
      setIsSelectAll(false);
      setVerificationPhoto(null);
      fetchPendingStock();
    } catch (error: any) {
      toast.error("Gagal konfirmasi stock: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const rejectSelectedStock = async () => {
    const selectedItemIds = Object.keys(selectedItems).filter(id => selectedItems[id]);
    
    if (selectedItemIds.length === 0) {
      toast.error("Pilih minimal 1 item untuk ditolak");
      return;
    }

    if (!rejectNote.trim()) {
      toast.error("Masukkan alasan penolakan");
      return;
    }

    setLoading(true);
    try {
      const currentTime = new Date().toISOString();
      
      // Update selected items to rejected
      const { error: updateError } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'rejected',
          actual_delivery_date: currentTime,
          notes: `REJECTED: ${rejectNote}`
        })
        .in('id', selectedItemIds);

      if (updateError) throw updateError;

      // Return stock to branch hub for each rejected item
      for (const itemId of selectedItemIds) {
        const item = stockItems.find(s => s.id === itemId);
        if (item && branchId) {
          // Find and update branch hub inventory
          const { data: hubInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('branch_id', branchId)
            .eq('product_id', item.product_id)
            .is('rider_id', null)
            .maybeSingle();

          if (hubInventory) {
            await supabase
              .from('inventory')
              .update({ 
                stock_quantity: hubInventory.stock_quantity + item.quantity,
                last_updated: new Date().toISOString()
              })
              .eq('id', hubInventory.id);
          }

          // Create return movement record
          await supabase
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              quantity: item.quantity,
              movement_type: 'return',
              branch_id: branchId,
              rider_id: riderId,
              created_by: riderId,
              status: 'returned',
              notes: `Stock returned due to mismatch: ${rejectNote}`
            });
        }
      }

      toast.success(`${selectedItemIds.length} item stock ditolak dan dikembalikan`);
      setSelectedItems({});
      setIsSelectAll(false);
      setRejectNote("");
      fetchPendingStock();
    } catch (error: any) {
      toast.error("Gagal menolak stock: " + error.message);
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
        .eq('rider_id', riderId)
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
            rider_id: riderId,
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

      await supabase
        .from('stock_movements')
        .update({ 
          verification_photo_url: publicUrl
        })
        .eq('id', transferId);

    } catch (error: any) {
      console.error("Error uploading photo:", error);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Konfirmasi Penerimaan Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stockItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada stock pending untuk dikonfirmasi</p>
            </div>
          ) : (
            <>
              {/* Select All Checkbox */}
              <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                <Checkbox
                  id="select-all"
                  checked={isSelectAll}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Pilih Semua ({stockItems.length} items)
                </label>
              </div>

              {/* Stock Items List */}
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {stockItems.map((item) => (
                    <div 
                      key={item.id}
                      className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                        selectedItems[item.id] ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectItem(item.id, !(selectedItems[item.id] || false))}
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={!!selectedItems[item.id]}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{item.product?.name || 'Unknown Product'}</h4>
                            <Badge variant="secondary">{item.quantity} pcs</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.product?.category} • {new Date(item.created_at).toLocaleDateString('id-ID')}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Summary */}
              {getSelectedCount() > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-blue-800">
                      Total Selected: {getSelectedCount()} items
                    </span>
                    <span className="font-medium text-blue-800">
                      Total Quantity: {getTotalQuantity()} pcs
                    </span>
                  </div>
                </div>
              )}

              {/* Photo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Foto Verifikasi (Opsional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setVerificationPhoto(e.target.files?.[0] || null)}
                    className="hidden"
                    id="verification-photo"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('verification-photo')?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {verificationPhoto ? 'Foto Dipilih' : 'Pilih Foto'}
                  </Button>
                  {verificationPhoto && (
                    <span className="text-sm text-green-600">
                      ✓ {verificationPhoto.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Reject Note */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan Penolakan (jika ada yang tidak sesuai)</label>
                <Textarea
                  placeholder="Contoh: Barang rusak, jumlah tidak sesuai, dll."
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={confirmSelectedStock}
                  disabled={loading || getSelectedCount() === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Konfirmasi ({getSelectedCount()})
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={rejectSelectedStock}
                  disabled={loading || getSelectedCount() === 0 || !rejectNote.trim()}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Tidak Sesuai
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};