import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { CustomerMap } from '@/components/customer/CustomerMap';
import { CustomerMenu } from '@/components/customer/CustomerMenu';
import { CustomerCart } from '@/components/customer/CustomerCart';
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

type View = 'home' | 'vouchers' | 'orders' | 'profile' | 'map' | 'menu' | 'cart';

export default function CustomerApp() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  
  // App state
  const [activeView, setActiveView] = useState<View>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="flex items-center justify-around py-2">
          {[
            { key: 'home', icon: Home, label: 'Home' },
            { key: 'vouchers', icon: Ticket, label: 'Voucher' },
            { key: 'orders', icon: ClipboardList, label: 'Pesanan' },
            { key: 'profile', icon: User, label: 'Akun' }
          ].map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center space-y-1 h-auto py-2 px-3 ${
                activeView === key ? 'text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveView(key as View)}
            >
              <Icon className={`h-5 w-5 ${activeView === key ? 'fill-primary/20' : ''}`} />
              <span className="text-xs font-medium">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}