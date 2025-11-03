import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
interface CustomerLoyaltyProps {
  customerUser: any;
  onNavigate: (view: string) => void;
  onBack: () => void;
}
export function CustomerLoyalty({
  customerUser,
  onNavigate,
  onBack
}: CustomerLoyaltyProps) {
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchLoyaltyData();
  }, [customerUser]);
  const fetchLoyaltyData = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('customer_loyalty').select('*').eq('customer_id', customerUser.id).single();
      if (error) throw error;
      setLoyaltyData(data);
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setLoading(false);
    }
  };
  const xp = loyaltyData?.total_earned_points || 20;
  const maxXp = 100;
  const xpPercentage = xp / maxXp * 100;
  const rewards = [{
    title: 'Referral Benefit',
    description: 'Diskon 50% Maks. 20k',
    icon: '🔄',
    secondIcon: '👤'
  }, {
    title: 'Level Up Diskon',
    description: 'Diskon 50% Maks. 20k',
    icon: '💯',
    secondIcon: '📊'
  }, {
    title: 'Birthday Voucher',
    description: 'Diskon 50% Maks. 50k',
    icon: '💯',
    secondIcon: '🎂'
  }, {
    title: '4x Voucher Diskon Bulanan',
    description: 'Diskon 15% Min. pembelian 35k, Maks Diskon 15k',
    icon: '💯',
    secondIcon: '📅'
  }, {
    title: '5x Voucher Diskon Bulanan',
    description: 'Diskon 10% maksimal 7.5k',
    icon: '💯',
    secondIcon: '📅'
  }];
  return <div className="min-h-screen bg-white pb-24">
      {/* Header - Purple Gradient */}
      <div className="bg-gradient-to-br from-purple-700 to-purple-900 text-white">
        <div className="p-4 flex items-center justify-between">
          <button onClick={onBack} className="hover:bg-white/10 rounded-full p-2 transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">Loyalty Membership</h1>
          <div className="w-10" />
        </div>

        {/* Member Avatar & XP */}
        <div className="px-4 pb-8 pt-4">
          <div className="flex flex-col items-center">
            {/* Fist Avatar */}
            <div className="relative mb-4">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center border-4 border-white shadow-2xl">
                <span className="text-6xl">✊</span>
              </div>
              {/* Small avatar on side - tier badge */}
              <div className="absolute -right-2 top-0 w-12 h-12 rounded-full bg-gray-400 border-4 border-white flex items-center justify-center shadow-lg">
                <span className="text-xl">👤</span>
              </div>
            </div>

            {/* Member Name */}
            <h2 className="text-2xl font-bold mb-6">
              {customerUser?.name?.toUpperCase() || 'ZEGER MEMBER'}
            </h2>

            {/* XP Progress Bar */}
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-md">
                    <span className="text-lg">✊</span>
                  </div>
                  <span className="text-sm font-semibold">{xp} / {maxXp} XP</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center shadow-md">
                  <span className="text-lg">🏆</span>
                </div>
              </div>
              <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 h-3 rounded-full transition-all duration-500 ease-out" style={{
                width: `${xpPercentage}%`
              }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zeger Point Card */}
      <div className="px-4 -mt-6 mb-8">
        <Card className="bg-white rounded-2xl shadow-xl p-6 border-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Zeger Point</h3>
              <div className="flex items-center gap-2">
                <span className="text-3xl">🪙</span>
                <span className="text-3xl font-bold text-gray-900">
                  {loyaltyData?.points_balance || customerUser?.points || 973}
                </span>
              </div>
            </div>
            <Button className="bg-[#EA2831] hover:bg-[#D12028] text-white rounded-full px-6 shadow-lg" onClick={() => onNavigate('vouchers')}>
              History
            </Button>
          </div>
        </Card>
      </div>

      {/* Rewards Section */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#EA2831] flex items-center justify-center shadow-md">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Rewards Kamu</h2>
        </div>

        {/* Reward Cards */}
        <div className="space-y-4">
          {rewards.map((reward, index) => <Card key={index} className="bg-[#EA2831] text-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden border-0">
              <div className="p-5 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1">{reward.title}</h3>
                  <p className="text-sm opacity-90">{reward.description}</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center gap-1">
                  
                  
                </div>
              </div>
            </Card>)}
        </div>
      </div>
    </div>;
}