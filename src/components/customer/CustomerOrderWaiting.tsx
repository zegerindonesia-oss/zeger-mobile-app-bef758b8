import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Phone, MapPin, Clock, XCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cxArt } from '@/lib/customer-art';

interface Rider {
  id: string;
  full_name: string;
  phone: string;
  photo_url?: string;
  distance_km: number;
  eta_minutes: number;
}

interface CustomerOrderWaitingProps {
  orderId: string;
  rider: Rider;
  onAccepted: () => void;
  onRejected: (reason: string) => void;
  onCancel: () => void;
}

const TOTAL_SECONDS = 60;

export default function CustomerOrderWaiting({
  orderId,
  rider,
  onAccepted,
  onRejected,
  onCancel,
}: CustomerOrderWaitingProps) {
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(TOTAL_SECONDS);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const channel = supabase
      .channel('order_status_waiting')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload: any) => {
        const newStatus = payload.new.status;

        if (newStatus === 'accepted' || newStatus === 'in_progress') {
          toast({ title: 'Pesanan diterima!', description: `${rider.full_name} menerima pesanan kamu` });
          onAccepted();
        } else if (newStatus === 'rejected') {
          const reason = payload.new.rejection_reason || 'Rider menolak pesanan';
          setRejectionReason(reason);
          setShowRejectionDialog(true);
          setTimeout(() => {
            setShowRejectionDialog(false);
            onRejected(reason);
          }, 5000);
        }
      })
      .subscribe();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          toast({
            title: 'Waktu habis',
            description: 'Rider tidak merespons dalam waktu yang ditentukan',
            variant: 'destructive',
          });
          onRejected('Tidak ada respons dari rider');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId, onAccepted, onRejected]);

  const waPhone = (() => {
    const clean = (rider.phone || '').replace(/[^\d]/g, '');
    if (!clean) return '';
    return clean.startsWith('62') ? clean : `62${clean.replace(/^0/, '')}`;
  })();

  const handleWhatsAppRider = () => {
    if (!waPhone) return;
    const message = encodeURIComponent(`Halo ${rider.full_name}, saya customer Zeger dengan pesanan #${orderId}.`);
    window.open(`https://wa.me/${waPhone}?text=${message}`, '_blank');
  };

  const ratio = countdown / TOTAL_SECONDS;
  const circumference = 2 * Math.PI * 46;

  return (
    <div className="cx-app flex min-h-screen items-center justify-center bg-[hsl(var(--cx-canvas))] p-5">
      <div className="w-full max-w-md">
        <div className="cx-card cx-rise overflow-hidden rounded-[30px]">
          {/* Hero */}
          <div className="cx-stage relative overflow-hidden bg-gradient-to-br from-zeger-dark to-zeger px-6 pb-7 pt-8 text-center text-white">
            <div className="pointer-events-none absolute -left-8 top-6 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-xl font-extrabold tracking-tight">Menunggu konfirmasi rider</h2>
            <p className="relative mt-1 text-xs text-white/85">Rider terdekat sedang diminta mengambil pesanan kamu.</p>

            <div className="relative mx-auto mt-5 h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - ratio)}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="cx-num text-3xl font-extrabold leading-none">{countdown}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">detik</span>
              </div>
            </div>

            <div className="relative mt-4 cx-ride-track mx-auto w-40">
              <img src={cxArt.scooter} alt="" className="cx-art cx-ride mx-auto h-16 w-auto" />
            </div>
          </div>

          {/* Rider card */}
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-[22px] bg-[hsl(var(--cx-rail))] p-4">
              <Avatar className="h-14 w-14 ring-2 ring-white">
                <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{rider.full_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{rider.phone}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1 text-zeger"><MapPin className="h-3 w-3" />{rider.distance_km.toFixed(1)} km</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600"><Clock className="h-3 w-3" />~{rider.eta_minutes} menit</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => rider.phone && (window.location.href = `tel:${rider.phone}`)} className="cx-btn cx-btn-ghost py-3 text-xs">
                <Phone className="h-4 w-4" /> Telepon
              </button>
              <button onClick={handleWhatsAppRider} disabled={!waPhone} className="cx-btn cx-btn-ghost py-3 text-xs text-emerald-700">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
            </div>

            <button onClick={onCancel} className="cx-btn cx-btn-ghost w-full py-3 text-xs text-destructive">
              <XCircle className="h-4 w-4" /> Batalkan pesanan
            </button>

            <p className="text-center text-[11px] leading-snug text-muted-foreground">
              Pesanan otomatis dibatalkan jika tidak ada respons dalam {countdown} detik.
            </p>
          </div>
        </div>
      </div>

      {/* Rejection dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="cx-app max-w-sm rounded-[26px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> Pesanan ditolak
            </DialogTitle>
            <DialogDescription>Mohon maaf, rider tidak dapat menerima pesanan kamu.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[18px] bg-destructive/10 p-4">
              <p className="mb-1 text-xs font-bold">Alasan penolakan</p>
              <p className="text-xs text-destructive">{rejectionReason}</p>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={rider.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} />
                <AvatarFallback>{rider.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{rider.full_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{rider.phone}</p>
              </div>
            </div>

            <button
              onClick={() => { setShowRejectionDialog(false); onRejected(rejectionReason); }}
              className="cx-btn cx-btn-ghost w-full py-3 text-sm"
            >
              Tutup
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
