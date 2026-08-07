import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Search, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PointsHistoryList } from './PointsHistoryList';
import {
  awardLoyaltyPoints as awardLoyaltyPointsCore,
  getLoyaltyEarnSettings,
  estimatePoints,
  type LoyaltyEarnSettings,
  DEFAULT_EARN_SETTINGS,
} from '@/lib/loyalty';

export interface LoyaltyMember {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  member_code: string | null;
  points: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (member: LoyaltyMember) => void;
  /** Current bill amount — used to show the estimated points and the minimum-transaction guard. */
  amount?: number;
}

const SCANNER_ID = 'member-qr-reader';

export function MemberScanDialog({ open, onOpenChange, onSelect, amount = 0 }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<LoyaltyMember | null>(null);
  const [settings, setSettings] = useState<LoyaltyEarnSettings>(DEFAULT_EARN_SETTINGS);
  const scannerRef = useRef<any>(null);

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    if (!open) stopScanner();
    if (open) {
      setFound(null);
      getLoyaltyEarnSettings().then(setSettings);
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lookup = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('lookup_member', { _code: trimmed });
      if (error) throw error;
      const member = Array.isArray(data) ? data[0] : data;
      if (!member) {
        toast.error('Member tidak ditemukan');
        return;
      }
      await stopScanner();
      setFound(member as LoyaltyMember);
      setCode('');
    } catch (e: any) {
      toast.error('Gagal mencari member: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    try {
      setScanning(true);
      const { Html5Qrcode } = await import('html5-qrcode');
      // wait for the container to render
      await new Promise((r) => setTimeout(r, 50));
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded: string) => {
          lookup(decoded);
        },
        () => {}
      );
    } catch (e: any) {
      setScanning(false);
      toast.error('Kamera tidak dapat diakses. Masukkan kode member manual.');
    }
  };

  const eligible = amount <= 0 || amount >= settings.min_transaction;
  const estimated = estimatePoints(amount, settings);

  const confirmMember = () => {
    if (!found) return;
    if (!eligible) {
      toast.error(
        `Transaksi minimal Rp${settings.min_transaction.toLocaleString('id-ID')} untuk memakai member`
      );
      return;
    }
    onSelect(found);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan Member</DialogTitle>
        </DialogHeader>
        {found ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold">{found.name || 'Member'}</p>
              <p className="text-xs text-muted-foreground">
                {found.member_code} {found.phone ? `• ${found.phone}` : ''}
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">{found.points ?? 0}</p>
              <p className="text-xs text-muted-foreground">Saldo poin real-time</p>
              {amount > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    Estimasi +{estimated} poin
                  </Badge>
                  {!eligible && (
                    <Badge variant="destructive" className="text-[10px]">
                      Min. transaksi Rp{settings.min_transaction.toLocaleString('id-ID')}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Riwayat Poin Terakhir</p>
              <PointsHistoryList memberId={found.id} limit={5} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setFound(null)}>
                Cari Lagi
              </Button>
              <Button className="flex-1" onClick={confirmMember} disabled={!eligible}>
                Gunakan Member
              </Button>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          {scanning ? (
            <div id={SCANNER_ID} className="w-full overflow-hidden rounded-lg bg-muted" />
          ) : (
            <Button type="button" variant="secondary" className="w-full" onClick={startScanner}>
              <Camera className="mr-2 h-4 w-4" /> Scan QR Member
            </Button>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Kode member / no. HP"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookup(code);
              }}
            />
            <Button type="button" onClick={() => lookup(code)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Scan QR di app customer, atau ketik kode member (contoh ZGM123456) / nomor HP.
          </p>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Awards points, falling back to the offline queue when there is no connection.
 * Returns the number of points awarded (0 when queued for later sync).
 */
export async function awardLoyaltyPoints(params: {
  memberId: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description?: string | null;
}): Promise<number> {
  const res = await awardLoyaltyPointsCore(params);
  if (res.queued) {
    toast.info('Offline: poin member akan disinkronkan otomatis saat internet kembali');
  }
  return res.points;
}