import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Plus, 
  Minus,
  User,
  ShoppingBag,
  Bike,
  Pencil,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  customizations: {
    temperature?: 'hot' | 'ice' | 'cold';
    size?: 'regular' | 'large' | 'ultimate' | 'small' | '200ml' | '1lt';
    blend?: 'senja' | 'pagi';
    milk?: 'regular' | 'oat';
    iceLevel?: 'normal' | 'less' | 'no-ice';
    sugarLevel?: 'normal' | 'less' | 'no-sugar';
    toppings?: string[];
    extraShot?: boolean;
    notes?: string;
  };
}

interface CustomerCartNewProps {
  cart: CartItem[];
  outletName?: string;
  outletAddress?: string;
  outletDistance?: string;
  onUpdateQuantity: (productId: string, customizations: any, newQuantity: number) => void;
  onNavigate: (view: string) => void;
  onChangeOutlet: () => void;
  onAddMenu: () => void;
  onEditItem?: (item: CartItem) => void;
  onDeleteItem?: (item: CartItem) => void;
}

export function CustomerCartNew({ 
  cart, 
  outletName,
  outletAddress,
  outletDistance = "0.01 km",
  onUpdateQuantity, 
  onNavigate,
  onChangeOutlet,
  onAddMenu,
  onEditItem,
  onDeleteItem
}: CustomerCartNewProps) {
  const [orderType, setOrderType] = useState<'dine_in' | 'take_away' | 'delivery'>('take_away');
  const [pickupTime, setPickupTime] = useState('now');

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      const itemPrice = getItemPrice(item);
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const getItemPrice = (item: CartItem) => {
    let price = item.price;
    
    // Add size upcharge
    if (item.customizations.size === 'large') price += 5000;
    if (item.customizations.size === '200ml') price += 3000;
    if (item.customizations.size === '1lt') price += 15000;
    
    // Add toppings
    if (item.customizations.toppings && Array.isArray(item.customizations.toppings)) {
      const toppingPrices: Record<string, number> = {
        'espresso': 5000,
        'oreo': 4000,
        'cheese': 5000,
        'jelly': 5000,
        'icecream': 5000
      };
      item.customizations.toppings.forEach((t: string) => {
        price += toppingPrices[t] || 0;
      });
    }
    
    return price;
  };

  const formatCustomization = (item: CartItem) => {
    const customs = [];
    if (item.customizations.temperature) {
      customs.push(`${item.customizations.temperature === 'hot' ? 'Hot' : 'Ice'}`);
    }
    if (item.customizations.size) {
      customs.push(`Size: ${item.customizations.size}`);
    }
    if (item.customizations.iceLevel) {
      customs.push(`Es: ${item.customizations.iceLevel === 'normal' ? 'Normal' : 'Sedikit'}`);
    }
    if (item.customizations.sugarLevel) {
      customs.push(`Gula: ${item.customizations.sugarLevel === 'normal' ? 'Normal' : 'Sedikit'}`);
    }
    if (item.customizations.toppings && Array.isArray(item.customizations.toppings) && item.customizations.toppings.length > 0) {
      const toppingMap: Record<string, string> = {
        'espresso': 'Espresso Shot',
        'oreo': 'Oreo Crumb',
        'cheese': 'Cheese',
        'jelly': 'Jelly Pearl',
        'icecream': 'Ice Cream'
      };
      const toppingNames = item.customizations.toppings.map((t: string) => 
        toppingMap[t] || t
      );
      customs.push(`Topping: ${toppingNames.join(', ')}`);
    }
    if (item.customizations.notes) {
      customs.push(`Catatan: ${item.customizations.notes}`);
    }
    return customs.join(' • ');
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <ShoppingBag className="h-24 w-24 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold mb-2">Keranjang Kosong</h2>
        <p className="text-gray-500 mb-6 text-center">Belum ada item di keranjang</p>
        <Button 
          className="bg-red-500 hover:bg-red-600 text-white rounded-full px-8"
          onClick={() => onNavigate('menu')}
        >
          Mulai Belanja
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b z-10 p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('menu')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Detail Pesanan</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Order Type Pills */}
        <div className="flex gap-2">
          <Button
            variant={orderType === 'dine_in' ? 'default' : 'outline'}
            className={cn(
              "flex-1 rounded-full font-medium",
              orderType === 'dine_in' 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
            onClick={() => setOrderType('dine_in')}
          >
            <User className="h-4 w-4 mr-2" />
            Dine In
          </Button>
          <Button
            variant={orderType === 'take_away' ? 'default' : 'outline'}
            className={cn(
              "flex-1 rounded-full font-medium",
              orderType === 'take_away' 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
            onClick={() => setOrderType('take_away')}
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Take Away
          </Button>
          <Button
            variant={orderType === 'delivery' ? 'default' : 'outline'}
            className={cn(
              "flex-1 rounded-full font-medium",
              orderType === 'delivery' 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
            onClick={() => setOrderType('delivery')}
          >
            <Bike className="h-4 w-4 mr-2" />
            Delivery
          </Button>
        </div>

        {/* Outlet Info Card */}
        {outletName && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-base mb-1">{outletName}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{outletDistance}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-500 hover:bg-red-50 rounded-full"
                  onClick={onChangeOutlet}
                >
                  Ubah
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pickup Time */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <select 
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="font-medium text-base border-none outline-none bg-transparent"
                >
                  <option value="now">Ambil Sekarang</option>
                  <option value="15">15 Menit</option>
                  <option value="30">30 Menit</option>
                  <option value="60">1 Jam</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Daftar Pesanan</h2>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500 text-red-500 hover:bg-red-50 rounded-full"
              onClick={onAddMenu}
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah Menu
            </Button>
          </div>

          {/* Cart Items */}
          <div className="space-y-3">
            {cart.map((item) => {
              const itemPrice = getItemPrice(item);
              const itemTotal = itemPrice * item.quantity;
              
              return (
          <Card key={`${item.id}-${JSON.stringify(item.customizations)}`}>
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xs mb-1">{item.name}</h3>
                        <p className="text-[10px] text-gray-600 mb-1 line-clamp-2">
                          {formatCustomization(item)}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs font-bold text-[#EA2831]">
                            Rp{itemPrice.toLocaleString('id-ID')}
                          </p>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => onEditItem?.(item)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Pencil className="h-3 w-3 text-gray-500" />
                            </button>
                            <button 
                              onClick={() => onDeleteItem?.(item)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </button>
                            <div className="flex items-center gap-2 ml-2">
                              <button
                                onClick={() => onUpdateQuantity(item.id, item.customizations, item.quantity - 1)}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs font-semibold min-w-[1.5rem] text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.id, item.customizations, item.quantity + 1)}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Section */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-[100] pb-safe">
        {/* Terms Banner */}
        <div className="bg-purple-600 text-white text-xs px-4 py-2 text-center">
          Dengan membayar pesanan, anda telah menyetujui{' '}
          <span className="font-bold">Syarat Dan Ketentuan</span> Kami
        </div>
        
        {/* CTA Button */}
        <div className="p-4">
          <Button
            className="w-full h-14 bg-[#EA2831] hover:bg-red-700 text-white rounded-full text-base font-bold shadow-2xl"
            onClick={() => onNavigate('checkout')}
          >
            Lanjut Pembayaran • Rp {getTotalPrice().toLocaleString('id-ID')}
          </Button>
        </div>
      </div>
    </div>
  );
}
