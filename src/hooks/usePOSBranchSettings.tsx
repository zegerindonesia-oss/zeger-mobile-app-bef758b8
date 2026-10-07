import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface POSBranchSettings {
  branch_id: string;
  order_modes: string[];
  hidden_product_ids: string[];
  cash_in_categories: string[];
  cash_out_categories: string[];
}

export const DEFAULT_BRANCH_SETTINGS: Omit<POSBranchSettings, 'branch_id'> = {
  order_modes: ['dine_in', 'take_away', 'gofood', 'grabfood', 'shopeefood'],
  hidden_product_ids: [],
  cash_in_categories: ['Modal Tambahan', 'Tukar Uang Kecil', 'Pendapatan Lain', 'Lain-lain'],
  cash_out_categories: ['Belanja Bahan Darurat', 'Operasional & Kebersihan', 'Kasbon Staf', 'Setor ke Brankas', 'Lain-lain'],
};

export const fetchBranchSettings = async (branchId: string): Promise<POSBranchSettings> => {
  const { data } = await (supabase as any).from('pos_branch_settings').select('*').eq('branch_id', branchId).maybeSingle();
  return { branch_id: branchId, ...DEFAULT_BRANCH_SETTINGS, ...(data || {}) };
};

/** Branch POS config managed from Back Office; cashier apps only read it. */
export const usePOSBranchSettings = (branchId: string | null) => {
  const [settings, setSettings] = useState<POSBranchSettings | null>(null);
  const load = useCallback(() => { if (branchId) fetchBranchSettings(branchId).then(setSettings); }, [branchId]);
  useEffect(load, [load]);
  return { settings: settings || (branchId ? { branch_id: branchId, ...DEFAULT_BRANCH_SETTINGS } : null), reload: load };
};
