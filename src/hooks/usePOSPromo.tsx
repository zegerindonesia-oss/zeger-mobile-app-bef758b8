import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppliedPromo {
  id: string;
  source: 'manual' | 'voucher' | 'happy_hour';
  name: string;
  scope: 'item' | 'bill';
  promo_type: 'percentage' | 'fixed' | 'free_item' | 'happy_hour';
  value: number;
  target_product_id?: string;
  voucher_id?: string;
  voucher_code?: string;
  computed_amount: number;
}

export const usePOSPromo = () => {
  const [appliedPromos, setAppliedPromos] = useState<AppliedPromo[]>([]);

  const addManualPromo = useCallback((p: Omit<AppliedPromo, 'source' | 'computed_amount'> & { computed_amount?: number }) => {
    setAppliedPromos((prev) => [
      ...prev,
      { ...p, source: 'manual', computed_amount: p.computed_amount ?? 0 },
    ]);
  }, []);

  const removePromo = useCallback((id: string) => {
    setAppliedPromos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPromos = useCallback(() => setAppliedPromos([]), []);

  const validateVoucher = useCallback(
    async (
      code: string,
      branchId: string | null,
      subtotal: number
    ): Promise<{ ok: boolean; message: string; promo?: AppliedPromo }> => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return { ok: false, message: 'Kode kosong' };

      const { data: voucher, error } = await supabase
        .from('pos_vouchers')
        .select('id, code, is_used, promotion_id, pos_promotions(*)')
        .eq('code', trimmed)
        .maybeSingle();

      if (error || !voucher) return { ok: false, message: 'Voucher tidak ditemukan' };
      if (voucher.is_used) return { ok: false, message: 'Voucher sudah pernah dipakai' };

      const promo: any = voucher.pos_promotions;
      if (!promo) return { ok: false, message: 'Promo tidak valid' };
      if (!promo.is_active) return { ok: false, message: 'Promo nonaktif' };

      const now = new Date();
      if (promo.start_at && new Date(promo.start_at) > now)
        return { ok: false, message: 'Promo belum mulai' };
      if (promo.end_at && new Date(promo.end_at) < now)
        return { ok: false, message: 'Promo sudah berakhir' };
      if (subtotal < Number(promo.min_purchase || 0))
        return {
          ok: false,
          message: `Minimum pembelian Rp${Number(promo.min_purchase).toLocaleString('id-ID')}`,
        };
      if (
        branchId &&
        Array.isArray(promo.applicable_branch_ids) &&
        promo.applicable_branch_ids.length > 0 &&
        !promo.applicable_branch_ids.includes(branchId)
      )
        return { ok: false, message: 'Voucher tidak berlaku di cabang ini' };

      const value = Number(promo.value);
      const computed =
        promo.promo_type === 'percentage'
          ? Math.round((subtotal * value) / 100)
          : Math.round(value);

      return {
        ok: true,
        message: 'Voucher berhasil',
        promo: {
          id: `voucher-${voucher.id}`,
          source: 'voucher',
          name: promo.name,
          scope: promo.scope,
          promo_type: promo.promo_type,
          value,
          voucher_id: voucher.id,
          voucher_code: voucher.code,
          computed_amount: computed,
        },
      };
    },
    []
  );

  const applyVoucher = useCallback(
    async (code: string, branchId: string | null, subtotal: number) => {
      const res = await validateVoucher(code, branchId, subtotal);
      if (res.ok && res.promo) {
        // hapus voucher lama jika ada
        setAppliedPromos((prev) => [
          ...prev.filter((p) => p.source !== 'voucher'),
          res.promo!,
        ]);
      }
      return res;
    },
    [validateVoucher]
  );

  const totalPromoDiscount = appliedPromos.reduce((s, p) => s + p.computed_amount, 0);

  return {
    appliedPromos,
    addManualPromo,
    removePromo,
    clearPromos,
    applyVoucher,
    validateVoucher,
    totalPromoDiscount,
  };
};
