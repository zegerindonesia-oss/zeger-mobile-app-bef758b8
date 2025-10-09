import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Wallet, CreditCard, Smartphone, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CustomerPaymentMethodProps {
  orderId: string;
  totalAmount: number;
  onBack: () => void;
  onSuccess: (paymentMethod: string, invoiceUrl?: string) => void;
}

const eWalletOptions = [
  { id: 'GOPAY', name: 'GOPAY', icon: '🔵' },
  { id: 'SHOPEEPAY', name: 'SHOPEEPAY / SPAYLATER', icon: '🟠' },
  { id: 'OVO', name: 'OVO', icon: '🟣' },
  { id: 'JENIUSPAY', name: 'JENIUS PAY', icon: '🔵' },
];

export default function CustomerPaymentMethod({
  orderId,
  totalAmount,
  onBack,
  onSuccess,
}: CustomerPaymentMethodProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({
        title: 'Error',
        description: 'Pilih metode pembayaran terlebih dahulu',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call Xendit edge function to create invoice
      const { data, error } = await supabase.functions.invoke('create-xendit-invoice', {
        body: {
          order_id: orderId,
          amount: totalAmount,
          payment_method: selectedMethod,
        },
      });

      if (error) throw error;

      if (data?.invoice_url) {
        // Redirect to Xendit payment page
        window.location.href = data.invoice_url;
      } else {
        toast({
          title: '✅ Pembayaran Berhasil',
          description: 'Pesanan Anda sedang diproses',
        });
        onSuccess(selectedMethod);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Gagal memproses pembayaran',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Pilih Metode Pembayaran</h1>
            <p className="text-sm text-gray-500">
              Total: Rp {totalAmount.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm"><strong>Pastikan Saldo Cukup!</strong> Pastikan saldo kamu cukup sebelum melakukan pembayaran</AlertDescription>
        </Alert>

        {/* E-Wallet Options */}
        <Card className="p-4">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            E-Wallet
          </h2>

          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
            <div className="space-y-3">
              {eWalletOptions.map((wallet) => (
                <Label
                  key={wallet.id}
                  htmlFor={wallet.id}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2',
                    selectedMethod === wallet.id
                      ? 'border-red-500 bg-red-50 shadow-md scale-[1.02]'
                      : 'border-gray-200 bg-white',
                    'hover:shadow-lg'
                  )}
                >
                  <RadioGroupItem value={wallet.id} id={wallet.id} />
                  <div className="text-3xl">{wallet.icon}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{wallet.name}</p>
                    <p className="text-sm text-gray-500">Instant payment</p>
                  </div>
                  {selectedMethod === wallet.id && (
                    <Badge className="bg-red-500">Dipilih</Badge>
                  )}
                </Label>
              ))}
            </div>
          </RadioGroup>
        </Card>

        {/* Other Payment Methods (Coming Soon) */}
        <Card className="p-4 opacity-50">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Metode Lainnya
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
              <Smartphone className="h-6 w-6 text-gray-400" />
              <div className="flex-1">
                <p className="font-semibold text-gray-600">QRIS</p>
                <p className="text-sm text-gray-400">Scan & Pay</p>
              </div>
              <Badge variant="secondary">Segera Hadir</Badge>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
              <CreditCard className="h-6 w-6 text-gray-400" />
              <div className="flex-1">
                <p className="font-semibold text-gray-600">Virtual Account</p>
                <p className="text-sm text-gray-400">Transfer Bank</p>
              </div>
              <Badge variant="secondary">Segera Hadir</Badge>
            </div>
          </div>
        </Card>

        {/* Payment Summary */}
        <Card className="p-4 bg-gradient-to-r from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm opacity-90">Total Pembayaran</span>
            <span className="text-2xl font-bold">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs opacity-80">
            Pembayaran akan diproses melalui Xendit Payment Gateway
          </p>
        </Card>

        {/* Confirm Button */}
        <Button
          size="lg"
          className="w-full h-14 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-3xl shadow-2xl text-lg font-bold"
          onClick={handlePayment}
          disabled={!selectedMethod || loading}
        >
          {loading ? 'Memproses...' : 'Bayar Sekarang'}
        </Button>

        {/* Terms & Conditions */}
        <p className="text-center text-xs text-gray-500 px-4">
          Dengan melanjutkan pembayaran, Anda menyetujui{' '}
          <span className="text-red-500 font-medium">Syarat & Ketentuan</span> yang berlaku
        </p>
      </div>
    </div>
  );
}
