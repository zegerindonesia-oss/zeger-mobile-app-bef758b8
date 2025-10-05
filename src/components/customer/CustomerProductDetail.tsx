import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Minus, Coffee } from 'lucide-react';
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
}

export function CustomerProductDetail({ 
  product, 
  orderType,
  onBack, 
  onAddToCart 
}: CustomerProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState<'hot' | 'ice'>('hot');
  const [size, setSize] = useState<'ultimate' | 'large' | 'regular'>('regular');
  const [blend, setBlend] = useState('senja');

  const handleAddToCart = () => {
    const customizations = {
      temperature,
      size,
      blend
    };
    onAddToCart(product, quantity, customizations);
  };

  const totalPrice = product.price * quantity;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Detail Produk</h1>
        </div>
      </div>

      {/* Product Image */}
      <div className="relative w-full aspect-square bg-gray-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Coffee className="h-24 w-24 text-gray-300" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Product Info */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {product.name}
          </h2>
          {product.description && (
            <p className="text-gray-600 text-sm mb-3">
              {product.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-medium",
              orderType === 'dine-in' && "bg-blue-100 text-blue-700",
              orderType === 'take-away' && "bg-red-100 text-red-700",
              orderType === 'delivery' && "bg-purple-100 text-purple-700"
            )}>
              {orderType === 'dine-in' ? 'Dine In' : orderType === 'take-away' ? 'Take Away' : 'Delivery'}
            </span>
          </div>
        </div>

        {/* Temperature Selection */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Suhu</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTemperature('hot')}
              className={cn(
                "py-3 px-4 rounded-2xl font-medium transition-all",
                temperature === 'hot'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Hot
            </button>
            <button
              onClick={() => setTemperature('ice')}
              className={cn(
                "py-3 px-4 rounded-2xl font-medium transition-all",
                temperature === 'ice'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Ice
            </button>
          </div>
        </Card>

        {/* Size Selection */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Ukuran</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSize('regular')}
              className={cn(
                "py-3 px-2 rounded-2xl font-medium text-sm transition-all",
                size === 'regular'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Regular
            </button>
            <button
              onClick={() => setSize('large')}
              className={cn(
                "py-3 px-2 rounded-2xl font-medium text-sm transition-all",
                size === 'large'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Large
            </button>
            <button
              onClick={() => setSize('ultimate')}
              className={cn(
                "py-3 px-2 rounded-2xl font-medium text-sm transition-all",
                size === 'ultimate'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Ultimate
            </button>
          </div>
        </Card>

        {/* Blend Selection */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Blend</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setBlend('senja')}
              className={cn(
                "py-3 px-4 rounded-2xl font-medium transition-all",
                blend === 'senja'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Senja
            </button>
            <button
              onClick={() => setBlend('pagi')}
              className={cn(
                "py-3 px-4 rounded-2xl font-medium transition-all",
                blend === 'pagi'
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Pagi
            </button>
          </div>
        </Card>

        {/* Quantity Selector */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Jumlah</h3>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-2xl font-bold">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </Card>

        {/* Add to Cart Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <Button
            onClick={handleAddToCart}
            className="w-full h-14 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-3xl shadow-2xl text-lg font-bold"
          >
            Tambah ke Keranjang - Rp {totalPrice.toLocaleString('id-ID')}
          </Button>
        </div>

        {/* Bottom spacing for fixed button */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}
