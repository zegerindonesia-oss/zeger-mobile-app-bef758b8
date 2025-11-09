import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, DollarSign, CreditCard, Smartphone, LogOut, AlertCircle, X, MapPin, Users, Package } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { MobileSuccessModal } from "./MobileSuccessModal";
import { MobileCustomerQuickAdd } from "./MobileCustomerQuickAdd";
import { cn } from "@/lib/utils";
import { getTodayJakarta } from "@/lib/date";
interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
}
interface StockItem {
  id: string;
  product_id: string;
  product: Product;
  rider_stock: number;
}
interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

const MobileSellerEnhanced = () => {
  const {
    userProfile,
    signOut
  } = useAuth();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<{
    product_id: string;
    quantity: number;
  }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingStock, setPendingStock] = useState<StockItem[]>([]);
  const [receivedStock, setReceivedStock] = useState<StockItem[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [hasPendingStock, setHasPendingStock] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer' | ''>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  useEffect(() => {
    checkPreConditions();
    fetchSellingStock();
    fetchCustomers();
    getCurrentLocation();
  }, []);

  // Listen for live updates from stock management
  useEffect(() => {
    const handleStockReceived = () => {
      checkPreConditions();
      fetchSellingStock();
    };

    const handleShiftStarted = () => {
      checkPreConditions();
    };

    window.addEventListener('stock-received', handleStockReceived);
    window.addEventListener('shift-started', handleShiftStarted);
    
    return () => {
      window.removeEventListener('stock-received', handleStockReceived);
      window.removeEventListener('shift-started', handleShiftStarted);
    };
  }, []);

  const checkPreConditions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      // Check for active shift today using Jakarta timezone
      const today = getTodayJakarta();
      const { data: activeShifts } = await supabase
        .from('shift_management')
        .select('id')
        .eq('rider_id', profile.id)
        .eq('shift_date', today)
        .eq('status', 'active')
        .is('shift_end_time', null)
        .limit(1);

      let hasActiveShiftToday = activeShifts && activeShifts.length > 0;

      // Fallback: Check for any active shift without end time (for riders with wrong shift_date)
      if (!hasActiveShiftToday) {
        const { data: fallbackShifts } = await supabase
          .from('shift_management')
          .select('id, shift_date, shift_start_time')
          .eq('rider_id', profile.id)
          .eq('status', 'active')
          .is('shift_end_time', null)
          .limit(1);
          
        if (fallbackShifts && fallbackShifts.length > 0) {
          console.log('Found fallback active shift:', fallbackShifts[0]);
          hasActiveShiftToday = true;
        }
      }

      setHasActiveShift(hasActiveShiftToday);

      // Check for pending stock transfers
      const { data: pendingTransfers } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('rider_id', profile.id)
        .eq('movement_type', 'transfer')
        .eq('status', 'sent')
        .limit(1);

      setHasPendingStock((pendingTransfers?.length || 0) > 0);

    } catch (error: any) {
      console.error('Error checking preconditions:', error);
    }
  };
  const fetchSellingStock = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }
      const {
        data: profile,
        error: profileError
      } = await supabase.from('profiles').select('id, branch_id').eq('user_id', user.id).maybeSingle();
      if (profileError) {
        console.error('Profile fetch error:', profileError);
        toast.error("Gagal memuat profil rider");
        return;
      }
      if (!profile) {
        console.log('No profile found for user');
        return;
      }

      // Fetch rider's inventory with products for selling
      const {
        data: inventory,
        error: inventoryError
      } = await supabase.from('inventory').select(`
          *,
          products(id, name, price, category)
        `).eq('rider_id', profile.id).gt('stock_quantity', 0);
      if (inventoryError) {
        console.error('Inventory fetch error:', inventoryError);
        toast.error("Gagal memuat stok: " + inventoryError.message);
        return;
      }

      // Filter out items with null products and map to StockItem format
      const stockItems = inventory?.filter(item => item.products !== null && item.products !== undefined)?.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product: {
          ...item.products,
          stock_quantity: item.stock_quantity
        },
        rider_stock: item.stock_quantity
      })) || [];
      console.log('Stock items loaded:', stockItems.length);
      setStockItems(stockItems);
    } catch (error: any) {
      console.error('fetchSellingStock error:', error);
      toast.error("Gagal memuat stok penjualan: " + error.message);
    }
  };
  const fetchCustomers = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data: profile
      } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!profile) return;
      const {
        data: customers
      } = await supabase.from('customers').select('id, name, phone, address').eq('rider_id', profile.id).eq('is_active', true).order('name');
      setCustomers(customers || []);
    } catch (error: any) {
      toast.error("Gagal memuat data pelanggan");
    }
  };
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const {
          latitude,
          longitude
        } = position.coords;
        setCurrentLocation({
          lat: latitude,
          lng: longitude,
          name: `Lokasi ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        });
      }, error => {
        console.log('Location error:', error);
        // Don't show error toast for location, it's optional
      });
    }
  };
  const addToCart = (productId: string) => {
    const stockItem = stockItems.find(item => item.product_id === productId);
    if (!stockItem) return;
    const currentCartItem = cart.find(item => item.product_id === productId);
    const currentQuantity = currentCartItem?.quantity || 0;
    if (currentQuantity >= stockItem.rider_stock) {
      toast.error("Stok tidak mencukupi");
      return;
    }
    if (currentCartItem) {
      setCart(cart.map(item => item.product_id === productId ? {
        ...item,
        quantity: item.quantity + 1
      } : item));
    } else {
      setCart([...cart, {
        product_id: productId,
        quantity: 1
      }]);
    }
    toast.success("Ditambahkan ke keranjang");
  };
  const removeFromCart = (productId: string) => {
    const currentCartItem = cart.find(item => item.product_id === productId);
    if (!currentCartItem) return;
    if (currentCartItem.quantity === 1) {
      setCart(cart.filter(item => item.product_id !== productId));
    } else {
      setCart(cart.map(item => item.product_id === productId ? {
        ...item,
        quantity: item.quantity - 1
      } : item));
    }
    toast.success("Dihapus dari keranjang");
  };
  const processTransaction = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    if (!paymentMethod) {
      toast.error("Pilih metode pembayaran terlebih dahulu");
      return;
    }

    // Check payment proof for non-cash payments
    const paymentProofInput = document.getElementById('payment-proof') as HTMLInputElement;
    if ((paymentMethod === 'qris' || paymentMethod === 'transfer') && !paymentProofInput?.files?.[0]) {
      toast.error("Bukti pembayaran wajib diupload untuk metode pembayaran non-tunai");
      return;
    }
    setLoading(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      const {
        data: profile
      } = await supabase.from('profiles').select('id, branch_id').eq('user_id', user?.id).maybeSingle();
      let paymentProofUrl = '';

      // Upload payment proof if exists
      if (paymentProofInput?.files?.[0]) {
        const file = paymentProofInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/payment-${Date.now()}.${fileExt}`;
        const {
          error: uploadError
        } = await supabase.storage.from('payment-proofs').upload(fileName, file);
        if (uploadError) throw uploadError;
        const {
          data: {
            publicUrl
          }
        } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
        paymentProofUrl = publicUrl;
      }

      // Calculate transaction totals
      let totalAmount = 0;
      const transactionItems = cart.map(cartItem => {
        const stockItem = stockItems.find(s => s.product_id === cartItem.product_id);
        const itemTotal = stockItem!.product.price * cartItem.quantity;
        totalAmount += itemTotal;
        return {
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          unit_price: stockItem!.product.price,
          total_price: itemTotal
        };
      });

      const discountAmount = calculateDiscount(totalAmount);
      let finalAmount = Math.max(0, totalAmount - discountAmount);
      
      // Safety check: Prevent Rp 0 transactions when items exist
      if (finalAmount === 0 && totalAmount > 0) {
        console.error('Transaction would have Rp 0 final amount. Using total instead.');
        toast.error("Diskon terlalu besar. Diskon dibatalkan untuk transaksi ini.");
        finalAmount = totalAmount;
      }

      // Create transaction
      const transactionNumber = `TRX-${Date.now()}`;
      const {
        data: transaction,
        error: transactionError
      } = await supabase.from('transactions').insert([{
        transaction_number: transactionNumber,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_method: paymentMethod,
        payment_proof_url: paymentProofUrl,
        status: 'completed',
        rider_id: profile?.id,
        branch_id: profile?.branch_id,
        customer_id: selectedCustomer && selectedCustomer !== 'general' && selectedCustomer !== '' ? selectedCustomer : null,
        transaction_latitude: currentLocation?.lat || null,
        transaction_longitude: currentLocation?.lng || null,
        location_name: currentLocation?.name || null
      }]).select().single();
      if (transactionError) throw transactionError;

      // Add transaction items
      const itemsWithTransactionId = transactionItems.map(item => ({
        ...item,
        transaction_id: transaction.id
      }));
      const {
        error: itemsError
      } = await supabase.from('transaction_items').insert(itemsWithTransactionId);
      if (itemsError) throw itemsError;

      // Update rider stock
      for (const cartItem of cart) {
        const stockItem = stockItems.find(s => s.product_id === cartItem.product_id);
        if (stockItem) {
          await supabase.from('inventory').update({
            stock_quantity: stockItem.rider_stock - cartItem.quantity
          }).eq('id', stockItem.id);
        }
      }
      setCart([]);
      setPaymentMethod(''); // Reset payment method to force selection
      setSelectedCustomer('');
      setDiscountValue(0);
      setShowSuccessModal(true);
      fetchSellingStock(); // Refresh stock
    } catch (error: any) {
      toast.error("Gagal memproses transaksi: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  const calculateCartTotal = () => {
    return cart.reduce((total, cartItem) => {
      const stockItem = stockItems.find(s => s.product_id === cartItem.product_id);
      return total + (stockItem ? stockItem.product.price * cartItem.quantity : 0);
    }, 0);
  };

  const calculateDiscount = (subtotal: number) => {
    if (discountType === 'percentage') {
      const percentageDiscount = (subtotal * discountValue) / 100;
      // Cap percentage discount at 100%
      return Math.min(percentageDiscount, subtotal);
    }
    // Cap amount discount at subtotal (prevent negative final amount)
    return Math.min(discountValue, subtotal);
  };

  const calculateFinalTotal = () => {
    const subtotal = calculateCartTotal();
    const discount = calculateDiscount(subtotal);
    const final = Math.max(0, subtotal - discount);
    
    // Additional safety check: if items exist but final is 0, use subtotal
    if (cart.length > 0 && final === 0 && subtotal > 0) {
      console.warn('Final amount is 0 but cart has items. Using subtotal instead.');
      return subtotal;
    }
    
    return final;
  };
  return <div className="w-full max-w-md mx-auto min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white overflow-x-hidden">
      <div className="bg-white/95 backdrop-blur-md text-gray-800 min-h-screen p-4 pb-32 max-w-full">
        {/* Header */}
        
        {/* Blocking screens for preconditions */}
        {!hasActiveShift ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">Shift Belum Aktif</h3>
            <p className="text-muted-foreground mb-4">
              Shift akan otomatis dimulai saat Anda konfirmasi penerimaan stok. Silakan ke halaman "Kelola Stok" untuk konfirmasi stok dari branch hub.
            </p>
            <Button onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }))}>
              Ke Kelola Stok
            </Button>
          </div>
        ) : stockItems.length === 0 ? (
      // No stock available
      <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Belum Ada Stok</h3>
            <p className="text-muted-foreground mb-4">
              Silakan konfirmasi penerimaan barang di halaman "Kelola Shift" terlebih dahulu
            </p>
            <Button onClick={checkPreConditions} variant="outline">
              Refresh
            </Button>
          </div>
        ) : (
      // Sales interface
      <div className="space-y-6">
            {/* Pending stock warning banner */}
            {hasPendingStock && (
              <Card className="relative z-0 border-orange-200 bg-orange-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Package className="h-4 w-4" />
                    <p className="text-sm font-medium">
                      Masih ada stok yang belum dikonfirmasi. Konfirmasi segera untuk kelancaran operasional.
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'stock' }))}
                  >
                    Ke Kelola Stok
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Zeger Coffee OTW</h2>
                <p className="text-muted-foreground">Produk untuk Dijual</p>
              </div>
              <Badge variant="secondary">{cart.reduce((sum, item) => sum + item.quantity, 0)} item</Badge>
            </div>

            {/* Customer Section - Above Products */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Pilih Pelanggan
                  </CardTitle>
                  <MobileCustomerQuickAdd onCustomerAdded={fetchCustomers} />
                </div>
              </CardHeader>
              <CardContent>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pelanggan atau kosongkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Pelanggan Umum</SelectItem>
                    {customers.filter(customer => customer.id && customer.name).map(customer => <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone && `(${customer.phone})`}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari produk..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>

            <ScrollArea className="h-80">
              <div className="space-y-3">
                {stockItems
                  .filter(item => item.product.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .sort((a, b) => b.rider_stock - a.rider_stock)
                  .map(item => {
              const cartItem = cart.find(c => c.product_id === item.product_id);
              const inCartQuantity = cartItem?.quantity || 0;
                return <div 
                          key={item.id} 
                          className="flex items-center justify-between p-4 bg-card rounded-lg border cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors"
                          onClick={() => addToCart(item.product_id)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-lg font-bold text-primary">Rp {item.product.price.toLocaleString('id-ID')}</p>
                            <p className="text-sm text-muted-foreground">
                              Stok: {item.rider_stock} | Di keranjang: {inCartQuantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={inCartQuantity <= 0}
                              onClick={(e) => { e.stopPropagation(); removeFromCart(item.product_id); }}
                            >
                                -
                            </Button>
                            <span className="min-w-8 text-center font-medium bg-muted px-2 py-1 rounded">
                              {inCartQuantity}
                            </span>
                            <Button 
                              disabled={inCartQuantity >= item.rider_stock || item.rider_stock <= 0} 
                              onClick={(e) => { e.stopPropagation(); addToCart(item.product_id); }} 
                              size="sm"
                            >
                              +
                            </Button>
                          </div>
                        </div>;
            })}
              </div>
            </ScrollArea>

            {/* Cart Summary */}
            {cart.length > 0 && <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Keranjang Belanja</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cart.map(cartItem => {
              const stockItem = stockItems.find(s => s.product_id === cartItem.product_id);
              if (!stockItem) return null;
              return <div key={cartItem.product_id} className="flex justify-between text-sm">
                        <span>{stockItem.product.name} x{cartItem.quantity}</span>
                        <span>Rp {(stockItem.product.price * cartItem.quantity).toLocaleString('id-ID')}</span>
                      </div>;
            })}
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rp {calculateCartTotal().toLocaleString('id-ID')}</span>
                    </div>
                    {discountValue > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Diskon ({discountType === 'percentage' ? `${discountValue}%` : `Rp ${discountValue.toLocaleString('id-ID')}`}):</span>
                        <span>-Rp {calculateDiscount(calculateCartTotal()).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>Rp {calculateFinalTotal().toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>}


            {/* Discount Section */}
            {cart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Diskon</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={discountType === 'amount' ? 'default' : 'outline'}
                      onClick={() => setDiscountType('amount')}
                      size="sm"
                      className="flex-1"
                    >
                      Rp
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === 'percentage' ? 'default' : 'outline'}
                      onClick={() => setDiscountType('percentage')}
                      size="sm"
                      className="flex-1"
                    >
                      %
                    </Button>
                  </div>
                  <Input
                    type="number"
                    placeholder={discountType === 'percentage' ? 'Masukkan persentase' : 'Masukkan jumlah'}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    min="0"
                    max={discountType === 'percentage' ? '100' : undefined}
                  />
                </CardContent>
              </Card>
            )}

            {/* Location Info */}
            {currentLocation && <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                📍 {currentLocation.name}
              </div>}

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Metode Pembayaran: <span className="text-red-500">*</span></label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    "flex-1 min-w-[100px] rounded-full h-12 text-sm md:text-base font-semibold transition-all",
                    paymentMethod === 'cash' 
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.5)]" 
                      : "bg-red-500 hover:bg-red-600 text-white shadow-md"
                  )}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Tunai
                </Button>
                <Button
                  type="button"
                  onClick={() => setPaymentMethod('qris')}
                  className={cn(
                    "flex-1 min-w-[100px] rounded-full h-12 text-sm md:text-base font-semibold transition-all",
                    paymentMethod === 'qris' 
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.5)]" 
                      : "bg-red-500 hover:bg-red-600 text-white shadow-md"
                  )}
                >
                  <Smartphone className="h-4 w-4 mr-1" />
                  QRIS
                </Button>
                <Button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={cn(
                    "flex-1 min-w-[100px] rounded-full h-12 text-sm md:text-base font-semibold transition-all",
                    paymentMethod === 'transfer' 
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.5)]" 
                      : "bg-red-500 hover:bg-red-600 text-white shadow-md"
                  )}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Transfer
                </Button>
              </div>
              {!paymentMethod && (
                <p className="text-xs text-red-500">* Pilih metode pembayaran sebelum memproses transaksi</p>
              )}
            </div>

            {/* Payment Proof Upload for Non-Cash */}
            {(paymentMethod === 'qris' || paymentMethod === 'transfer') && <div className="space-y-2">
                <label className="text-sm font-medium text-red-600">Bukti Pembayaran *</label>
                <input type="file" accept="image/*" id="payment-proof" className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" required />
                <p className="text-xs text-red-600">
                  *Wajib upload foto bukti pembayaran untuk {paymentMethod === 'qris' ? 'QRIS' : 'Transfer Bank'}
                </p>
              </div>}

            {/* Transaction Button */}
            <Button 
              className="w-full h-12 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500" 
              onClick={processTransaction} 
              disabled={cart.length === 0 || loading || !paymentMethod}
            >
              {loading ? "Memproses..." : `Proses Transaksi (Rp ${calculateCartTotal().toLocaleString('id-ID')})`}
            </Button>

            {/* Success Modal */}
            <MobileSuccessModal
              isOpen={showSuccessModal}
              onClose={() => setShowSuccessModal(false)}
              title="Transaksi Berhasil"
            />
          </div>
        )}

        {/* Customer Quick Add - shown regardless of stock status */}
        <MobileCustomerQuickAdd onCustomerAdded={fetchCustomers} />
      </div>
    </div>;
};
export default MobileSellerEnhanced;