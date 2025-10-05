import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { 
  Home, 
  Ticket, 
  ClipboardList, 
  User,
  MapPin,
  ShoppingCart,
  Star,
  Gift,
  Plus,
  Minus,
  Phone,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerAuth } from '@/components/customer/CustomerAuth';
import { CustomerHome } from '@/components/customer/CustomerHome';
import { CustomerVouchers } from '@/components/customer/CustomerVouchers';
import { CustomerOrders } from '@/components/customer/CustomerOrders';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import CustomerMap from '@/components/customer/CustomerMap';
import { CustomerMenu } from '@/components/customer/CustomerMenu';
import { CustomerCart } from '@/components/customer/CustomerCart';
import { CustomerOutletList } from '@/components/customer/CustomerOutletList';
import { OrderDetail } from '@/components/customer/OrderDetail';
import CustomerCheckout from '@/components/customer/CustomerCheckout';
import CustomerOrderSuccess from '@/components/customer/CustomerOrderSuccess';
import { useToast } from '@/hooks/use-toast';

interface CustomerUser {
  id: string;
  name?: string;
  full_name?: string;
  email: string;
  phone: string;
  points: number;
  address: string;
  photo_url?: string;
  membership_level?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  custom_options: any;
}

interface CartItem extends Product {
  quantity: number;
  customizations: any;
}

type View = 'home' | 'vouchers' | 'orders' | 'profile' | 'map' | 'menu' | 'cart' | 'outlets' | 'checkout' | 'order-success';

