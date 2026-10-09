import { useState } from 'react';
import { ArrowLeft, Check, Loader2, QrCode, ShieldCheck, Wallet, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatRupiah } from '@/lib/customer-art';
import { cn } from '@/lib/utils';

interface CustomerPaymentMethodProps {
  orderId: string;
  totalAmount: number;
  orderType?: string;
  onBack: () => void;
  onSuccess: (paymentMethod?: string, invoiceUrl?: string) => void;
}

const E_WALLETS = [
  { id: 'GOPAY', name: 'GoPay', note: 'Bayar lewat aplikasi Gojek', ring: 'from-emerald-400 to-emerald-600' },
  { id: 'SHOPEEPAY', name: 'ShopeePay / SPayLater', note: 'Saldo atau cicilan Shopee', ring: 'from-orange-400 to-orange-600' },
  { id: 'OVO', name: 'OVO', note: 'Saldo OVO & OVO Points', ring: 'from-violet-400 to-violet-600' },
  { id: 'JENIUSPAY', name: 'Jenius Pay', note: 'Bayar dengan $cashtag', ring: 'from-sky-400 to-sky-600' },
];

export default function CustomerPaymentMethod({
  orderId,
  totalAmount,
  orderType,
  onBack,
  onSuccess,
}: CustomerPaymentMethodProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showQRISModal, setShowQRISModal] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({ title: 'Pilih metode dulu', description: 'Tentukan cara pembayaran kamu.', variant: 'destructive' });
      return;
    }

    if (selectedMethod === 'QRIS') {
      setShowQRISModal(true);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-xendit-invoice', {
        body: { order_id: orderId, amount: totalAmount, payment_method: selectedMethod },
      });

      if (error) throw error;

      if (data?.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        onSuccess(selectedMethod);
      }
    } catch (error: any) {
      toast({
        title: 'Pembayaran gagal diproses',
        description: error.message || 'Coba lagi beberapa saat.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Header */}
        <header className="cx-bar sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} aria-label="Kembali" className="cx-icon-btn h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold">Metode Pembayaran</h1>
            <p className="text-[11px] text-muted-foreground">
              {orderType === 'outlet_delivery' ? 'Pesanan diantar' : 'Pesanan diambil di outlet'}
            </p>
          </div>
        </header>

        <main className="flex-1 space-y-5 px-5 pb-40 pt-4">
          {/* Amount */}
          <section className="cx-card cx-rise relative overflow-hidden rounded-[26px] bg-gradient-to-br from-zeger-dark to-zeger p-5 text-white">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <p className="relative text-[11px] font-semibold uppercase tracking-wide text-white/80">Total bayar</p>
            <p className="cx-num relative mt-1 text-3xl font-extrabold">{formatRupiah(totalAmount)}</p>
            <p className="relative mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/85">
              <ShieldCheck className="h-3.5 w-3.5" /> Transaksi aman & terenkripsi
            </p>
          </section>

          {/* E-wallet */}
          <section className="space-y-2.5">
            <h2 className="flex items-center gap-2 pl-1 text-sm font-extrabold">
              <Wallet className="h-4 w-4 text-zeger" /> E-Wallet
            </h2>
            {E_WALLETS.map((w) => {
              const active = selectedMethod === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedMethod(w.id)}
                  data-active={active}
                  className="cx-opt flex w-full items-center gap-3 rounded-[22px] p-3.5 text-left"
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', w.ring)}>
                    <Wallet className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{w.name}</span>
                    <span className="block truncate text-[11px] opacity-70">{w.note}</span>
                  </span>
                  <span className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition',
                    active ? 'border-white bg-white/25' : 'border-[hsl(var(--cx-line))]',
                  )}>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </section>

          {/* QRIS */}
          <section className="space-y-2.5">
            <h2 className="flex items-center gap-2 pl-1 text-sm font-extrabold">
              <QrCode className="h-4 w-4 text-zeger" /> QRIS
            </h2>
            <button
              type="button"
              onClick={() => setSelectedMethod('QRIS')}
              data-active={selectedMethod === 'QRIS'}
              className="cx-opt flex w-full items-center gap-3 rounded-[22px] p-3.5 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md">
                <QrCode className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Scan QRIS Zeger</span>
                <span className="block text-[11px] opacity-70">Semua e-wallet & mobile banking</span>
              </span>
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition',
                selectedMethod === 'QRIS' ? 'border-white bg-white/25' : 'border-[hsl(var(--cx-line))]',
              )}>
                {selectedMethod === 'QRIS' && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>
          </section>

          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
            <span className="font-bold">Pastikan saldo cukup.</span> Pesanan diproses setelah pembayaran berhasil dikonfirmasi.
          </p>
        </main>

        {/* Sticky footer */}
        <footer className="cx-bar fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          <button
            onClick={handlePayment}
            disabled={!selectedMethod || loading}
            className="cx-btn cx-btn-primary w-full py-4 text-sm"
          >
            {loading
              ? (<><Loader2 className="h-4 w-4 animate-spin" /> Memproses…</>)
              : (<>Bayar {formatRupiah(totalAmount)}</>)}
          </button>
        </footer>
      </div>

      {/* QRIS modal */}
      {showQRISModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center">
          <div className="cx-pop-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-white sm:rounded-[30px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[hsl(var(--cx-line))] bg-white/90 px-5 py-4 backdrop-blur">
              <h2 className="text-base font-extrabold">Pembayaran QRIS</h2>
              <button
                onClick={() => { setShowQRISModal(false); setPaymentConfirmed(false); }}
                aria-label="Tutup"
                className="cx-icon-btn h-9 w-9"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="cx-card rounded-[24px] p-3">
                <img src="/qris/zeger-qris.jpg" alt="Kode QRIS Zeger Coffee" className="w-full rounded-[18px]" />
              </div>

              <div className="rounded-[22px] bg-[hsl(var(--cx-rail))] p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total pembayaran</p>
                <p className="cx-num mt-1 text-3xl font-extrabold text-zeger">{formatRupiah(totalAmount)}</p>
              </div>

              <ol className="space-y-2 rounded-[22px] border border-[hsl(var(--cx-line))] p-4 text-xs leading-relaxed text-muted-foreground">
                {[
                  'Buka aplikasi e-wallet atau m-banking kamu',
                  'Pilih menu Scan QR lalu arahkan ke kode di atas',
                  `Masukkan nominal ${formatRupiah(totalAmount)}`,
                  'Selesaikan pembayaran, lalu tekan "Sudah bayar"',
                ].map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zeger text-[10px] font-bold text-white">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <label className="flex cursor-pointer items-start gap-3 rounded-[20px] bg-[hsl(var(--cx-rail))] p-4">
                <input
                  type="checkbox"
                  checked={paymentConfirmed}
                  onChange={(e) => setPaymentConfirmed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-[hsl(var(--zeger))]"
                />
                <span className="text-xs font-semibold leading-snug">Saya sudah melakukan pembayaran melalui QRIS</span>
              </label>

              <div className="space-y-2 pb-[calc(env(safe-area-inset-bottom)+4px)]">
                <button
                  onClick={() => {
                    if (!paymentConfirmed) {
                      toast({ title: 'Belum dicentang', description: 'Centang konfirmasi pembayaran dulu.', variant: 'destructive' });
                      return;
                    }
                    setShowQRISModal(false);
                    onSuccess('QRIS');
                  }}
                  disabled={!paymentConfirmed}
                  className="cx-btn cx-btn-primary w-full py-4 text-sm"
                >
                  Sudah bayar
                </button>
                <button
                  onClick={() => { setShowQRISModal(false); setPaymentConfirmed(false); }}
                  className="cx-btn cx-btn-ghost w-full py-3 text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
