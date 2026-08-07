import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { redeemReward, lookupRedemption, previewRedemptionDiscount, type RedemptionInfo } from "@/lib/loyalty";

export interface AppliedRedemption {
  code: string;
  discount: number;
  reward_name: string;
  points_spent: number;
  remaining_points: number;
}

interface Reward {
  id: string;
  reward_name: string;
  description: string | null;
  points_required: number;
  reward_type: string;
  reward_value: any;
  is_active: boolean;
  stock_quantity: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string | null | undefined;
  memberPoints: number;
  /** Current bill amount, used to preview the discount. Pass 0 for a plain redeem (customer app). */
  amount?: number;
  onRedeemed: (r: AppliedRedemption) => void;
}

export function LoyaltyRedeemDialog({ open, onOpenChange, memberId, memberPoints, amount = 0, onRedeemed }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("loyalty_rewards")
          .select("*")
          .eq("is_active", true)
          .order("points_required");
        if (error) throw error;
        setRewards((data || []) as any);
      } catch (e: any) {
        toast.error("Gagal memuat reward: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open]);

  const handleRedeem = async (reward: Reward) => {
    if (!memberId) return;
    if (memberPoints < reward.points_required) {
      toast.error("Poin member tidak mencukupi");
      return;
    }
    setBusyId(reward.id);
    try {
      const res = await redeemReward(memberId, reward.id);
      let discount = 0;
      if (amount > 0) {
        const info: RedemptionInfo | null = await lookupRedemption(res.code);
        if (info) discount = previewRedemptionDiscount(info, amount);
      }
      onRedeemed({
        code: res.code,
        discount,
        reward_name: reward.reward_name,
        points_spent: res.points_spent,
        remaining_points: res.remaining_points,
      });
      toast.success(`Poin ditukar. Kode: ${res.code}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menukar poin");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Tukar Poin
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Saldo poin: <strong>{memberPoints}</strong></p>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rewards.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada reward tersedia</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {rewards.map((r) => {
              const affordable = memberPoints >= r.points_required;
              const outOfStock = r.stock_quantity !== null && r.stock_quantity <= 0;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.reward_name}</p>
                    {r.description && (
                      <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                    )}
                    <Badge variant="secondary" className="mt-1 text-[10px]">{r.points_required} poin</Badge>
                  </div>
                  <Button
                    size="sm"
                    disabled={!affordable || outOfStock || busyId === r.id || !memberId}
                    onClick={() => handleRedeem(r)}
                  >
                    {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : outOfStock ? "Habis" : "Tukar"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
