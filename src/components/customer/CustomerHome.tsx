import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Bike, Gift, Star, Bell, Users, CreditCard, ChevronRight, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PromoBannerCarousel from './PromoBannerCarousel';

interface CustomerHomeProps {
  customerUser: any;
  onNavigate: any;
  recentProducts?: any[];
  onAddToCart?: (product: any) => void;
}

interface Voucher {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_until: string;
}

export function CustomerHome({ customerUser, onNavigate, recentProducts = [], onAddToCart }: CustomerHomeProps) {
  const [activeVouchers, setActiveVouchers] = useState<Voucher[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    if (customerUser) {
      fetchActiveVouchers();
      fetchRecentOrders();
    }
  }, [customerUser]);

  const fetchActiveVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_vouchers')
        .select('*')
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString())
        .limit(3);

      if (error) throw error;
      setActiveVouchers(data as any || []);
    } catch (error: any) {
      console.error('Error fetching vouchers:', error);
    }
  };

  const fetchRecentOrders = async () => {
    if (!customerUser) return;

    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('user_id', customerUser.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentOrders(data as any || []);
    } catch (error: any) {
      console.error('Error fetching recent orders:', error);
    }
  };

  const getMembershipBadge = () => {
    const points = customerUser?.points || 0;
    if (points >= 1000) return { level: 'Gold', color: 'bg-yellow-500', icon: '👑' };
    if (points >= 500) return { level: 'Silver', color: 'bg-gray-400', icon: '⭐' };
    return { level: 'Bronze', color: 'bg-orange-600', icon: '🔥' };
  };

  const membershipInfo = getMembershipBadge();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Promo Banner - Stacked at Top */}
      <div className="px-4 pt-4">
        <Card className="rounded-2xl overflow-hidden shadow-md">
          <PromoBannerCarousel />
        </Card>
      </div>

      {/* Member Card - Below Banner with Slight Overlap */}
      <div className="px-4 -mt-8 mb-4">
        <Card className="bg-white rounded-3xl shadow-xl p-4">
          {/* Greeting & Notification */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-lg">
                {customerUser?.name?.charAt(0)?.toUpperCase() || 'G'}
              </div>
              <div>
                <p className="text-sm text-gray-500">Hi,</p>
                <h2 className="text-base font-bold text-gray-900">{customerUser?.name?.toUpperCase() || 'GUEST'}</h2>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
          </div>

          {/* Membership Info Circles */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-2">
                <Star className="h-8 w-8 text-red-500" fill="currentColor" />
              </div>
              <p className="text-xs font-semibold text-gray-900">{membershipInfo.level}</p>
              <p className="text-xs text-gray-500">Level</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-2">
                <div className="text-2xl font-bold text-red-500">{customerUser?.points || 0}</div>
              </div>
              <p className="text-xs font-semibold text-gray-900">Zeger Point</p>
              <p className="text-xs text-gray-500">Points</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <CreditCard className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-xs font-semibold text-gray-900">Membership</p>
              <p className="text-xs text-gray-500">Inactive</p>
            </div>
          </div>

          {/* Voucher & Referral Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-auto py-3 px-4 flex items-center justify-between border-2 border-gray-200 hover:border-red-500"
              onClick={() => onNavigate('vouchers')}
            >
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-red-500" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-900">Voucher</p>
                  <p className="text-xs text-gray-500">{activeVouchers.length} Active</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-3 px-4 flex items-center justify-between border-2 border-gray-200 hover:border-red-500"
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-red-500" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-900">Referral</p>
                  <p className="text-xs text-gray-500">Share & Earn</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Order Type Section */}
      <div className="px-4 mb-6">
        <Card className="bg-white rounded-2xl shadow-lg p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Buat Pesanan Sekarang</h3>
          
          {/* Outlet Selection */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-gray-500">Outlet</p>
                <p className="text-sm font-semibold text-gray-900">Zeger Kemiri</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onNavigate('outlets')}
            >
              Ubah
            </Button>
          </div>

          {/* Order Type Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* TAKE AWAY Button - Red Theme */}
            <Button
              onClick={() => onNavigate('outlets')}
              className="h-32 flex-col gap-3 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-2xl relative overflow-hidden group rounded-3xl"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-50"></div>
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <Store className="h-12 w-12 relative z-10 drop-shadow-lg" strokeWidth={1.5} />
              </div>
              <div className="relative z-10">
                <p className="text-lg font-bold">Zeger Branch</p>
              </div>
            </Button>

            {/* DELIVERY Button - "Zeger On The Wheels" */}
            <Button
              onClick={() => onNavigate('map')}
              className="h-32 flex-col gap-3 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-2xl relative overflow-hidden group rounded-3xl"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-50"></div>
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <Bike className="h-10 w-10 relative z-10 drop-shadow-lg" strokeWidth={1.5} />
              </div>
              <div className="relative z-10">
                <p className="text-base font-bold leading-tight">
                  <span className="block">Zeger</span>
                  <span className="block">On The Wheels</span>
                </p>
                <p className="text-xs opacity-90 mt-1">Layanan Kopi Keliling</p>
              </div>
            </Button>
          </div>
        </Card>
      </div>

      {/* Quick Action Banners */}
      <div className="px-4 mb-6">
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-all">
          <ShoppingBag className="h-8 w-8 mb-2" />
          <p className="text-sm font-bold">Big Order</p>
          <p className="text-xs opacity-90">For Events</p>
        </Card>
      </div>

      {/* Active Promotions */}
      {activeVouchers.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Promo Aktif</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-500 hover:text-red-600"
              onClick={() => onNavigate('vouchers')}
            >
              Lihat Semua
            </Button>
          </div>
          <div className="space-y-3">
            {activeVouchers.map((voucher) => (
              <Card key={voucher.id} className="p-4 rounded-2xl shadow-md border-2 border-red-100 hover:border-red-500 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{voucher.code}</h4>
                    <p className="text-sm text-gray-600">
                      {voucher.discount_type === 'percentage' 
                        ? `${voucher.discount_value}% OFF` 
                        : `Rp ${voucher.discount_value.toLocaleString('id-ID')} OFF`}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="px-4 mb-20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Pesanan Terakhir</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-500 hover:text-red-600"
              onClick={() => onNavigate('orders')}
            >
              Lihat Semua
            </Button>
          </div>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Card 
                key={order.id} 
                className="p-4 rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={
                    order.status === 'completed' ? 'default' :
                    order.status === 'pending' ? 'secondary' : 'outline'
                  }>
                    {order.status}
                  </Badge>
                  <p className="text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <p className="font-bold text-gray-900">Order #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-gray-600">Rp {order.total_price.toLocaleString('id-ID')}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}