import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Store, Plus, Coffee, Sandwich, IceCream, Pizza, Salad, Cake, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  custom_options: any;
}

interface CustomerMenuProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  outletId?: string;
  outletName?: string;
  outletAddress?: string;
  onChangeOutlet?: () => void;
  cartItemCount: number;
  onViewCart: () => void;
}

type OrderType = 'dine-in' | 'take-away' | 'delivery';

export function CustomerMenu({ 
  products, 
  onAddToCart,
  outletId,
  outletName,
  outletAddress,
  onChangeOutlet,
  cartItemCount,
  onViewCart
}: CustomerMenuProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [orderType, setOrderType] = useState<OrderType>('take-away');
  
  // Get featured products for Daily Special
  const featuredProducts = useMemo(() => {
    return products.filter(p => p.image_url).slice(0, 5);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const groupedProducts = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    filteredProducts.forEach(product => {
      const category = product.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });
    return groups;
  }, [filteredProducts]);

  const categories = useMemo(() => {
    return ['all', ...Object.keys(groupedProducts)];
  }, [groupedProducts]);

  const getCategoryIcon = (category: string) => {
    const iconMap: { [key: string]: any } = {
      'all': Store,
      'Coffee': Coffee,
      'Kopi': Coffee,
      'Food': Sandwich,
      'Makanan': Sandwich,
      'Dessert': IceCream,
      'Minuman': Coffee,
      'Snack': Cake,
      'Pastry': Cake,
      'Pizza': Pizza,
      'Salad': Salad
    };
    
    // Try exact match first
    const exactMatch = iconMap[category];
    if (exactMatch) return exactMatch;
    
    // Try partial match
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('kopi') || lowerCategory.includes('coffee')) return Coffee;
    if (lowerCategory.includes('makan') || lowerCategory.includes('food')) return Sandwich;
    if (lowerCategory.includes('dessert') || lowerCategory.includes('manis')) return IceCream;
    
    return Coffee; // Default
  };

  const displayProducts = activeCategory === 'all' 
    ? filteredProducts 
    : groupedProducts[activeCategory] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Order Type Tabs */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-full">
          <button
            onClick={() => setOrderType('dine-in')}
            className={cn(
              "flex-1 py-2 px-3 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1",
              orderType === 'dine-in' 
                ? "bg-red-500 text-white shadow-md" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <span className="text-lg">🍽️</span>
            Dine In
          </button>
          <button
            onClick={() => setOrderType('take-away')}
            className={cn(
              "flex-1 py-2 px-3 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1",
              orderType === 'take-away' 
                ? "bg-red-500 text-white shadow-md" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <span className="text-lg">🚶</span>
            Take Away
          </button>
          <button
            onClick={() => setOrderType('delivery')}
            className={cn(
              "flex-1 py-2 px-3 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1",
              orderType === 'delivery' 
                ? "bg-red-500 text-white shadow-md" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <span className="text-lg">🏍️</span>
            Delivery
          </button>
        </div>
      </div>

      {/* Outlet Selection Card */}
      {outletName && (
        <div className="px-4 py-3 bg-white border-b">
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Store className="h-6 w-6 text-red-500" />
              <div>
                <p className="text-sm font-bold text-gray-900">{outletName}</p>
                {outletAddress && <p className="text-xs text-gray-500">{outletAddress}</p>}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold"
              onClick={onChangeOutlet}
            >
              Ubah
            </Button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search menu"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 rounded-lg bg-gray-100 border-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Daily Special Carousel */}
      {featuredProducts.length > 0 && (
        <div className="px-4 py-3 bg-white">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            Daily Special <span className="text-orange-500">✨</span>
          </h2>
          
          <div className="relative h-56 rounded-2xl overflow-hidden shadow-lg">
            <div className="absolute inset-0">
              <img
                src={featuredProducts[0].image_url || ''}
                alt={featuredProducts[0].name}
                className="w-full h-full object-cover"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              {/* Product Info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-bold text-lg mb-1">{featuredProducts[0].name}</h3>
                <p className="text-sm opacity-90 mb-3">
                  {featuredProducts[0].description || 'Produk spesial hari ini!'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">
                    Rp {featuredProducts[0].price.toLocaleString('id-ID')}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => onAddToCart(featuredProducts[0])}
                    className="bg-green-500 hover:bg-green-600 rounded-full text-white px-4"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area with Sidebar */}
      <div className="flex h-[calc(100vh-280px)]">
        {/* Category Sidebar */}
        <div className="w-24 bg-white border-r">
          <ScrollArea className="h-full">
            <div className="py-2">
              {categories.map((category) => {
                const Icon = getCategoryIcon(category);
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "w-full py-4 px-2 flex flex-col items-center gap-1 transition-all",
                      activeCategory === category
                        ? "bg-red-50 border-r-4 border-red-500"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6",
                      activeCategory === category ? "text-red-500" : "text-gray-400"
                    )} />
                    <span className={cn(
                      "text-xs font-medium text-center",
                      activeCategory === category ? "text-red-500" : "text-gray-600"
                    )}>
                      {category === 'all' ? 'Semua' : category}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 grid grid-cols-2 gap-3 pb-20">
              {displayProducts.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <p className="text-gray-500">Tidak ada produk ditemukan</p>
                </div>
              ) : (
                displayProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all border-0 bg-white"
                  >
                    {/* Product Image */}
                    <div className="aspect-square relative bg-gray-50">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                          <Coffee className="h-16 w-16 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3">
                      <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-bold text-red-500">
                          Rp {product.price.toLocaleString('id-ID')}
                        </p>
                        <button
                          onClick={() => onAddToCart(product)}
                          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:scale-110 transition-all"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <button
          onClick={onViewCart}
          className="fixed bottom-24 right-6 z-50 w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all"
        >
          <ShoppingCart className="h-7 w-7 text-white" />
          <span className="absolute -top-2 -right-2 bg-white text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 border-red-600">
            {cartItemCount}
          </span>
        </button>
      )}
    </div>
  );
}