import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Minus, Coffee, ShoppingCart } from 'lucide-react';
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
  const [milk, setMilk] = useState<'regular' | 'oat'>('regular');
  const [iceLevel, setIceLevel] = useState<'normal' | 'less'>('normal');
  const [sugarLevel, setSugarLevel] = useState<'normal' | 'less'>('normal');
  const [extraShot, setExtraShot] = useState(false);
  const [notes, setNotes] = useState('');

  const getCustomPrice = () => {
    let price = product.price;
    if (size === 'large') price += 5000;
    if (size === 'ultimate') price += 10000;
    if (extraShot) price += 6000;
    return price;
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity, {
      temperature, size, blend, milk, iceLevel, sugarLevel, extraShot, notes
    });
  };

  const totalPrice = getCustomPrice() * quantity;

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

        {/* Blend, Milk, Ice, Sugar, Toppings, Notes */}
        <Card className="p-4"><h3 className="text-sm font-semibold mb-3">Blend</h3><div className="grid grid-cols-2 gap-3">{['senja','pagi'].map(b=><button key={b} onClick={()=>setBlend(b as any)} className={cn("py-3 rounded-2xl font-medium",blend===b?"bg-purple-600 text-white":"bg-gray-100")}>{b.charAt(0).toUpperCase()+b.slice(1)}</button>)}</div></Card>
        <Card className="p-4"><h3 className="text-sm font-semibold mb-3">Milk</h3><div className="grid grid-cols-2 gap-3">{['regular','oat'].map(m=><button key={m} onClick={()=>setMilk(m as any)} className={cn("py-3 rounded-2xl font-medium",milk===m?"bg-purple-600 text-white":"bg-gray-100")}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>)}</div></Card>
        <Card className="p-4"><h3 className="text-sm font-semibold mb-3">Ice Level</h3><div className="grid grid-cols-2 gap-3">{['normal','less'].map(i=><button key={i} onClick={()=>setIceLevel(i as any)} className={cn("py-3 rounded-2xl font-medium",iceLevel===i?"bg-purple-600 text-white":"bg-gray-100")}>{i.charAt(0).toUpperCase()+i.slice(1)}</button>)}</div></Card>
        <Card className="p-4"><h3 className="text-sm font-semibold mb-3">Sugar</h3><div className="grid grid-cols-2 gap-3">{['normal','less'].map(s=><button key={s} onClick={()=>setSugarLevel(s as any)} className={cn("py-3 rounded-2xl font-medium",sugarLevel===s?"bg-purple-600 text-white":"bg-gray-100")}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>)}</div></Card>
        <Card className="p-4"><h3 className="text-sm font-semibold mb-3">Toppings</h3><label className="flex items-center justify-between p-3 border rounded-2xl"><div className="flex gap-2"><input type="checkbox" checked={extraShot} onChange={e=>setExtraShot(e.target.checked)} className="w-5 h-5"/><span>Extra Shot</span></div><span className="text-red-600 font-semibold">+Rp 6.000</span></label></Card>
        <Card className="p-4"><h3 className="text-sm font-semibold mb-3">Catatan</h3><textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,100))} placeholder="Masukan catatan pesanan kamu" className="w-full h-20 p-3 border rounded-2xl resize-none" maxLength={100}/><p className="text-xs text-gray-500 text-right mt-1">{notes.length}/100</p></Card>

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

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <button
          onClick={onViewCart}
          className="fixed bottom-24 right-6 z-50 w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all border-2 border-red-500"
        >
          <ShoppingCart className="h-7 w-7 text-red-500" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
            {cartItemCount}
          </span>
        </button>
      )}
    </div>
  );
}
