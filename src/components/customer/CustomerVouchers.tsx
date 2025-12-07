import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Gift, 
  Percent, 
  DollarSign, 
  Clock, 
  Check,
  Copy,
  Search
} from 'lucide-react';

interface CustomerVouchersProps {
  customerUser: any;
}

interface Voucher {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  valid_from: string;
  valid_until: string;
}

interface UserVoucher {
  id: string;
  voucher_id: string;
  is_used: boolean;
  claimed_at: string;
  used_at?: string;
  voucher: Voucher;
}

export function CustomerVouchers({ customerUser }: CustomerVouchersProps) {
  const { toast } = useToast();
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [myVouchers, setMyVouchers] = useState<UserVoucher[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableVouchers();
    fetchMyVouchers();
  }, [customerUser]);

  const fetchAvailableVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_vouchers')
        .select('*')
        .eq('is_active', true)
        .gte('valid_until', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableVouchers(data || []);
    } catch (error) {
      console.error('Error fetching available vouchers:', error);
    }
  };

  const fetchMyVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_user_vouchers')
        .select(`
          *,
          voucher:customer_vouchers(*)
        `)
        .eq('user_id', customerUser?.id)
        .order('claimed_at', { ascending: false });

      if (error) throw error;
      setMyVouchers(data || []);
    } catch (error) {
      console.error('Error fetching my vouchers:', error);
    }
  };

  const claimVoucher = async (voucher: Voucher) => {
    setLoading(true);
    try {
      // Check if already claimed
      const existingClaim = myVouchers.find(mv => mv.voucher_id === voucher.id);
      if (existingClaim) {
        toast({
          title: "Sudah Diklaim",
          description: "Voucher ini sudah pernah Anda klaim",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('customer_user_vouchers')
        .insert({
          user_id: customerUser.id,
          voucher_id: voucher.id
        });

      if (error) throw error;

      toast({
        title: "Berhasil!",
        description: "Voucher berhasil diklaim dan siap digunakan",
      });

      fetchMyVouchers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mengklaim voucher",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const claimPromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: "Error",
        description: "Masukkan kode promo terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Find voucher by code
      const { data: voucher, error: voucherError } = await supabase
        .from('customer_vouchers')
        .select('*')
        .eq('code', promoCode.toUpperCase())
        .eq('is_active', true)
        .gte('valid_until', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
        .single();

      if (voucherError) {
        if (voucherError.code === 'PGRST116') {
          throw new Error('Kode promo tidak valid atau sudah kadaluarsa');
        }
        throw voucherError;
      }

      // Check if already claimed
      const existingClaim = myVouchers.find(mv => mv.voucher_id === voucher.id);
      if (existingClaim) {
        toast({
          title: "Sudah Diklaim",
          description: "Voucher ini sudah pernah Anda klaim",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('customer_user_vouchers')
        .insert({
          user_id: customerUser.id,
          voucher_id: voucher.id
        });

      if (error) throw error;

      toast({
        title: "Berhasil!",
        description: `Voucher ${voucher.code} berhasil diklaim`,
      });

      setPromoCode('');
      fetchMyVouchers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mengklaim kode promo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyVoucherCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Tersalin!",
      description: `Kode ${code} berhasil disalin`,
    });
  };

  const formatDiscount = (voucher: Voucher) => {
    return voucher.discount_type === 'percentage' 
      ? `${voucher.discount_value}%`
      : `Rp ${voucher.discount_value.toLocaleString()}`;
  };

  const isExpired = (date: string) => {
    return new Date(date) < new Date();
  };

  const isAlreadyClaimed = (voucherId: string) => {
    return myVouchers.some(mv => mv.voucher_id === voucherId);
  };

  const VoucherCard = ({ voucher, type }: { voucher: Voucher | UserVoucher, type: 'available' | 'claimed' }) => {
    const voucherData = type === 'claimed' ? (voucher as UserVoucher).voucher : voucher as Voucher;
    const userVoucher = type === 'claimed' ? voucher as UserVoucher : null;
    
    return (
      <Card className={`
        ${type === 'claimed' && userVoucher?.is_used ? 'opacity-60 bg-gray-50' : ''}
        ${type === 'claimed' && !userVoucher?.is_used ? 'border-primary' : ''}
        ${isExpired(voucherData.valid_until) ? 'opacity-60' : ''}
      `}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              {voucherData.discount_type === 'percentage' ? (
                <Percent className="h-5 w-5 text-orange-500" />
              ) : (
                <DollarSign className="h-5 w-5 text-green-500" />
              )}
              <Badge 
                variant="secondary" 
                className={`
                  ${voucherData.discount_type === 'percentage' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}
                  font-bold
                `}
              >
                {formatDiscount(voucherData)} OFF
              </Badge>
            </div>
            
            {type === 'claimed' && userVoucher?.is_used && (
              <Badge variant="outline" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Terpakai
              </Badge>
            )}
            
            {isExpired(voucherData.valid_until) && (
              <Badge variant="destructive" className="text-xs">
                Kadaluarsa
              </Badge>
            )}
          </div>
          
          <h4 className="font-semibold mb-2">{voucherData.description}</h4>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Berlaku s/d {new Date(voucherData.valid_until).toLocaleDateString('id-ID')}</span>
            </div>
            {voucherData.min_order > 0 && (
              <p>Min. pembelian Rp {voucherData.min_order.toLocaleString()}</p>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                {voucherData.code}
              </code>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyVoucherCode(voucherData.code)}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            
            {type === 'available' && (
              <Button 
                size="sm" 
                onClick={() => claimVoucher(voucherData)}
                disabled={loading || isAlreadyClaimed(voucherData.id) || isExpired(voucherData.valid_until)}
              >
                {isAlreadyClaimed(voucherData.id) ? 'Sudah Diklaim' : 'Klaim'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-4">
      <div className="text-center space-y-2">
        <Gift className="h-8 w-8 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Voucher & Promo</h2>
        <p className="text-muted-foreground">Dapatkan diskon menarik untuk pesanan Anda</p>
      </div>

      {/* Promo Code Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Masukkan Kode Promo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Masukkan kode promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button 
              onClick={claimPromoCode}
              disabled={loading || !promoCode.trim()}
            >
              Klaim
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Available and My Vouchers */}
      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="available">
            Voucher Tersedia ({availableVouchers.length})
          </TabsTrigger>
          <TabsTrigger value="my-vouchers">
            Voucher Saya ({myVouchers.filter(v => !v.is_used && !isExpired(v.voucher.valid_until)).length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="available" className="space-y-4">
          {availableVouchers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Belum ada voucher tersedia</p>
              </CardContent>
            </Card>
          ) : (
            availableVouchers.map((voucher) => (
              <VoucherCard key={voucher.id} voucher={voucher} type="available" />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="my-vouchers" className="space-y-4">
          {myVouchers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Belum ada voucher yang diklaim</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    const tabsTrigger = document.querySelector('[value="available"]') as HTMLElement;
                    tabsTrigger?.click();
                  }}
                >
                  Lihat Voucher Tersedia
                </Button>
              </CardContent>
            </Card>
          ) : (
            myVouchers.map((userVoucher) => (
              <VoucherCard key={userVoucher.id} voucher={userVoucher} type="claimed" />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}