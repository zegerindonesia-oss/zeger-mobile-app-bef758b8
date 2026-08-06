import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Search, Loader2 } from 'lucide-react';

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
}

const SCANNER_ID = 'member-qr-reader';

export function MemberScanDialog({ open, onOpenChange, onSelect }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
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
      onSelect(member as LoyaltyMember);
      setCode('');
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan Member</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}

export async function awardLoyaltyPoints(params: {
  memberId: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description?: string | null;
}): Promise<number> {
  try {
    const { data, error } = await (supabase as any).rpc('award_loyalty_points', {
      _member_id: params.memberId,
      _amount: params.amount,
      _source: params.source,
      _reference_id: params.referenceId ?? null,
      _description: params.description ?? null,
    });
    if (error) throw error;
    return Number(data) || 0;
  } catch (e) {
    console.error('awardLoyaltyPoints failed', e);
    return 0;
  }
}