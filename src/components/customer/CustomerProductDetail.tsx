import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Minus, Flame, Snowflake, Milk, ShoppingCart } from 'lucide-react';
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
  const [temperature, setTemperature] = useState<'hot' | 'cold'>('cold');
  const [size, setSize] = useState<'small' | 'large' | '200ml' | '1lt'>('200ml');
  const [iceLevel, setIceLevel] = useState<'normal' | 'less' | 'no-ice'>('normal');
  const [sugarLevel, setSugarLevel] = useState<'normal' | 'less' | 'no-sugar'>('normal');
  const [toppings, setToppings] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  const toppingOptions = [
    { id: 'espresso', name: 'Espresso Shot', price: 5000, icon: <Flame className="h-4 w-4" /> },
    { id: 'oreo', name: 'Oreo Crumb', price: 4000, icon: <Snowflake className="h-4 w-4" /> },
    { id: 'cheese', name: 'Cheese', price: 5000, icon: <Milk className="h-4 w-4" /> },
    { id: 'jelly', name: 'Jelly Pearl', price: 5000, icon: <Snowflake className="h-4 w-4" /> },
    { id: 'icecream', name: 'Ice Cream', price: 5000, icon: <Snowflake className="h-4 w-4" /> },
  ];

  const getCustomPrice = () => {
    console.log('🔍 Product base price:', product.price);
    let price = product.price;
    
    if (size === 'large') price += 5000;
    if (size === '200ml') price += 3000;
    if (size === '1lt') price += 15000;
    
    console.log('💰 After size adjustment:', price, '(size:', size, ')');
    
    toppings.forEach(toppingId => {
      const topping = toppingOptions.find(t => t.id === toppingId);
      if (topping) {
        console.log('🍪 Adding topping:', topping.name, topping.price);
        price += topping.price;
      }
    });
    
    console.log('📊 Final price per item:', price);
    console.log('🔢 Quantity:', quantity);
    console.log('💵 Total:', price * quantity);
    
    return price * quantity;
  };

  const toggleTopping = (toppingId: string) => {
    setToppings(prev => 
      prev.includes(toppingId) 
        ? prev.filter(id => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity, {
      temperature,
      size,
      iceLevel,
      sugarLevel,
      toppings,
      notes
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold text-gray-900">{product.name}</h1>
        <button onClick={onViewCart} className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
          <ShoppingCart className="h-4 w-4" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#EA2831] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      {/* Product Image */}
      <div className="relative">
        <img
          src={product.image_url || '/placeholder.svg'}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{product.name}</h2>
          <p className="text-base font-bold text-[#EA2831] mb-2">
            Rp{getCustomPrice().toLocaleString('id-ID')}
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            {product.description || 'Minuman kopi berkualitas dengan cita rasa yang istimewa'}
          </p>
        </div>

        {/* Temperature */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Suhu</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTemperature('hot')}
              className={`p-2 rounded-xl border-2 transition-all ${
                temperature === 'hot'
                  ? 'border-[#EA2831] bg-red-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Flame className={`h-5 w-5 mx-auto mb-1 ${temperature === 'hot' ? 'text-[#EA2831]' : 'text-gray-400'}`} />
              <span className={`text-xs font-medium ${temperature === 'hot' ? 'text-[#EA2831]' : 'text-gray-700'}`}>Panas</span>
            </button>
            <button
              onClick={() => setTemperature('cold')}
              className={`p-2 rounded-xl border-2 transition-all ${
                temperature === 'cold'
                  ? 'border-[#EA2831] bg-red-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Snowflake className={`h-5 w-5 mx-auto mb-1 ${temperature === 'cold' ? 'text-[#EA2831]' : 'text-gray-400'}`} />
              <span className={`text-xs font-medium ${temperature === 'cold' ? 'text-[#EA2831]' : 'text-gray-700'}`}>Dingin</span>
            </button>
          </div>
        </div>

        {/* Size */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Ukuran</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['200ml', '1lt', 'small', 'large'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`p-2 rounded-xl border-2 transition-all ${
                  size === s
                    ? 'border-[#EA2831] bg-red-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`text-xs font-medium ${size === s ? 'text-[#EA2831]' : 'text-gray-700'}`}>
                  {s === 'small' ? 'Small' : s === 'large' ? 'Large' : s}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Ice Level */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Level Es</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['normal', 'less', 'no-ice'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setIceLevel(level)}
                className={`p-2 rounded-xl border-2 transition-all ${
                  iceLevel === level
                    ? 'border-[#EA2831] bg-red-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`text-xs font-medium ${iceLevel === level ? 'text-[#EA2831]' : 'text-gray-700'}`}>
                  {level === 'normal' ? 'Normal' : level === 'less' ? 'Sedikit' : 'Tanpa Es'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sugar Level */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Level Gula</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['normal', 'less', 'no-sugar'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setSugarLevel(level)}
                className={`p-2 rounded-xl border-2 transition-all ${
                  sugarLevel === level
                    ? 'border-[#EA2831] bg-red-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`text-xs font-medium ${sugarLevel === level ? 'text-[#EA2831]' : 'text-gray-700'}`}>
                  {level === 'normal' ? 'Normal' : level === 'less' ? 'Sedikit' : 'Tanpa Gula'}
                </span>
              </button>
            ))}
          </div>
        </div>


        {/* Toppings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Topping</h3>
          <div className="space-y-2">
            {toppingOptions.map((topping) => (
              <label
                key={topping.id}
                className="flex items-center justify-between p-2 rounded-xl border-2 border-gray-200 hover:border-gray-300 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={toppings.includes(topping.id)}
                    onCheckedChange={() => toggleTopping(topping.id)}
                  />
                  <div className="flex items-center gap-2">
                    {topping.icon}
                    <span className="text-xs font-medium text-gray-700">{topping.name}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-900">
                  +Rp{topping.price.toLocaleString('id-ID')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Catatan Tambahan</h3>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: Gula extra, es batu banyak"
            className="w-full min-h-[60px] text-xs resize-none focus:border-[#EA2831]"
          />
        </div>
      </div>

      {/* Footer - Add to Cart */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 shadow-lg">
        <div className="max-w-sm mx-auto space-y-2">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Jumlah</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-base font-bold min-w-[2rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            className="w-full h-12 bg-[#EA2831] hover:bg-red-600 text-white rounded-full text-sm font-bold shadow-lg"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Tambah ke Keranjang - Rp{getCustomPrice().toLocaleString('id-ID')}
          </Button>
        </div>
      </div>
    </div>
  );
}