import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface POSShift {
  id: string;
  branch_id: string;
  kasir_id: string;
  shift_type: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  total_cash_in: number;
  total_cash_out: number;
  total_sales: number;
  total_transactions: number;
  expected_cash: number | null;
  cash_difference: number | null;
  status: string;
  notes: string | null;
}

export const usePOSShift = () => {
  const { userProfile } = useAuth();
  const [activeShift, setActiveShift] = useState<POSShift | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveShift = useCallback(async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('pos_shifts')
      .select('*')
      .eq('kasir_id', userProfile.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveShift(data as POSShift | null);
    setLoading(false);
  }, [userProfile?.id]);

  useEffect(() => {
    fetchActiveShift();
  }, [fetchActiveShift]);

  const openShift = async (shiftType: string, openingCash: number) => {
    if (!userProfile?.id || !userProfile?.branch_id) {
      throw new Error('Profil kasir atau cabang tidak ditemukan');
    }
    const { data, error } = await supabase
      .from('pos_shifts')
      .insert({
        kasir_id: userProfile.id,
        branch_id: userProfile.branch_id,
        shift_type: shiftType,
        opening_cash: openingCash,
        status: 'open',
      })
      .select()
      .single();
    if (error) throw error;
    setActiveShift(data as POSShift);
    return data;
  };

  const closeShift = async (closingCash: number, notes?: string) => {
    if (!activeShift) throw new Error('Tidak ada shift aktif');

    // Recompute totals from transactions in this shift
    const { data: txs } = await supabase
      .from('pos_transactions')
      .select('total, payment_method_1, amount_1, payment_method_2, amount_2, status')
      .eq('shift_id', activeShift.id)
      .eq('status', 'paid');

    const totalSales = (txs || []).reduce((s, t: any) => s + Number(t.total || 0), 0);
    const totalTx = (txs || []).length;
    const cashSales = (txs || []).reduce((s, t: any) => {
      let c = 0;
      if (t.payment_method_1 === 'cash') c += Number(t.amount_1 || 0);
      if (t.payment_method_2 === 'cash') c += Number(t.amount_2 || 0);
      return s + c;
    }, 0);

    const expectedCash =
      Number(activeShift.opening_cash) +
      cashSales +
      Number(activeShift.total_cash_in) -
      Number(activeShift.total_cash_out);

    const { data, error } = await supabase
      .from('pos_shifts')
      .update({
        closed_at: new Date().toISOString(),
        closing_cash: closingCash,
        expected_cash: expectedCash,
        cash_difference: closingCash - expectedCash,
        total_sales: totalSales,
        total_transactions: totalTx,
        status: 'closed',
        notes: notes || null,
      })
      .eq('id', activeShift.id)
      .select()
      .single();
    if (error) throw error;
    setActiveShift(null);
    return data;
  };

  const addCashMovement = async (type: 'in' | 'out', amount: number, reason: string) => {
    if (!activeShift || !userProfile?.id) throw new Error('Tidak ada shift aktif');
    const { error } = await supabase.from('pos_cash_movements').insert({
      shift_id: activeShift.id,
      branch_id: activeShift.branch_id,
      kasir_id: userProfile.id,
      movement_type: type,
      amount,
      reason,
    });
    if (error) throw error;

    const updateField = type === 'in' ? 'total_cash_in' : 'total_cash_out';
    const newTotal =
      (type === 'in' ? activeShift.total_cash_in : activeShift.total_cash_out) + amount;
    await supabase
      .from('pos_shifts')
      .update({ [updateField]: newTotal })
      .eq('id', activeShift.id);
    await fetchActiveShift();
  };

  return { activeShift, loading, openShift, closeShift, addCashMovement, refresh: fetchActiveShift };
};
