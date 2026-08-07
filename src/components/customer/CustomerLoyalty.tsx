import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { QRCodeSVG } from 'qrcode.react';
import { LoyaltyRedeemDialog } from '@/components/loyalty/LoyaltyRedeemDialog';
import { PointsHistoryList } from '@/components/loyalty/PointsHistoryList';
import { supabase as sb } from '@/integrations/supabase/client';
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
  const [memberCode, setMemberCode] = useState<string | null>(null);
  const [points, setPoints] = useState<number>(customerUser?.points || 0);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');
  const [historyKey, setHistoryKey] = useState(0);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  useEffect(() => {
    fetchLoyaltyData();
    fetchMemberCode();
    fetchRedemptions();
  }, [customerUser]);
  const fetchMemberCode = async () => {
    if (!customerUser?.id) return;
    const { data } = await (supabase as any)
      .from('customer_users')
      .select('member_code, points')
      .eq('id', customerUser.id)
      .maybeSingle();
    if (data?.member_code) setMemberCode(data.member_code);
    if (data?.points != null) setPoints(Number(data.points));
  };
  const fetchRedemptions = async () => {
    if (!customerUser?.id) return;
    const { data } = await (sb as any)
      .from('loyalty_redemptions')
      .select('*')
      .eq('member_id', customerUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setRedemptions(data || []);
  };
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
                  {points}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="bg-[#EA2831] hover:bg-[#D12028] text-white rounded-full px-6 shadow-lg" onClick={() => setRedeemOpen(true)}>
                Tukar Poin
              </Button>
              <Button variant="outline" className="rounded-full px-6" onClick={() => setTab('history')}>
                Riwayat Poin
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Points history / redemptions */}
      <div className="px-4 mb-8">
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={tab === 'rewards' ? 'default' : 'outline'}
            className={tab === 'rewards' ? 'bg-[#EA2831] hover:bg-[#D12028] rounded-full' : 'rounded-full'}
            onClick={() => setTab('rewards')}
          >
            Voucher Saya
          </Button>
          <Button
            size="sm"
            variant={tab === 'history' ? 'default' : 'outline'}
            className={tab === 'history' ? 'bg-[#EA2831] hover:bg-[#D12028] rounded-full' : 'rounded-full'}
            onClick={() => setTab('history')}
          >
            Riwayat Poin
          </Button>
        </div>
        <Card className="p-4 border-0 shadow-lg rounded-2xl">
          {tab === 'history' ? (
            <PointsHistoryList memberId={customerUser?.id} limit={50} refreshKey={historyKey} />
          ) : redemptions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Belum ada penukaran poin. Tukar poinmu jadi voucher diskon!
            </p>
          ) : (
            <div className="space-y-2">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.reward_name}</p>
                    <p className="text-xs text-gray-500">
                      Kode: <span className="font-mono font-bold">{r.code}</span> • {r.points_spent} poin
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      r.status === 'active' ? 'text-emerald-600' : 'text-gray-400'
                    }`}
                  >
                    {r.status === 'active' ? 'Aktif' : r.status === 'used' ? 'Terpakai' : 'Kedaluwarsa'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <LoyaltyRedeemDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        memberId={customerUser?.id}
        memberPoints={points}
        onRedeemed={(r) => {
          setPoints(r.remaining_points);
          setHistoryKey((k) => k + 1);
          fetchRedemptions();
          setTab('rewards');
        }}
      />

      {/* Member QR Card */}
      <div className="px-4 mb-8">
        <Card className="bg-white rounded-2xl shadow-xl p-6 border-0 flex flex-col items-center">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Kartu Member</h3>
          <p className="text-xs text-gray-500 mb-4 text-center">
            Tunjukkan QR ini ke rider atau kasir outlet untuk mendapatkan poin
          </p>
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
            <QRCodeSVG value={memberCode || customerUser?.id || ''} size={168} level="M" />
          </div>
          <p className="mt-4 text-xl font-bold tracking-widest text-gray-900">
            {memberCode || '—'}
          </p>
          <p className="text-xs text-gray-500">{customerUser?.name}</p>
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