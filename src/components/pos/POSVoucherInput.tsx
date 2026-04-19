import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppliedPromo } from '@/hooks/usePOSPromo';

interface Props {
  branchId: string | null;
  subtotal: number;
  voucher: AppliedPromo | undefined;
  onApply: (code: string) => Promise<{ ok: boolean; message: string }>;
  onRemove: (id: string) => void;
}

export const POSVoucherInput = ({ branchId, subtotal, voucher, onApply, onRemove }: Props) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    const res = await onApply(code);
    setLoading(false);
    if (res.ok) {
      toast.success(res.message);
      setCode('');
    } else {
      toast.error(res.message);
    }
  };

  if (voucher) {
    return (
      <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded p-2">
        <div className="flex items-center gap-2 min-w-0">
          <Ticket className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">{voucher.voucher_code}</div>
            <div className="text-xs text-muted-foreground truncate">{voucher.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="secondary" className="text-xs">
            -Rp{voucher.computed_amount.toLocaleString('id-ID')}
          </Badge>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemove(voucher.id)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <Input
        className="h-8 text-sm"
        placeholder="Kode voucher"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
      />
      <Button size="sm" variant="outline" onClick={handleApply} disabled={loading || !code.trim()}>
        <Ticket className="h-3 w-3 mr-1" />
        Pakai
      </Button>
    </div>
  );
};
