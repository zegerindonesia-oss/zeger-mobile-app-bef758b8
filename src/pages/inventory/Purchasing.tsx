import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package2, Plus, ShoppingCart, Truck, CheckCircle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  cost_price: number;
}

interface PurchaseItem {
  product_id: string;
  quantity: number;
  cost_per_unit: number;
  total_cost: number;
}

interface Purchase {
  id: string;
  purchase_number: string;
  supplier_name: string;
  purchase_date: string;
  total_amount: number;
  status: string;
  notes?: string;
  items?: PurchaseItem[];
}

export default function Purchasing() {
  const { userProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form states
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchPurchases();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data produk: " + error.message);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('branch_id', userProfile?.branch_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data pembelian: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, {
      product_id: "",
      quantity: 1,
      cost_per_unit: 0,
      total_cost: 0
    }]);
  };

  const updatePurchaseItem = (index: number, field: string, value: any) => {
    const updatedItems = [...purchaseItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    // Calculate total cost when quantity or cost per unit changes
    if (field === 'quantity' || field === 'cost_per_unit') {
      updatedItems[index].total_cost = updatedItems[index].quantity * updatedItems[index].cost_per_unit;
    }

    setPurchaseItems(updatedItems);
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.total_cost, 0);
  };

  const generatePurchaseNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `PUR${year}${month}${day}${random}`;
  };

  const handleSubmit = async () => {
    if (!supplierName.trim()) {
      toast.error("Nama supplier harus diisi");
      return;
    }

    if (purchaseItems.length === 0) {
      toast.error("Tambahkan minimal 1 item pembelian");
      return;
    }

    const invalidItems = purchaseItems.filter(item => 
      !item.product_id || item.quantity <= 0 || item.cost_per_unit <= 0
    );

    if (invalidItems.length > 0) {
      toast.error("Semua item harus memiliki produk, quantity, dan harga yang valid");
      return;
    }

    setSubmitting(true);
    try {
      const purchaseNumber = generatePurchaseNumber();
      const totalAmount = calculateTotal();

      // Create purchase record
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          purchase_number: purchaseNumber,
          supplier_name: supplierName,
          purchase_date: purchaseDate,
          total_amount: totalAmount,
          status: 'completed',
          notes: notes,
          branch_id: userProfile?.branch_id,
          created_by: userProfile?.id
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const itemInserts = purchaseItems.map(item => ({
        purchase_id: purchaseData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        cost_per_unit: item.cost_per_unit,
        total_cost: item.total_cost
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemInserts);

      if (itemsError) throw itemsError;

      // Update inventory for each item
      for (const item of purchaseItems) {
        // Check if inventory exists
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.product_id)
          .eq('branch_id', userProfile?.branch_id)
          .eq('rider_id', null) // Branch inventory, not rider specific
          .single();

        if (existingInventory) {
          // Update existing inventory
          const { error: updateError } = await supabase
            .from('inventory')
            .update({
              stock_quantity: existingInventory.stock_quantity + item.quantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', existingInventory.id);

          if (updateError) throw updateError;
        } else {
          // Create new inventory record
          const { error: insertError } = await supabase
            .from('inventory')
            .insert({
              product_id: item.product_id,
              branch_id: userProfile?.branch_id,
              stock_quantity: item.quantity,
              min_stock_level: 10,
              max_stock_level: 1000
            });

          if (insertError) throw insertError;
        }
      }

      toast.success("Pembelian berhasil dicatat dan stok telah diperbarui");
      
      // Reset form
      setSupplierName("");
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setNotes("");
      setPurchaseItems([]);
      setIsDialogOpen(false);
      
      fetchPurchases();
    } catch (error: any) {
      toast.error("Gagal mencatat pembelian: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Purchasing</h1>
            <p className="text-muted-foreground">Catat pembelian barang masuk untuk small branch</p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Pembelian
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Pembelian Baru</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Purchase Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">Nama Supplier</Label>
                  <Input
                    id="supplier"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Masukkan nama supplier"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="purchase-date">Tanggal Pembelian</Label>
                  <Input
                    id="purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Catatan (Opsional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  rows={2}
                />
              </div>

              {/* Purchase Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-medium">Item Pembelian</Label>
                  <Button variant="outline" size="sm" onClick={addPurchaseItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {purchaseItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-4 gap-4 items-end">
                        <div>
                          <Label>Produk</Label>
                          <Select
                            value={item.product_id}
                            onValueChange={(value) => updatePurchaseItem(index, 'product_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih produk" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.code})
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
                            value={item.quantity}
                            onChange={(e) => updatePurchaseItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        
                        <div>
                          <Label>Harga per Unit</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.cost_per_unit}
                            onChange={(e) => updatePurchaseItem(index, 'cost_per_unit', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        
                        <div>
                          <Label>Total</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={formatCurrency(item.total_cost)}
                              readOnly
                              className="font-medium"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removePurchaseItem(index)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {purchaseItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada item pembelian. Klik "Tambah Item" untuk menambah produk.
                  </div>
                )}
              </div>

              {/* Total */}
              {purchaseItems.length > 0 && (
                <Card className="p-4 bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total Pembelian:</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Pembelian"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Purchases List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Riwayat Pembelian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Pembelian</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data pembelian
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-mono">{purchase.purchase_number}</TableCell>
                      <TableCell className="font-medium">{purchase.supplier_name}</TableCell>
                      <TableCell>{new Date(purchase.purchase_date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(purchase.total_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={purchase.status === 'completed' ? "default" : "secondary"}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {purchase.status === 'completed' ? 'Selesai' : purchase.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{purchase.notes || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}