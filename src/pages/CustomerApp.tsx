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
        <CustomerHome 
          customerUser={customerUser} 
          onNavigate={setActiveView}
          recentProducts={products.slice(0, 6)}
          onAddToCart={addToCart}
        />
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
    <div className="space-y-6 pb-20">
      <div className="text-center py-4">
        <ZegerLogo size="md" />
        <p className="text-gray-600 mt-2">Kopi premium untuk hari yang sempurna</p>
      </div>

      {/* Loyalty Status */}
      <Card className="bg-gradient-to-r from-red-500/10 to-red-600/5 border-red-200 shadow-soft rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-red-600" />
              <span className="font-medium text-gray-800">Level {loyaltyData.tier}</span>
            </div>
            <Badge className="bg-red-100 text-red-700 border-red-200">{loyaltyData.points} Poin</Badge>
          </div>
          <Progress 
            value={(loyaltyData.points / loyaltyData.nextTierPoints) * 100} 
            className="h-2"
          />
          <p className="text-xs text-gray-600 mt-2">
            {loyaltyData.nextTierPoints - loyaltyData.points} poin lagi untuk level Gold
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          placeholder="Cari menu favorit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white/80 border-red-100 focus:border-red-300 rounded-xl shadow-soft"
        />
      </div>

      {/* Products */}
      <ScrollArea className="h-96">
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{categoryIcons[category] || '📋'}</span>
                <h3 className="font-bold text-base text-red-700">{category}</h3>
                <div className="flex-1 h-px bg-red-200"></div>
                <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                  {groupedProducts[category].length} item
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedProducts[category].map((product) => (
                  <Card key={product.id} className="bg-white/90 border-red-100 shadow-soft rounded-xl overflow-hidden hover:shadow-glow transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{product.name}</h4>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {product.description}
                          </p>
                          <p className="text-lg font-bold text-red-600">
                            Rp {product.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          className="ml-4 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-xl shadow-md"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          
          {categories.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Tidak ada menu ditemukan</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderCart = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Keranjang Belanja</h2>

      {cart.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Keranjang masih kosong</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setActiveView('menu')}
          >
            Mulai Belanja
          </Button>
        </div>
      ) : (
        <>
          <ScrollArea className="h-64">
            <div className="space-y-4">
              {cart.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-primary font-bold">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-bold">Rp {totalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm text-primary">
                  <span>Poin yang didapat</span>
                  <span>+{earnedPoints} poin</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-12"
            onClick={() => setActiveView('riders')}
          >
            Pesan Sekarang
          </Button>
        </>
      )}
    </div>
  );

  const renderRiders = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Pilih Rider Terdekat</h2>
        <p className="text-muted-foreground">Rider sedang online di sekitar Anda</p>
      </div>

      <div className="space-y-4">
        {nearbyRiders.map((rider) => (
          <Card key={rider.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{rider.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{rider.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{rider.distance}</span>
                      <Clock className="h-3 w-3" />
                      <span>{rider.eta}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs">{rider.rating}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm"
                  onClick={() => callRider(rider.id)}
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  Panggil
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <Button 
          variant="outline" 
          onClick={() => setActiveView('cart')}
        >
          Kembali ke Keranjang
        </Button>
      </div>
    </div>
  );

  const renderLoyalty = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Program Loyalitas</h2>
        <p className="text-muted-foreground">Kumpulkan poin dan dapatkan reward</p>
      </div>

      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-6 text-center">
          <Gift className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Level {loyaltyData.tier}</h3>
          <p className="text-3xl font-bold mb-4">{loyaltyData.points} Poin</p>
          <Progress 
            value={(loyaltyData.points / loyaltyData.nextTierPoints) * 100} 
            className="h-3 bg-primary-foreground/20"
          />
          <p className="text-sm mt-3 opacity-90">
            {loyaltyData.nextTierPoints - loyaltyData.points} poin lagi untuk level Gold
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <h4 className="font-medium mb-2">Tukar 500 Poin</h4>
            <p className="text-sm text-muted-foreground mb-3">Gratis Americano</p>
            <Button size="sm" variant="outline" disabled={loyaltyData.points < 500}>
              Tukar
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <h4 className="font-medium mb-2">Tukar 1000 Poin</h4>
            <p className="text-sm text-muted-foreground mb-3">Diskon 20%</p>
            <Button size="sm" variant="outline" disabled={loyaltyData.points < 1000}>
              Tukar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cara Mendapat Poin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">1 Poin per Rp 1.000</p>
              <p className="text-sm text-muted-foreground">Setiap pembelian</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Star className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">50 Poin Bonus</p>
              <p className="text-sm text-muted-foreground">Rating 5 bintang</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white">
      <div className="bg-white/95 backdrop-blur-md text-gray-900 min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-lg border-b border-red-100 p-4 z-10 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ZegerLogo size="sm" />
              <div>
                <h1 className="text-lg font-bold text-gray-800">Zeger Coffee</h1>
                <p className="text-sm text-gray-600">Kopi Premium Indonesia</p>
              </div>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveView('cart')}
                className="bg-white/80 border-red-200 hover:bg-red-50 transition-all shadow-soft"
              >
                <ShoppingCart className="h-4 w-4 text-red-600" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 bg-white/80 backdrop-blur-sm min-h-screen">
          {activeView === 'menu' && renderMenu()}
          {activeView === 'cart' && renderCart()}
          {activeView === 'riders' && renderRiders()}
          {activeView === 'loyalty' && renderLoyalty()}
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-red-100 shadow-lg">
          <div className="grid grid-cols-4 gap-1 p-2">
            <Button
              variant={activeView === 'menu' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('menu')}
              className={`flex flex-col gap-1 h-12 ${
                activeView === 'menu' 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">Menu</span>
            </Button>
            <Button
              variant={activeView === 'cart' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('cart')}
              className={`flex flex-col gap-1 h-12 ${
                activeView === 'cart' 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Keranjang</span>
            </Button>
            <Button
              variant={activeView === 'loyalty' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('loyalty')}
              className={`flex flex-col gap-1 h-12 ${
                activeView === 'loyalty' 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <Gift className="h-4 w-4" />
              <span className="text-xs">Poin</span>
            </Button>
            <Button
              variant={activeView === 'riders' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('riders')}
              className={`flex flex-col gap-1 h-12 ${
                activeView === 'riders' 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <Navigation className="h-4 w-4" />
              <span className="text-xs">Rider</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerApp;