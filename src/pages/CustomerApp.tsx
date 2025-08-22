import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Star,
  Clock,
  Navigation,
  Gift
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface LoyaltyProgram {
  points: number;
  tier: string;
  nextTierPoints: number;
}

const CustomerApp = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyProgram>({
    points: 1250,
    tier: "Silver",
    nextTierPoints: 2000
  });
  const [nearbyRiders, setNearbyRiders] = useState([
    { id: 1, name: "Ahmad", distance: "0.5 km", eta: "5 min", rating: 4.8 },
    { id: 2, name: "Budi", distance: "1.2 km", eta: "8 min", rating: 4.9 },
    { id: 3, name: "Sari", distance: "2.1 km", eta: "12 min", rating: 4.7 }
  ]);
  const [activeView, setActiveView] = useState<'menu' | 'cart' | 'loyalty' | 'riders'>('menu');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat menu");
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group products by category
  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const category = product.category || 'Lainnya';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const categories = Object.keys(groupedProducts).sort();

  // Category icons for visual distinction
  const categoryIcons: Record<string, string> = {
    'Espresso Based': '☕',
    'Milk Based': '🥛',
    'Signature': '⭐',
    'Creampresso': '🍦',
    'Refresher': '🍃',
    'Topping': '🍯',
    'Syrup': '🍭'
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    
    toast.success(`${product.name} ditambahkan!`);
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
      return;
    }
    
    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const earnedPoints = Math.floor(totalAmount / 1000); // 1 point per 1000 rupiah

  const callRider = (riderId: number) => {
    const rider = nearbyRiders.find(r => r.id === riderId);
    toast.success(`${rider?.name} sedang menuju lokasi Anda! ETA: ${rider?.eta}`);
  };

  const renderMenu = () => (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-primary">Zeger Coffee</h1>
        <p className="text-muted-foreground">Kopi premium untuk hari yang sempurna</p>
      </div>

      {/* Loyalty Status */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <span className="font-medium">Level {loyaltyData.tier}</span>
            </div>
            <Badge variant="secondary">{loyaltyData.points} Poin</Badge>
          </div>
          <Progress 
            value={(loyaltyData.points / loyaltyData.nextTierPoints) * 100} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {loyaltyData.nextTierPoints - loyaltyData.points} poin lagi untuk level Gold
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari menu favorit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products */}
      <ScrollArea className="h-96">
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{categoryIcons[category] || '📋'}</span>
                <h3 className="font-bold text-base text-primary">{category}</h3>
                <div className="flex-1 h-px bg-border"></div>
                <Badge variant="outline" className="text-xs">
                  {groupedProducts[category].length} item
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedProducts[category].map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold">{product.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {product.description}
                          </p>
                          <p className="text-lg font-bold text-primary">
                            Rp {product.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          className="ml-4"
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
              <p className="text-muted-foreground">Tidak ada menu ditemukan</p>
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
    <div className="max-w-md mx-auto min-h-screen bg-gradient-to-b from-primary to-primary-light text-white">
      <div className="glass text-gray-900 min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur border-b p-4 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Zeger Coffee</h1>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveView('cart')}
              >
                <ShoppingCart className="h-4 w-4" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeView === 'menu' && renderMenu()}
          {activeView === 'cart' && renderCart()}
          {activeView === 'riders' && renderRiders()}
          {activeView === 'loyalty' && renderLoyalty()}
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t">
          <div className="grid grid-cols-4 gap-1 p-2">
            <Button
              variant={activeView === 'menu' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('menu')}
              className="flex flex-col gap-1 h-12"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">Menu</span>
            </Button>
            <Button
              variant={activeView === 'cart' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('cart')}
              className="flex flex-col gap-1 h-12"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Keranjang</span>
            </Button>
            <Button
              variant={activeView === 'riders' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('riders')}
              className="flex flex-col gap-1 h-12"
            >
              <MapPin className="h-4 w-4" />
              <span className="text-xs">Rider</span>
            </Button>
            <Button
              variant={activeView === 'loyalty' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('loyalty')}
              className="flex flex-col gap-1 h-12"
            >
              <Gift className="h-4 w-4" />
              <span className="text-xs">Poin</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerApp;