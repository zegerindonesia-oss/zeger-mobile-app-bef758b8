import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Minus, Flame, ShoppingBag, Bike } from 'lucide-react';
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

interface CustomerProductDetailProps {
  product: Product;
  orderType: 'dine-in' | 'take-away' | 'delivery';
  onBack: () => void;
  onAddToCart: (product: Product, quantity: number, customizations: any) => void;
  cartItemCount: number;
  onViewCart: () => void;
}

export function CustomerProductDetail({ 
  product, 
  orderType,
  onBack, 
  onAddToCart,
  cartItemCount,
  onViewCart
}: CustomerProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState<'hot' | 'ice'>('ice');
  const [size, setSize] = useState<'regular' | 'large' | 'ultimate'>('regular');
  const [blend, setBlend] = useState<'senja' | 'pagi'>('senja');

  const getCustomPrice = () => {
    let price = product.price;
    if (size === 'large') price += 5000;
    if (size === 'ultimate') price += 10000;
    return price;
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity, {
      temperature, size, blend
    });
  };

  const totalPrice = getCustomPrice() * quantity;

  return (
    <div className="min-h-screen bg-[#f8f6f6]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white sticky top-0 shadow-sm z-10">
        <button onClick={onBack} className="text-gray-900">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{product.name}</h1>
        <div className="w-8"></div>
      </header>

      <main className="p-4 space-y-6">
        {/* Product Card with Image */}
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center">
          <img 
            src={product.image_url || '/placeholder.svg'} 
            alt={product.name}
            className="w-40 h-64 object-cover rounded-lg"
          />
          
          {/* Badge Icons Row */}
          <div className="flex items-center space-x-2 mt-4">
            <div className="bg-red-100 p-2 rounded-full">
              <Flame className="h-5 w-5 text-[#EA2831]" />
            </div>
            <div className="bg-red-100 p-2 rounded-full">
              <ShoppingBag className="h-5 w-5 text-[#EA2831]" />
            </div>
            <div className="bg-red-100 p-2 rounded-full">
              <Bike className="h-5 w-5 text-[#EA2831]" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mt-4 text-gray-900">{product.name}</h2>
          <p className="text-center text-gray-600 mt-2 text-sm">
            {product.description || 'Premium quality coffee'}
          </p>
        </div>

        {/* Customization Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {/* Temp */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Temp</h3>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setTemperature('hot')}
                className={cn(
                  "col-span-1 py-3 px-4 rounded-lg font-medium transition-all",
                  temperature === 'hot' 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "bg-[#f8f6f6] text-gray-700"
                )}
              >
                Hot
              </button>
              <button 
                onClick={() => setTemperature('ice')}
                className={cn(
                  "col-span-2 py-3 px-4 rounded-lg font-medium transition-all",
                  temperature === 'ice' 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "bg-[#f8f6f6] text-gray-700"
                )}
              >
                Ice
              </button>
            </div>
          </div>

          {/* Size */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Size</h3>
            <div className="grid grid-cols-3 gap-3">
              {['ultimate', 'large', 'regular'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s as any)}
                  className={cn(
                    "py-3 px-4 rounded-lg font-medium transition-all",
                    size === s 
                      ? "bg-indigo-600 text-white shadow-md" 
                      : "bg-[#f8f6f6] text-gray-700"
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Blend */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Blend</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"></div>
              <button 
                onClick={() => setBlend('senja')}
                className={cn(
                  "py-3 px-4 rounded-lg font-medium transition-all",
                  blend === 'senja' 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "bg-[#f8f6f6] text-gray-700"
                )}
              >
                Senja
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-white p-4 rounded-t-xl shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-lg font-bold text-gray-900">
              Rp{totalPrice.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-gray-900"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-lg font-bold text-gray-900">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-gray-900"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button 
          onClick={handleAddToCart}
          className="w-full bg-[#EA2831] text-white py-4 rounded-lg text-lg font-semibold shadow-lg"
        >
          Tambah ke Keranjang
        </button>
        {/* Home Indicator Bar */}
        <div className="w-32 h-1.5 bg-gray-300 rounded-full mx-auto mt-4"></div>
      </footer>
    </div>
  );
}