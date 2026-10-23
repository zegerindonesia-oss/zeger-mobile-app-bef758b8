import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface MemberBenefit {
  id: string;
  code: string;
  reward_name: string;
  status: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  min_transaction: number;
  expires_at: string | null;
  used_at: string | null;
  product_id: string | null;
  image_url: string | null;
}

export async function fetchMemberBenefits(memberId: string): Promise<MemberBenefit[]> {
  const { data, error } = await (supabase as any).rpc('member_benefits', { _member_id: memberId });
  if (error) throw error;
  return (data as MemberBenefit[]) || [];
}

export function benefitLabel(b: MemberBenefit) {
  if (b.product_id) return 'Menu gratis';
  return b.discount_type === 'percentage' ? `Diskon ${b.discount_value}%` : `Potongan Rp${Number(b.discount_value).toLocaleString('id-ID')}`;
}

export function expiryLabel(iso: string | null) {
  if (!iso) return 'Tanpa batas';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Kedaluwarsa';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 24 ? `Sisa ${Math.floor(h / 24)} hari` : `Sisa ${h} jam ${m} menit`;
}

const STATUS: Record<string, string> = { active: 'Bisa dipakai', used: 'Sudah dipakai', expired: 'Kedaluwarsa' };

/** POS: every reward the member owns, so the cashier sees exactly what the customer app shows. */
export function MemberBenefitsDialog({ open, onOpenChange, memberId, memberName, points, onUse, onRedeemMore }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string | null | undefined;
  memberName?: string | null;
  points: number;
  onUse: (b: MemberBenefit) => void;
  onRedeemMore: () => void;
}) {
  const [items, setItems] = useState<MemberBenefit[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !memberId) return;
    setLoading(true);
    fetchMemberBenefits(memberId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [open, memberId]);

  const active = items.filter((b) => b.status === 'active');
  const past = items.filter((b) => b.status !== 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Benefit {memberName || 'Member'}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
          <span>Saldo poin: <strong>{points}</strong></span>
          <Button size="sm" variant="outline" onClick={onRedeemMore}>Tukar poin</Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Voucher aktif ({active.length})</p>
            {active.length === 0 && <p className="text-sm text-muted-foreground">Belum ada voucher aktif.</p>}
            <div className="space-y-2">
              {active.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border p-3">
                  {b.image_url ? <img src={b.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted"><Gift className="h-5 w-5" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.reward_name}</p>
                    <p className="text-xs text-muted-foreground">{benefitLabel(b)} · {expiryLabel(b.expires_at)}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{b.code}</p>
                  </div>
                  <Button size="sm" onClick={() => { onUse(b); onOpenChange(false); }}>Gunakan</Button>
                </div>
              ))}
            </div>
            {past.length > 0 && (
              <>
                <p className="pt-2 text-xs font-semibold uppercase text-muted-foreground">Riwayat</p>
                <div className="space-y-1.5">
                  {past.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm opacity-70">
                      <span className="truncate">{b.reward_name}</span>
                      <Badge variant="secondary" className="text-[10px]">{STATUS[b.status] || b.status}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
