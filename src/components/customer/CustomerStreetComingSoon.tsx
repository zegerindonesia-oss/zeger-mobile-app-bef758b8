import { ArrowLeft, Bell, MapPin, Sparkles } from 'lucide-react';
import { cxArt } from '@/lib/customer-art';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';

interface Props {
  onNavigate: (view: string) => void;
}

export function CustomerStreetComingSoon({ onNavigate }: Props) {
  const cfg = useCustomerAppConfig();
  const wa = (cfg.care.whatsapp_number || '').replace(/\D/g, '');

  return (
    <div className="cx-app flex min-h-screen flex-col bg-[hsl(var(--cx-canvas))]">
      <header className="cx-bar sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
        <button onClick={() => onNavigate('home')} aria-label="Kembali" className="cx-icon-btn h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-extrabold">Zeger On The Street</h1>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-12 pt-4">
        <div className="cx-stage cx-rise relative overflow-hidden rounded-[32px] bg-gradient-to-br from-zeger-dark to-zeger px-6 pb-8 pt-8 text-center text-white">
          <div className="pointer-events-none absolute -right-10 -top-8 h-36 w-36 rounded-full bg-zeger-gold/25 blur-3xl" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-bold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" /> Segera hadir
          </span>
          <img src={cxArt.cupIced} alt="" className="cx-art cx-float relative mx-auto mt-4 h-36 w-auto" />
          <h2 className="relative mt-4 text-2xl font-extrabold tracking-tight">Gerai jalanan Zeger</h2>
          <p className="relative mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-white/85">
            Booth Zeger On The Street sedang disiapkan di titik-titik ramai kotamu. Sementara itu, rider Zeger siap antar ke tempatmu.
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          <button onClick={() => onNavigate('map')} className="cx-btn cx-btn-primary w-full py-4 text-sm">
            <MapPin className="h-4 w-4" /> Lihat rider terdekat
          </button>
          {wa && (
            <button
              onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent('Halo Zeger, saya mau tanya soal Zeger On The Street')}`, '_blank')}
              className="cx-btn cx-btn-ghost w-full py-3.5 text-sm"
            >
              <Bell className="h-4 w-4" /> Kabari saya saat buka
            </button>
          )}
        </div>

        <div className="cx-card cx-rise mt-5 space-y-3 rounded-[26px] p-5">
          <h3 className="text-sm font-extrabold">Cara lain menikmati Zeger</h3>
          {[
            { t: 'Zeger Branch', d: 'Pesan untuk diambil atau diantar dari outlet.', v: 'menu' },
            { t: 'Zeger On The Wheels', d: 'Panggil rider terdekat lewat peta atau WhatsApp.', v: 'map' },
          ].map((item) => (
            <button
              key={item.v}
              onClick={() => onNavigate(item.v)}
              className="cx-opt flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left"
            >
              <img src={item.v === 'map' ? cxArt.scooter : cxArt.bag} alt="" className="h-10 w-10 shrink-0 object-contain" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{item.t}</span>
                <span className="block text-[11px] leading-snug opacity-70">{item.d}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