export default function CustomerApp() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  
  // App state
  const [activeView, setActiveView] = useState<View>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  
  // Outlet selection state
  const [selectedOutlet, setSelectedOutlet] = useState<{
    id: string;
    name: string;
    address: string;
  } | null>(null);
  
  // Order success state
  const [lastOrderId, setLastOrderId] = useState<string>('');
  const [lastOrderNumber, setLastOrderNumber] = useState<string>('');
  const [lastOrderType, setLastOrderType] = useState<'outlet_pickup' | 'outlet_delivery'>('outlet_pickup');
  const [estimatedTime, setEstimatedTime] = useState<string>('15-30 menit');
  
  // Handle query params for order detail
  const tab = searchParams.get('tab');
  const orderId = searchParams.get('id');

  // Check authentication and fetch customer profile
  useEffect(() => {
    if (user) {
      fetchCustomerProfile();
    } else {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [user]);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Real-time subscription for active orders
  useEffect(() => {
    if (!customerUser?.id) return;

    const fetchActiveOrdersCount = async () => {
      const { count } = await supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', customerUser.id)
        .in('status', ['pending', 'accepted', 'on_the_way']);
      
      setActiveOrdersCount(count || 0);
    };

    fetchActiveOrdersCount();

    // Subscribe to order changes
    const channel = supabase
      .channel('customer_active_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `user_id=eq.${customerUser.id}`
        },
        (payload) => {
          console.log('Order update:', payload);
          fetchActiveOrdersCount();
          
          // Show toast notifications for status changes
          if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;
            
            if (newStatus !== oldStatus) {
              // Play notification sound
              const audio = new Audio('/notification.mp3');
              audio.play().catch(err => console.log('Audio failed:', err));
              
              // Show toast based on status
              if (newStatus === 'accepted') {
                toast({
                  title: "✅ Pesanan Diterima!",
                  description: "Rider telah menerima pesanan Anda",
                });
              } else if (newStatus === 'on_the_way') {
                toast({
                  title: "🚗 Rider Dalam Perjalanan!",
                  description: "Pesanan Anda sedang diantar",
                });
              } else if (newStatus === 'delivered') {
                toast({
                  title: "🎉 Pesanan Tiba!",
                  description: "Selamat menikmati kopi Zeger!",
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerUser, toast]);

  const fetchCustomerProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_users')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No profile exists, user needs to complete registration
        setIsAuthenticated(false);
      } else if (error) {
        throw error;
      } else {
        setCustomerUser(data);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error fetching customer profile:', error);
      toast({
        title: "Error",
        description: "Gagal memuat profil customer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addToCart = (product: Product, customizations: any = {}, quantity: number = 1) => {
    const cartKey = `${product.id}-${JSON.stringify(customizations)}`;
    const existingItem = cart.find(item => 
      `${item.id}-${JSON.stringify(item.customizations)}` === cartKey
    );

    if (existingItem) {
      setCart(cart.map(item =>
        `${item.id}-${JSON.stringify(item.customizations)}` === cartKey
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity, customizations }]);
    }

    toast({
      title: "Ditambahkan ke keranjang",
      description: `${product.name} berhasil ditambahkan`,
    });
  };

  const updateCartQuantity = (productId: string, customizations: any, newQuantity: number) => {
    const cartKey = `${productId}-${JSON.stringify(customizations)}`;
    
    if (newQuantity <= 0) {
      setCart(cart.filter(item => 
        `${item.id}-${JSON.stringify(item.customizations)}` !== cartKey
      ));
    } else {
      setCart(cart.map(item =>
        `${item.id}-${JSON.stringify(item.customizations)}` === cartKey
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleConfirmOrder = async (orderData: {
    outletId: string;
    orderType: 'outlet_pickup' | 'outlet_delivery';
    deliveryAddress?: string;
    deliveryLat?: number;
    deliveryLng?: number;
    paymentMethod: 'cash' | 'e_wallet' | 'qris';
    voucherId?: string;
    totalPrice: number;
    deliveryFee: number;
    discount: number;
  }) => {
    try {
      // 1. Insert customer_order
      const { data: order, error: orderError } = await supabase
        .from('customer_orders')
        .insert({
          user_id: customerUser!.id,
          outlet_id: orderData.outletId,
          order_type: orderData.orderType,
          delivery_address: orderData.deliveryAddress,
          latitude: orderData.deliveryLat,
          longitude: orderData.deliveryLng,
          payment_method: orderData.paymentMethod,
          voucher_id: orderData.voucherId,
          total_price: orderData.totalPrice,
          delivery_fee: orderData.deliveryFee,
          discount_amount: orderData.discount,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert customer_order_items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        custom_options: item.customizations
      }));

      const { error: itemsError } = await supabase
        .from('customer_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Update customer points
      const earnedPoints = Math.floor(orderData.totalPrice / 1000);
      const { error: pointsError } = await supabase
        .from('customer_users')
        .update({ points: (customerUser!.points || 0) + earnedPoints })
        .eq('id', customerUser!.id);

      if (pointsError) throw pointsError;

      // 4. Clear cart
      setCart([]);

      // 5. Navigate to success page
      setLastOrderId(order.id);
      setLastOrderNumber(order.id.slice(0, 8).toUpperCase());
      setLastOrderType(orderData.orderType);
      setEstimatedTime(
        orderData.orderType === 'outlet_pickup' 
          ? '15-30 menit' 
          : '~45 menit'
      );
      setActiveView('order-success');

      toast({
        title: "✅ Pesanan Berhasil!",
        description: "Pesanan Anda sedang diproses",
      });

    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: "Gagal membuat pesanan. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <ZegerLogo size="lg" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <CustomerAuth onAuthSuccess={() => {
      setIsAuthenticated(true);
      fetchCustomerProfile();
    }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header - Only show on cart, menu, checkout */}
      {['cart', 'menu', 'checkout'].includes(activeView) && (
        <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-2">
              <ZegerLogo size="sm" />
              <h1 className="font-bold text-sm text-primary">Zeger Coffee</h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 bg-amber-50 px-2 py-1 rounded-full">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-amber-700">
                  {customerUser?.points || 0}
                </span>
              </div>
              
              {cart.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="relative h-8"
                  onClick={() => setActiveView('cart')}
                >
                  <ShoppingCart className="h-3 w-3" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                  >
                    {getTotalItems()}
                  </Badge>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={cn("pb-20", activeView === 'home' && "pt-0")}>
        {tab === 'order-detail' && orderId ? (
          <OrderDetail 
            orderId={orderId} 
            userRole="customer"
            onBack={() => {
              setSearchParams({});
              setActiveView('orders');
            }}
          />
        ) : (
          <>
            {activeView === 'home' && (
              <CustomerHome 
                customerUser={customerUser} 
                onNavigate={setActiveView}
                recentProducts={products.slice(0, 6)}
                onAddToCart={addToCart}
              />
            )}
            {activeView === 'vouchers' && <CustomerVouchers customerUser={customerUser} />}
            {activeView === 'orders' && <CustomerOrders customerUser={customerUser} />}
            {activeView === 'profile' && <CustomerProfile customerUser={customerUser} onUpdateProfile={() => fetchCustomerProfile()} />}
            {activeView === 'map' && <CustomerMap />}
            {activeView === 'outlets' && (
              <CustomerOutletList 
                onNavigate={(view: string) => setActiveView(view as View)}
                onSelectOutlet={(outlet: any) => {
                  setSelectedOutlet({
                    id: outlet.id,
                    name: outlet.name,
                    address: outlet.address
                  });
                  setActiveView('menu');
                }}
              />
            )}
            {activeView === 'menu' && (
              <CustomerMenu 
                products={products}
                onAddToCart={addToCart}
                outletId={selectedOutlet?.id}
                outletName={selectedOutlet?.name}
                outletAddress={selectedOutlet?.address}
                onChangeOutlet={() => setActiveView('outlets')}
              />
            )}
            {activeView === 'cart' && (
              <CustomerCart 
                cart={cart}
                onUpdateQuantity={updateCartQuantity}
                onNavigate={(view: string) => {
                  if (view === 'checkout' && !selectedOutlet) {
                    // If trying to checkout without outlet, redirect to outlet selection
                    setActiveView('outlets');
                    toast({
                      title: "Pilih Outlet",
                      description: "Silakan pilih outlet terlebih dahulu",
                    });
                  } else if (view === 'map') {
                    // "Pesan Sekarang" now goes to checkout, not map
                    if (!selectedOutlet) {
                      setActiveView('outlets');
                      toast({
                        title: "Pilih Outlet",
                        description: "Silakan pilih outlet terlebih dahulu",
                      });
                    } else {
                      setActiveView('checkout');
                    }
                  } else {
                    setActiveView(view as View);
                  }
                }}
              />
            )}
            {activeView === 'checkout' && selectedOutlet && customerUser && (
              <CustomerCheckout
                cart={cart}
                outletId={selectedOutlet.id}
                outletName={selectedOutlet.name}
                outletAddress={selectedOutlet.address}
                customerUser={customerUser}
                onConfirm={handleConfirmOrder}
                onBack={() => setActiveView('cart')}
              />
            )}
            {activeView === 'order-success' && lastOrderId && (
              <CustomerOrderSuccess
                orderId={lastOrderId}
                orderNumber={lastOrderNumber}
                orderType={lastOrderType}
                outletName={selectedOutlet?.name}
                outletAddress={selectedOutlet?.address}
                estimatedTime={estimatedTime}
                onNavigate={(view: string, id?: string) => {
                  if (id) {
                    setSearchParams({ tab: 'order-detail', id });
                  } else {
                    setActiveView(view as View);
                  }
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="flex items-center justify-around py-3">
          <Button
            variant="ghost"
            className={cn("flex-col h-auto py-2 gap-1", activeView === 'home' ? 'text-red-500' : 'text-gray-500')}
            onClick={() => setActiveView('home')}
          >
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium">Home</span>
          </Button>
          <Button
            variant="ghost"
            className={cn("flex-col h-auto py-2 gap-1", activeView === 'menu' ? 'text-red-500' : 'text-gray-500')}
            onClick={() => {
              if (!selectedOutlet) {
                setActiveView('outlets');
              } else {
                setActiveView('menu');
              }
            }}
          >
            <Gift className="h-6 w-6" />
            <span className="text-xs font-medium">Menu</span>
          </Button>
          <Button
            variant="ghost"
            className={cn("flex-col h-auto py-2 gap-1 relative", activeView === 'orders' ? 'text-red-500' : 'text-gray-500')}
            onClick={() => setActiveView('orders')}
          >
            <Package className="h-6 w-6" />
            <span className="text-xs font-medium">Pesanan</span>
            {activeOrdersCount > 0 && (
              <Badge className="absolute top-0 right-6 h-5 w-5 flex items-center justify-center p-0 bg-red-500 border-2 border-white">
                {activeOrdersCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            className={cn("flex-col h-auto py-2 gap-1", activeView === 'profile' ? 'text-red-500' : 'text-gray-500')}
            onClick={() => setActiveView('profile')}
          >
            <User className="h-6 w-6" />
            <span className="text-xs font-medium">Akun</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}