import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, Truck, Send, ArrowRight, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  branch_stock: number;
  rider_id: string | null;
  rider_name: string | null;
  rider_stock: number;
  min_stock_level: number;
  max_stock_level: number;
}

interface Rider {
  id: string;
  full_name: string;
  phone: string;
}

interface StockTransfer {
  rider_id: string;
  items: {
    product_id: string;
    quantity: number;
  }[];
}

export const SmallBranchStockManagement = () => {
  const { userProfile } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState<string>("");
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState("");
  const [transferItems, setTransferItems] = useState<{ product_id: string; quantity: number; max_quantity: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBranchName();
    fetchInventory();
    fetchRiders();
  }, []);

  const fetchBranchName = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('name')
        .eq('id', userProfile?.branch_id)
        .single();

      if (error) throw error;
      setBranchName(data?.name || 'Small Branch');
    } catch (error) {
      setBranchName('Small Branch');
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      
      // Get branch inventory (stock at small branch level)
      const { data: branchInventory, error: branchError } = await supabase
        .from('inventory')
        .select(`
          id,
          product_id,
          stock_quantity,
          min_stock_level,
          max_stock_level,
          products(name, code)
        `)
        .eq('branch_id', userProfile?.branch_id)
        .is('rider_id', null); // Branch level inventory

      if (branchError) throw branchError;

      // Get rider inventory for this branch
      const { data: riderInventory, error: riderError } = await supabase
        .from('inventory')
        .select(`
          product_id,
          rider_id,
          stock_quantity,
          profiles(full_name)
        `)
        .eq('branch_id', userProfile?.branch_id)
        .not('rider_id', 'is', null);

      if (riderError) throw riderError;

      // Combine data
      const inventoryMap = new Map();
      
      // Process branch inventory
      branchInventory?.forEach(item => {
        inventoryMap.set(item.product_id, {
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown',
          product_code: item.products?.code || 'Unknown',
          branch_stock: item.stock_quantity,
          min_stock_level: item.min_stock_level,
          max_stock_level: item.max_stock_level,
          rider_stocks: new Map()
        });
      });

      // Process rider inventory
      riderInventory?.forEach(item => {
        const productData = inventoryMap.get(item.product_id);
        if (productData) {
          productData.rider_stocks.set(item.rider_id, {
            rider_id: item.rider_id,
            rider_name: item.profiles?.full_name,
            stock: item.stock_quantity
          });
        }
      });

      // Convert to array format for display
      const inventoryArray: InventoryItem[] = [];
      inventoryMap.forEach((product, productId) => {
        if (product.rider_stocks.size === 0) {
          // Product with no rider assignments
          inventoryArray.push({
            id: product.id,
            product_id: productId,
            product_name: product.product_name,
            product_code: product.product_code,
            branch_stock: product.branch_stock,
            rider_id: null,
            rider_name: null,
            rider_stock: 0,
            min_stock_level: product.min_stock_level,
            max_stock_level: product.max_stock_level
          });
        } else {
          // Product with rider assignments
          product.rider_stocks.forEach((riderData: any) => {
            inventoryArray.push({
              id: product.id,
              product_id: productId,
              product_name: product.product_name,
              product_code: product.product_code,
              branch_stock: product.branch_stock,
              rider_id: riderData.rider_id,
              rider_name: riderData.rider_name,
              rider_stock: riderData.stock,
              min_stock_level: product.min_stock_level,
              max_stock_level: product.max_stock_level
            });
          });
        }
      });

      setInventory(inventoryArray);
    } catch (error: any) {
      toast.error("Gagal memuat data inventory: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRiders = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('branch_id', userProfile?.branch_id)
        .eq('is_active', true)
        .order('full_name');

      // Filter by role based on branch type
      if (userProfile?.role === 'sb_branch_manager') {
        // Small branch: only sb_rider
        query = query.in('role', ['rider', 'sb_rider']);
      } else if (userProfile?.role === 'branch_manager') {
        // Hub: only bh_rider (exclude sb_rider)
        query = query.in('role', ['rider', 'bh_rider']);
      } else {
        // For other roles, show all
        query = query.in('role', ['rider', 'sb_rider', 'bh_rider']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRiders(data || []);
    } catch (error: any) {
      console.error('Error fetching riders:', error);
    }
  };

  const getAvailableProducts = () => {
    // Get unique products that have branch stock available
    const productMap = new Map();
    inventory.forEach(item => {
      if (item.branch_stock > 0 && !productMap.has(item.product_id)) {
        productMap.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          available_stock: item.branch_stock
        });
      }
    });
    return Array.from(productMap.values());
  };

  const addTransferItem = () => {
    setTransferItems([...transferItems, {
      product_id: "",
      quantity: 1,
      max_quantity: 0
    }]);
  };

  const updateTransferItem = (index: number, field: string, value: any) => {
    const updatedItems = [...transferItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    // Update max quantity when product is selected
    if (field === 'product_id') {
      const product = getAvailableProducts().find(p => p.product_id === value);
      updatedItems[index].max_quantity = product?.available_stock || 0;
      updatedItems[index].quantity = Math.min(updatedItems[index].quantity, product?.available_stock || 0);
    }

    setTransferItems(updatedItems);
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleStockTransfer = async () => {
    if (!selectedRider) {
      toast.error("Pilih rider terlebih dahulu");
      return;
    }

    const validItems = transferItems.filter(item => 
      item.product_id && item.quantity > 0 && item.quantity <= item.max_quantity
    );

    if (validItems.length === 0) {
      toast.error("Tambahkan minimal 1 item transfer yang valid");
      return;
    }

    setSubmitting(true);
    try {
      // Generate batch ID for grouping related transfers
      const batchId = crypto.randomUUID();
      const expectedDelivery = new Date();
      expectedDelivery.setHours(expectedDelivery.getHours() + 1);

      // Process each transfer item
      for (const item of validItems) {
        // 1. Reduce branch inventory
        const branchInventoryItem = inventory.find(inv => 
          inv.product_id === item.product_id && !inv.rider_id
        );
        
        if (branchInventoryItem) {
          const newBranchStock = branchInventoryItem.branch_stock - item.quantity;
          
          const { error: updateBranchError } = await supabase
            .from('inventory')
            .update({
              stock_quantity: newBranchStock,
              last_updated: new Date().toISOString()
            })
            .eq('id', branchInventoryItem.id);

          if (updateBranchError) throw updateBranchError;
        }

        // 2. Create stock movement record with 'sent' status (waiting for rider confirmation)
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            branch_id: userProfile?.branch_id,
            rider_id: selectedRider,
            movement_type: 'transfer',
            quantity: item.quantity,
            status: 'sent', // Waiting for rider confirmation
            reference_id: batchId,
            reference_type: 'small_branch_to_rider_transfer',
            expected_delivery_date: expectedDelivery.toISOString(),
            notes: `Transfer dari small branch - menunggu konfirmasi rider`,
            created_by: userProfile?.id
          });

        if (movementError) throw movementError;
      }

      toast.success(`Berhasil kirim ${validItems.length} item ke rider - menunggu konfirmasi`);
      
      // Reset form
      setSelectedRider("");
      setTransferItems([]);
      setIsTransferDialogOpen(false);
      
      fetchInventory();
    } catch (error: any) {
      toast.error("Gagal melakukan transfer stock: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStockStatus = (stock: number, minLevel: number) => {
    if (stock === 0) return { label: "Kosong", variant: "destructive" as const };
    if (stock <= minLevel) return { label: "Rendah", variant: "secondary" as const };
    return { label: "Normal", variant: "default" as const };
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Stok {branchName}</h1>
            <p className="text-muted-foreground">Kelola stok cabang dan transfer ke rider</p>
          </div>
        </div>

        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Truck className="h-4 w-4 mr-2" />
              Transfer ke Rider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Transfer Stock ke Rider</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="rider-select">Pilih Rider</Label>
                <Select value={selectedRider} onValueChange={setSelectedRider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih rider untuk transfer" />
                  </SelectTrigger>
                  <SelectContent>
                    {riders.map(rider => (
                      <SelectItem key={rider.id} value={rider.id}>
                        {rider.full_name} ({rider.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-medium">Item Transfer</Label>
                  <Button variant="outline" size="sm" onClick={addTransferItem}>
                    <Package className="h-4 w-4 mr-2" />
                    Tambah Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {transferItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-4 gap-4 items-end">
                        <div>
                          <Label>Produk</Label>
                          <Select
                            value={item.product_id}
                            onValueChange={(value) => updateTransferItem(index, 'product_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih produk" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableProducts().map(product => (
                                <SelectItem key={product.product_id} value={product.product_id}>
                                  {product.product_name} (Stock: {product.available_stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            max={item.max_quantity}
                            value={item.quantity}
                            onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Max: {item.max_quantity}
                          </p>
                        </div>
                        
                        <div>
                          <Label>Status</Label>
                          <div className="flex items-center gap-2">
                            {item.quantity > item.max_quantity ? (
                              <Badge variant="destructive">Melebihi stok</Badge>
                            ) : item.quantity > 0 && item.product_id ? (
                              <Badge variant="default">Valid</Badge>
                            ) : (
                              <Badge variant="secondary">Tidak valid</Badge>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeTransferItem(index)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {transferItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada item transfer. Klik "Tambah Item" untuk menambah produk.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleStockTransfer} disabled={submitting || !selectedRider || transferItems.length === 0}>
                  {submitting ? "Mentransfer..." : "Transfer Stock"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Stok {branchName}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead className="text-center">Branch Stock</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead className="text-center">Rider Stock</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Min/Max Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Belum ada data inventory
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.map((item, index) => {
                    const branchStatus = getStockStatus(item.branch_stock, item.min_stock_level);
                    const riderStatus = getStockStatus(item.rider_stock, 5);
                    
                    return (
                      <TableRow key={`${item.product_id}-${item.rider_id || 'branch'}-${index}`}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="font-mono">{item.product_code}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-medium">{item.branch_stock}</span>
                            {item.branch_stock <= item.min_stock_level && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.rider_name ? (
                            <Badge variant="outline">{item.rider_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">No assignment</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{item.rider_stock}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Badge variant={branchStatus.variant} className="text-xs">
                              B: {branchStatus.label}
                            </Badge>
                            {item.rider_name && (
                              <Badge variant={riderStatus.variant} className="text-xs">
                                R: {riderStatus.label}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {item.min_stock_level} / {item.max_stock_level}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};