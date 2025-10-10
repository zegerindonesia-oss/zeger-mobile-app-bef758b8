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
    const icons: { [key: string]: any } = {
      'all': Store,
      'Coffee': Coffee,
      'Food': Sandwich,
      'Dessert': IceCream,
      'Pizza': Pizza,
      'Salad': Salad,
      'Cake': Cake
    };
    return icons[category] || Coffee;
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
              "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
              orderType === 'dine-in' 
                ? "bg-red-500 text-white shadow-md" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Dine In
          </button>
          <button
            onClick={() => setOrderType('take-away')}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
              orderType === 'take-away' 
                ? "bg-red-500 text-white shadow-md" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Take Away
          </button>
          <button
            onClick={() => setOrderType('delivery')}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
              orderType === 'delivery' 
                ? "bg-red-500 text-white shadow-md" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Delivery
          </button>
        </div>
      </div>

      {/* Outlet Selection Card */}
      {outletName && (
        <div className="px-4 py-3 bg-white border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Store className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{outletName}</p>
                <p className="text-xs text-gray-500">{outletAddress}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
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
            placeholder="Search menu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-full border-2 border-gray-200 focus:border-red-500"
          />
        </div>
      </div>

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
                    className="overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all border-0"
                  >
                    {/* Product Image */}
                    <div className="aspect-square relative bg-gray-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Coffee className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                      {/* Product Click Area */}
                      <button
                        onClick={() => onAddToCart(product)}
                        className="absolute inset-0 w-full h-full"
                      >
                        <span className="sr-only">View {product.name}</span>
                      </button>
                    </div>

                    {/* Product Info */}
                    <button 
                      onClick={() => onAddToCart(product)}
                      className="p-3 w-full text-left"
                    >
                      <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-red-500">
                          Rp {product.price.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </button>
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