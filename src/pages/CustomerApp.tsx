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
  Phone
} from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  address: string;
  photo_url?: string;
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

type View = 'home' | 'vouchers' | 'orders' | 'profile' | 'map' | 'menu' | 'cart' | 'outlets';

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
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <ZegerLogo size="sm" />
            <div>
              <h1 className="font-bold text-lg text-primary">Zeger Coffee</h1>
              <p className="text-xs text-muted-foreground">Hi, {customerUser?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-amber-50 px-3 py-1 rounded-full">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium text-amber-700">
                {customerUser?.points || 0}
              </span>
            </div>
            
            {cart.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="relative"
                onClick={() => setActiveView('cart')}
              >
                <ShoppingCart className="h-4 w-4" />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {getTotalItems()}
                </Badge>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pb-20">
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
              />
            )}
            {activeView === 'menu' && (
              <CustomerMenu 
                products={products}
                onAddToCart={addToCart}
              />
            )}
            {activeView === 'cart' && (
              <CustomerCart 
                cart={cart}
                onUpdateQuantity={updateCartQuantity}
                onNavigate={(view: string) => setActiveView(view as View)}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="flex items-center justify-around py-2">
          {[
            { key: 'home', icon: Home, label: 'Home', badge: 0 },
            { key: 'vouchers', icon: Ticket, label: 'Voucher', badge: 0 },
            { key: 'orders', icon: ClipboardList, label: 'Pesanan', badge: activeOrdersCount },
            { key: 'profile', icon: User, label: 'Akun', badge: 0 }
          ].map(({ key, icon: Icon, label, badge }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={`relative flex flex-col items-center space-y-1 h-auto py-2 px-3 touch-target ${
                activeView === key ? 'text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveView(key as View)}
            >
              <Icon className={`h-5 w-5 ${activeView === key ? 'fill-primary/20' : ''}`} />
              <span className="text-xs font-medium">{label}</span>
              {badge > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs badge-pulse"
                >
                  {badge}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}