import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Bike, Gift, Star, Bell, Users, CreditCard, ChevronRight, ShoppingBag, Flame, Coins } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f8f6f6]">
      {/* Hero Banner - Clean without overlay */}
      <div className="relative h-64 overflow-hidden">
        <PromoBannerCarousel />
      </div>

      {/* Member Card */}
      <div className="bg-white rounded-t-3xl -mt-8 p-4 shadow-lg relative z-10">
        {/* Greeting & Notification */}
        <div className="flex justify-between items-center mb-6 pt-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Hi, {customerUser?.name?.toUpperCase() || 'GUEST'}
          </h2>
          <div className="relative">
            <Bell className="h-7 w-7 text-gray-500" />
            {activeVouchers.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                {activeVouchers.length}
              </span>
            )}
          </div>
        </div>

        {/* Membership Info - Material Style */}
        <div className="grid grid-cols-3 gap-4 text-center mb-8">
          {/* Level / Jiwa */}
            <button 
              onClick={() => onNavigate('loyalty')}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer active:scale-95"
            >
              <div className="bg-[#EA2831] rounded-full w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-[0_8px_24px_rgba(234,40,49,0.4)]">
                <Flame className="h-7 w-7 text-white" />
              </div>
              <p className="font-semibold text-gray-900 text-sm">Zeger Loyalty</p>
              <p className="text-xs text-gray-500 font-light">
                {customerUser?.points || 0} /100 Exp
              </p>
            </button>

          {/* Points */}
          <div className="p-2">
            <div className="bg-[#EA2831] rounded-full w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-[0_8px_24px_rgba(234,40,49,0.4)]">
              <Coins className="h-7 w-7 text-white" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">Zeger Point</p>
            <p className="text-xs text-gray-500 font-light">
              {customerUser?.points || 0} Points
            </p>
          </div>

          {/* Subscription */}
          <div className="p-2">
            <div className="bg-[#EA2831] rounded-full w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-[0_8px_24px_rgba(234,40,49,0.4)]">
              <Gift className="h-7 w-7 text-white" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">Subscription</p>
            <p className="text-xs text-gray-500 font-light">0 Subscription</p>
          </div>
        </div>

        {/* Voucher & Referral Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div 
            className="bg-white p-4 rounded-lg flex justify-between items-center shadow-md cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => onNavigate('vouchers')}
          >
            <div>
              <p className="font-semibold text-gray-900">Voucher Kamu</p>
              <p className="text-xs text-gray-500 font-light">
                {activeVouchers.length} Voucher
              </p>
            </div>
            <div className="bg-gray-100 p-2 rounded-full">
              <Gift className="h-5 w-5 text-[#EA2831]" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg flex justify-between items-center shadow-md hover:shadow-xl transition-shadow">
            <div>
              <p className="font-semibold text-gray-900">Referral</p>
              <p className="text-xs text-gray-500 font-light">Undang Temanmu</p>
            </div>
            <div className="bg-gray-100 p-2 rounded-full">
              <Users className="h-5 w-5 text-[#EA2831]" />
            </div>
          </div>
        </div>

        {/* Outlet Selection */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Buat Pesanan Sekarang</h2>
        
        <div className="bg-white p-4 rounded-lg flex justify-between items-center mb-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <Store className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500 font-light">SULAWESI SURABAYA</p>
              <p className="font-semibold text-gray-900">zeger kemiri</p>
            </div>
          </div>
          <button 
            className="font-semibold text-[#EA2831] text-sm"
            onClick={() => onNavigate('outlets')}
          >
            Ubah
          </button>
        </div>

        {/* Order Type Buttons - Material Design Style */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onNavigate('outlets')}
            className="bg-[#EA2831] text-white rounded-lg p-6 text-center shadow-2xl relative overflow-hidden hover:shadow-3xl transition-all"
          >
            <div className="absolute inset-0 bg-white/5"></div>
            <div className="relative flex flex-col items-center justify-center">
              <Store className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <p className="font-bold">Zeger Branch</p>
            </div>
          </button>
          
          <button
            onClick={() => onNavigate('map')}
            className="bg-[#EA2831] text-white rounded-lg p-6 text-center shadow-2xl relative overflow-hidden hover:shadow-3xl transition-all"
          >
            <div className="absolute inset-0 bg-white/5"></div>
            <div className="relative flex flex-col items-center justify-center">
              <Bike className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <p className="font-bold">Zeger On The Wheels</p>
            </div>
          </button>
        </div>
      </div>

      {/* Active Promotions */}
      {activeVouchers.length > 0 && (
        <div className="px-4 mb-4">
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
              <Card key={voucher.id} className="p-4 rounded-2xl shadow-lg border-2 border-red-100 hover:border-[#EA2831] transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-6 w-6 text-[#EA2831]" />
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
        <div className="px-4 mb-4">
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
                className="p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer"
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