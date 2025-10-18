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
    <div className="min-h-screen bg-[#f8f6f6]">
      {/* Hero Banner with Overlay */}
      <div className="relative h-64 overflow-hidden">
        <PromoBannerCarousel />
        
        {/* Banner Overlay */}
        <div className="absolute inset-0 bg-black/30 flex flex-col justify-between p-4 pb-16">
          {/* Top: Time & Brand */}
          <div className="flex justify-between items-center text-white">
            <div>
              <p className="text-sm font-light">
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xl font-semibold tracking-wide">zeger</p>
            </div>
          </div>
          
          {/* Bottom: Promo Text */}
          <div className="text-white px-2">
            <p className="text-sm font-light tracking-wider uppercase mb-1">
              {activeVouchers.length > 0 ? 'Special Offers' : 'Welcome to Zeger'}
            </p>
            <h1 className="text-3xl font-bold leading-tight">
              {activeVouchers.length > 0 
                ? `${activeVouchers.length} Voucher Aktif`
                : 'Nikmati Kopi Terbaik'}
            </h1>
            <p className="mt-2 text-sm font-light">Order sekarang dan dapatkan poin!</p>
          </div>
        </div>
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
          <div className="p-2">
            <div className="bg-gray-100 rounded-full w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-sm">
              <span className="text-3xl">{membershipInfo.icon}</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Jiwa</p>
            <p className="text-xs text-gray-500 font-light">
              {customerUser?.points || 0} /100 Exp
            </p>
          </div>

          {/* Points */}
          <div className="p-2">
            <div className="bg-gray-100 rounded-full w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-sm">
              <span className="text-3xl">🪙</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Zeger Point</p>
            <p className="text-xs text-gray-500 font-light">
              {customerUser?.points || 0} Points
            </p>
          </div>

          {/* Subscription */}
          <div className="p-2">
            <div className="bg-gray-100 rounded-full w-14 h-14 mx-auto flex items-center justify-center mb-2 shadow-sm">
              <span className="text-3xl">🎁</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Subscription</p>
            <p className="text-xs text-gray-500 font-light">0 Subscription</p>
          </div>
        </div>

        {/* Voucher & Referral Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div 
            className="bg-white p-4 rounded-lg flex justify-between items-center shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
            onClick={() => onNavigate('vouchers')}
          >
            <div>
              <p className="font-semibold text-gray-900">Voucher Kamu</p>
              <p className="text-xs text-gray-500 font-light">
                {activeVouchers.length} Voucher
              </p>
            </div>
            <div className="bg-gray-100 p-2 rounded-full">
              <Gift className="h-5 w-5 text-red-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg flex justify-between items-center shadow-sm border border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">Referral</p>
              <p className="text-xs text-gray-500 font-light">Undang Temanmu</p>
            </div>
            <div className="bg-gray-100 p-2 rounded-full">
              <Users className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Outlet Selection */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Buat Pesanan Sekarang</h2>
        
        <div className="bg-white p-4 rounded-lg flex justify-between items-center mb-6 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3">
            <Store className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500 font-light">SULAWESI SURABAYA</p>
              <p className="font-semibold text-gray-900">zeger kemiri</p>
            </div>
          </div>
          <button 
            className="font-semibold text-red-500 text-sm"
            onClick={() => onNavigate('outlets')}
          >
            Ubah
          </button>
        </div>

        {/* Order Type Buttons - Material Design Style */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onNavigate('menu')}
            className="bg-red-500 text-white rounded-lg p-6 text-center shadow-lg relative overflow-hidden hover:bg-red-600 transition-colors"
          >
            <div className="absolute inset-0 bg-white/5"></div>
            <div className="relative flex flex-col items-center justify-center">
              <Store className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <p className="font-bold">Zeger Branch</p>
            </div>
          </button>
          
          <button
            onClick={() => onNavigate('map')}
            className="bg-red-500 text-white rounded-lg p-6 text-center shadow-lg relative overflow-hidden hover:bg-red-600 transition-colors"
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