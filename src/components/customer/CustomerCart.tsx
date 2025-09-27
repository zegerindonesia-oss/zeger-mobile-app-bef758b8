import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Plus, Minus } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  customizations: any;
}

interface CustomerCartProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, customizations: any, newQuantity: number) => void;
  onNavigate: (view: string) => void;
}

export function CustomerCart({ cart, onUpdateQuantity, onNavigate }: CustomerCartProps) {
  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getEarnedPoints = () => {
    return Math.floor(getTotalPrice() / 1000); // 1 point per 1000 rupiah
  };

  if (cart.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Keranjang Belanja</h2>
          <p className="text-muted-foreground mb-4">Keranjang masih kosong</p>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('menu')}
          >
            Mulai Belanja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">Keranjang Belanja</h2>

      <ScrollArea className="h-64">
        <div className="space-y-4">
          {cart.map((item) => (
            <Card key={`${item.id}-${JSON.stringify(item.customizations)}`}>
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
                      onClick={() => onUpdateQuantity(item.id, item.customizations, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(item.id, item.customizations, item.quantity + 1)}
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
              <span className="font-bold">Rp {getTotalPrice().toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm text-primary">
              <span>Poin yang didapat</span>
              <span>+{getEarnedPoints()} poin</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button 
        className="w-full h-12"
        onClick={() => onNavigate('riders')}
      >
        Pesan Sekarang
      </Button>
    </div>
  );
}