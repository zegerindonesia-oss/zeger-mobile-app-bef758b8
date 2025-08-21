import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShoppingCart, 
  Search, 
  Minus, 
  Plus, 
  Trash2,
  CreditCard,
  DollarSign,
  Smartphone,
  Printer
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
  description?: string;
}

interface CartItem extends Product {
  quantity: number;
  total: number;
}

const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      // Join with inventory to get stock quantities
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          category,
          description,
          inventory(stock_quantity)
        `)
        .eq('is_active', true);

      if (error) throw error;

      const formattedProducts = data?.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        description: product.description,
        stock_quantity: product.inventory?.[0]?.stock_quantity || 0
      })) || [];

      setProducts(formattedProducts);
    } catch (error: any) {
      toast.error("Gagal memuat produk: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group products by category for better display
  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const category = product.category || 'Lainnya';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const categories = Object.keys(groupedProducts).sort();

  // Category colors for better visual distinction
  const categoryColors: Record<string, string> = {
    'Espresso Based': 'bg-amber-50 border-amber-200 text-amber-800',
    'Milk Based': 'bg-blue-50 border-blue-200 text-blue-800', 
    'Signature': 'bg-purple-50 border-purple-200 text-purple-800',
    'Creampresso': 'bg-rose-50 border-rose-200 text-rose-800',
    'Refresher': 'bg-green-50 border-green-200 text-green-800',
    'Topping': 'bg-gray-50 border-gray-200 text-gray-800',
    'Syrup': 'bg-yellow-50 border-yellow-200 text-yellow-800'
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast.error("Stok tidak mencukupi");
        return;
      }
      
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      if (product.stock_quantity <= 0) {
        toast.error("Stok tidak tersedia");
        return;
      }
      
      setCart([...cart, {
        ...product,
        quantity: 1,
        total: product.price
      }]);
    }
    
    toast.success(`${product.name} ditambahkan ke keranjang`);
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    const product = products.find(p => p.id === id);
    
    if (newQuantity > (product?.stock_quantity || 0)) {
      toast.error("Stok tidak mencukupi");
      return;
    }
    
    if (newQuantity <= 0) {
      removeFromCart(id);
      return;
    }

    setCart(cart.map(item =>
      item.id === id
        ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
        : item
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    try {
      setLoading(true);

      // Generate transaction number
      const transactionNumber = `TRX-${Date.now()}`;

      // Create transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          transaction_number: transactionNumber,
          total_amount: subtotal,
          final_amount: total,
          payment_method: paymentMethod,
          status: 'completed'
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Add transaction items
      const transactionItems = cart.map(item => ({
        transaction_id: transaction.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems);

      if (itemsError) throw itemsError;

      // Update inventory (reduce stock)
      for (const item of cart) {
        await supabase
          .from('inventory')
          .update({
            stock_quantity: item.stock_quantity - item.quantity
          })
          .eq('product_id', item.id);
      }

      toast.success("Transaksi berhasil diproses!");
      clearCart();
      fetchProducts(); // Refresh product stock
    } catch (error: any) {
      toast.error("Gagal memproses transaksi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex gap-6">
      {/* Products Section */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Zeger Coffee POS</h1>
            <Badge variant="secondary" className="text-sm bg-primary/10 text-primary">
              ☕ {products.length} Menu Items
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Total Kategori: {categories.length}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Grid */}
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge 
                    className={`px-3 py-1 text-sm font-medium ${categoryColors[category] || 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    variant="outline"
                  >
                    {category}
                  </Badge>
                  <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent"></div>
                  <span className="text-xs text-muted-foreground">
                    {groupedProducts[category].length} item
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {groupedProducts[category].map((product) => (
                    <Card 
                      key={product.id} 
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 group border-2 hover:border-primary/20 relative overflow-hidden"
                      onClick={() => addToCart(product)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                      <CardHeader className="pb-3 relative z-10">
                        <CardTitle className="text-sm line-clamp-2 group-hover:text-primary transition-colors duration-200">
                          {product.name}
                        </CardTitle>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {product.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className="space-y-3">
                          <p className="text-base font-bold text-primary">
                            Rp {product.price.toLocaleString('id-ID')}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={
                                product.stock_quantity > 20 ? "default" : 
                                product.stock_quantity > 0 ? "secondary" : 
                                "destructive"
                              }
                              className="text-xs"
                            >
                              {product.stock_quantity > 0 ? 
                                `Stok: ${product.stock_quantity}` : 
                                'Habis'
                              }
                            </Badge>
                            <Button 
                              size="sm" 
                              disabled={product.stock_quantity <= 0}
                              className="h-7 w-7 p-0"
                              variant={product.stock_quantity <= 0 ? "outline" : "default"}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            
            {categories.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <Card className="w-96 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Keranjang ({cart.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cart Items */}
          <ScrollArea className="h-64">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keranjang kosong
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Rp {item.price.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Pajak (10%):</span>
              <span>Rp {tax.toLocaleString('id-ID')}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Metode Pembayaran:</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Tunai
                  </div>
                </SelectItem>
                <SelectItem value="qris">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    QRIS
                  </div>
                </SelectItem>
                <SelectItem value="transfer">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Transfer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              className="w-full" 
              size="lg"
              onClick={processPayment}
              disabled={cart.length === 0 || loading}
            >
              {loading ? "Memproses..." : `Bayar - Rp ${total.toLocaleString('id-ID')}`}
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Bersihkan
              </Button>
              <Button variant="outline" size="lg">
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default POS;