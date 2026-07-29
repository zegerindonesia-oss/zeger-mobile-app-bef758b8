import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Bike, Truck, Gift, Star, Bell, Users, CreditCard, ChevronRight, ShoppingBag, Flame, Coins, MapPin } from 'lucide-react';
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
  const [bigOrderBanner, setBigOrderBanner] = useState<{ image_url: string; link_url: string | null } | null>(null);
  const [zegerCareBanner, setZegerCareBanner] = useState<{ image_url: string; link_url: string | null } | null>(null);

  useEffect(() => {
    if (customerUser) {
      fetchActiveVouchers();
    }
    fetchSectionBanners();
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

  const fetchSectionBanners = async () => {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const { data, error } = await supabase
        .from('promo_banners')
        .select('image_url, link_url, placement, display_order')
        .eq('is_active', true)
        .in('placement', ['big_order', 'zeger_care'])
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .order('display_order');
      if (error) throw error;
      const big = (data || []).find((b: any) => b.placement === 'big_order');
      const care = (data || []).find((b: any) => b.placement === 'zeger_care');
      if (big) setBigOrderBanner({ image_url: big.image_url, link_url: big.link_url });
      if (care) setZegerCareBanner({ image_url: care.image_url, link_url: care.link_url });
    } catch (error: any) {
      console.error('Error fetching section banners:', error);
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
    <div className="min-h-screen bg-white">
      {/* Hero Banner - Clean without overlay */}
      <div className="relative h-64 overflow-hidden">
        <PromoBannerCarousel />
      </div>

      {/* Member Card */}
      <div className="bg-white rounded-t-3xl -mt-8 p-4 relative z-10">
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
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onNavigate('outlets')}
            className="bg-[#EA2831] text-white rounded-2xl p-4 text-center shadow-xl relative overflow-hidden hover:shadow-2xl active:scale-95 transition-all"
          >
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative flex flex-col items-center justify-center gap-2">
              <Store className="h-8 w-8" strokeWidth={1.5} />
              <p className="font-bold text-xs leading-tight">Zeger<br/>Branch</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('street')}
            className="bg-[#EA2831] text-white rounded-2xl p-4 text-center shadow-xl relative overflow-hidden hover:shadow-2xl active:scale-95 transition-all"
          >
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative flex flex-col items-center justify-center gap-2">
              <Truck className="h-8 w-8" strokeWidth={1.5} />
              <p className="font-bold text-xs leading-tight">On The<br/>Street</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('map')}
            className="bg-[#EA2831] text-white rounded-2xl p-4 text-center shadow-xl relative overflow-hidden hover:shadow-2xl active:scale-95 transition-all"
          >
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative flex flex-col items-center justify-center gap-2">
              <Bike className="h-8 w-8" strokeWidth={1.5} />
              <p className="font-bold text-xs leading-tight">On The<br/>Wheels</p>
            </div>
          </button>
        </div>

        {/* Nearby Rider shortcut */}
        <button
          onClick={() => onNavigate('map')}
          className="mt-4 w-full bg-white rounded-2xl p-4 flex items-center justify-between shadow-md hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#EA2831]/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-[#EA2831]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Rider di Sekitarmu</p>
              <p className="text-xs text-gray-500">Temukan rider Zeger terdekat</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
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

      {/* Big Order Section */}
      <div className="bg-white px-4 pt-6 pb-4">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">Big Order</h3>
        <button
          onClick={() => bigOrderBanner?.link_url && window.open(bigOrderBanner.link_url, '_blank')}
          className="block w-full rounded-2xl overflow-hidden shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)] hover:shadow-[0_18px_40px_-8px_rgba(0,0,0,0.3)] transition-all active:scale-[0.99] bg-gradient-to-br from-red-500 to-red-600"
          style={{ aspectRatio: '16 / 7' }}
        >
          {bigOrderBanner ? (
            <img
              src={bigOrderBanner.image_url}
              alt="Big Order"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white p-4">
              <ShoppingBag className="h-10 w-10 mb-2 opacity-80" />
              <p className="font-bold text-lg">Big Order Banner</p>
              <p className="text-xs opacity-80">Upload dari backoffice (rasio 16:7)</p>
            </div>
          )}
        </button>
      </div>

      {/* Zeger Care Section */}
      <div className="bg-white px-4 pt-4 pb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">Zeger Care</h3>
        <button
          onClick={() => zegerCareBanner?.link_url && window.open(zegerCareBanner.link_url, '_blank')}
          className="block w-full rounded-2xl overflow-hidden shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)] hover:shadow-[0_18px_40px_-8px_rgba(0,0,0,0.3)] transition-all active:scale-[0.99] bg-gradient-to-br from-amber-100 to-amber-200"
          style={{ aspectRatio: '16 / 7' }}
        >
          {zegerCareBanner ? (
            <img
              src={zegerCareBanner.image_url}
              alt="Zeger Care"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-red-600 p-4">
              <Bell className="h-10 w-10 mb-2" />
              <p className="font-bold text-lg">Zeger Care Banner</p>
              <p className="text-xs opacity-80">Upload dari backoffice (rasio 16:7)</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}