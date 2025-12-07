import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package2, Plus, ShoppingCart, CheckCircle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  cost_price?: number;
}

interface PurchaseItem {
  product_id: string;
  quantity: number;
  cost_per_unit: number;
  total_cost: number;
}

interface PurchaseHistory {
  id: string;
  purchase_number: string;
  supplier_name: string;
  purchase_date: string;
  total_amount: number;
  notes?: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    cost_per_unit: number;
    total_cost: number;
  }[];
}

export default function PurchasingSimple() {
  const { userProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  
  // Form states
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [notes, setNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchPurchaseHistory();
    setLoading(false);
  }, [userProfile?.branch_id]);

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

  const fetchPurchaseHistory = async () => {
    if (!userProfile?.branch_id) return;
    
    try {
      // Fetch purchases for this branch
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('*')
        .eq('branch_id', userProfile.branch_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (purchasesError) throw purchasesError;
      if (!purchases || purchases.length === 0) {
        setPurchaseHistory([]);
        return;
      }

      // Fetch purchase items for these purchases
      const purchaseIds = purchases.map(p => p.id);
      const { data: items, error: itemsError } = await supabase
        .from('purchase_items')
        .select(`
          *,
          products (name)
        `)
        .in('purchase_id', purchaseIds);

      if (itemsError) throw itemsError;

      // Combine data
      const history: PurchaseHistory[] = purchases.map(p => ({
        id: p.id,
        purchase_number: p.purchase_number,
        supplier_name: p.supplier_name,
        purchase_date: p.purchase_date,
        total_amount: p.total_amount,
        notes: p.notes || '',
        items: (items || [])
          .filter((item: any) => item.purchase_id === p.id)
          .map((item: any) => ({
            product_id: item.product_id,
            product_name: item.products?.name || 'Unknown',
            quantity: item.quantity,
            cost_per_unit: item.cost_per_unit,
            total_cost: item.total_cost
          }))
      }));

      setPurchaseHistory(history);
    } catch (error: any) {
      console.error('Error fetching purchase history:', error);
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

  const addAllProducts = () => {
    const newItems = products.map(product => ({
      product_id: product.id,
      quantity: 1,
      cost_per_unit: product.cost_price || 0,
      total_cost: product.cost_price || 0
    }));
    setPurchaseItems(newItems);
  };

  const updatePurchaseItem = (index: number, field: string, value: any) => {
    const updatedItems = [...purchaseItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    // Auto-populate cost price when product is selected
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product && product.cost_price) {
        updatedItems[index].cost_per_unit = product.cost_price;
        updatedItems[index].total_cost = updatedItems[index].quantity * product.cost_price;
      }
    }

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
      // Use Edge Function for atomic purchase creation
      const { data, error } = await supabase.functions.invoke('create-purchase', {
        body: {
          supplier_name: supplierName,
          purchase_date: purchaseDate,
          notes: notes,
          items: purchaseItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            cost_per_unit: item.cost_per_unit
          })),
          branch_id: userProfile?.branch_id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Pembelian ${data.purchase_number} berhasil dicatat! Total: ${formatCurrency(data.total_amount)}`);
        
        // Reset form
        setSupplierName("");
        setPurchaseDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
        setNotes("");
        setPurchaseItems([]);
        
        // Refresh history
        fetchPurchaseHistory();
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }
      
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error("Gagal mencatat pembelian: " + (error.message || 'Terjadi kesalahan'));
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Pembelian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addAllProducts}>
                  <Package2 className="h-4 w-4 mr-2" />
                  Tambah Semua Produk
                </Button>
                <Button variant="outline" size="sm" onClick={addPurchaseItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Item
                </Button>
              </div>
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
                              {product.name} ({product.code}) - {formatCurrency(product.cost_price || 0)}
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
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Pembelian"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Riwayat Pembelian (10 Terakhir)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada riwayat pembelian
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseHistory.map(purchase => (
                <Card key={purchase.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{purchase.purchase_number}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(purchase.purchase_date).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <p className="font-medium">{purchase.supplier_name}</p>
                        {purchase.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{purchase.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(purchase.total_amount)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-sm">
                      <p className="font-medium mb-2">{purchase.items.length} Item:</p>
                      <div className="space-y-1">
                        {purchase.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.product_name} × {item.quantity}</span>
                            <span>{formatCurrency(item.total_cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}