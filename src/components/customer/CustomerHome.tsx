import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  ShoppingBag, 
  Star, 
  Gift, 
  Coffee,
  Truck,
  Plus,
  ArrowRight,
  Clock,
  Heart
} from 'lucide-react';

interface CustomerHomeProps {
  customerUser: any;
  onNavigate: (view: any) => void;
  recentProducts: any[];
  onAddToCart: (product: any, customizations?: any) => void;
}

interface Voucher {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  valid_until: string;
}

export function CustomerHome({ 
  customerUser, 
  onNavigate, 
  recentProducts,
  onAddToCart 
}: CustomerHomeProps) {
  const [activeVouchers, setActiveVouchers] = useState<Voucher[]>([]);
  const [recentOrders, setRecentOrders] = useState([]);
  
  useEffect(() => {
    fetchActiveVouchers();
    fetchRecentOrders();
  }, []);

  const fetchActiveVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_vouchers')
        .select('*')
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString().split('T')[0])
        .limit(3);

      if (error) throw error;
      setActiveVouchers(data || []);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('user_id', customerUser?.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentOrders(data || []);
    } catch (error) {
      console.error('Error fetching recent orders:', error);
    }
  };

  const getMembershipBadge = () => {
    const points = customerUser?.points || 0;
    if (points >= 1000) return { level: 'Gold', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    if (points >= 500) return { level: 'Silver', color: 'bg-gray-400', textColor: 'text-gray-700' };
    return { level: 'Bronze', color: 'bg-amber-600', textColor: 'text-amber-700' };
  };

  const membership = getMembershipBadge();

  return (
    <div className="space-y-6 p-4">
      {/* Points and Membership Card */}
      <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Star className="h-5 w-5 fill-yellow-300 text-yellow-300" />
                <span className="text-lg font-bold">{customerUser?.points || 0} Poin</span>
                <Badge className={`${membership.color} text-white`}>
                  {membership.level}
                </Badge>
              </div>
              <p className="text-red-100 text-sm">
                {membership.level === 'Bronze' 
                  ? `${500 - (customerUser?.points || 0)} poin lagi ke Silver`
                  : membership.level === 'Silver'
                  ? `${1000 - (customerUser?.points || 0)} poin lagi ke Gold`
                  : 'Selamat! Anda sudah Gold Member'
                }
              </p>
            </div>
            <Gift className="h-8 w-8 text-red-200" />
          </div>
        </CardContent>
      </Card>

      {/* Order Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          className="h-20 flex flex-col items-center justify-center space-y-2 bg-primary hover:bg-primary/90"
          onClick={() => onNavigate('menu')}
        >
          <Truck className="h-6 w-6" />
          <span className="font-medium">Delivery</span>
        </Button>
        <Button 
          variant="outline"
          className="h-20 flex flex-col items-center justify-center space-y-2 border-primary text-primary hover:bg-primary/5"
          onClick={() => onNavigate('map')}
        >
          <MapPin className="h-6 w-6" />
          <span className="font-medium">Pick Up</span>
        </Button>
      </div>

      {/* Active Promotions */}
      {activeVouchers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Promo Hari Ini</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate('vouchers')}
              className="text-primary"
            >
              Lihat Semua
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {activeVouchers.slice(0, 2).map((voucher) => (
              <Card key={voucher.id} className="border-dashed border-2 border-orange-300 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="bg-orange-200 text-orange-700">
                          {voucher.discount_type === 'percentage' 
                            ? `${voucher.discount_value}% OFF`
                            : `Rp ${voucher.discount_value.toLocaleString()}`
                          }
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          s/d {new Date(voucher.valid_until).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{voucher.description}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      Pakai
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Menu Rekomendasi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Menu Favorit</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onNavigate('menu')}
            className="text-primary"
          >
            Lihat Menu
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {recentProducts.slice(0, 4).map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Coffee className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <h4 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    Rp {product.price.toLocaleString()}
                  </span>
                  <Button 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={() => onAddToCart(product)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Pesanan Terakhir</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate('orders')}
              className="text-primary"
            >
              Lihat Semua
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {recentOrders.slice(0, 2).map((order: any) => (
              <Card key={order.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Rp {order.total_price.toLocaleString()}</p>
                      <Badge 
                        variant={order.status === 'delivered' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Button 
          variant="outline" 
          className="h-16 flex flex-col items-center justify-center space-y-1"
          onClick={() => onNavigate('vouchers')}
        >
          <Gift className="h-5 w-5" />
          <span className="text-xs">Voucher</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-16 flex flex-col items-center justify-center space-y-1"
          onClick={() => onNavigate('orders')}
        >
          <Clock className="h-5 w-5" />
          <span className="text-xs">Riwayat</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-16 flex flex-col items-center justify-center space-y-1"
          onClick={() => onNavigate('profile')}
        >
          <Heart className="h-5 w-5" />
          <span className="text-xs">Favorit</span>
        </Button>
      </div>
    </div>
  );
}