import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TableStatus = 'available' | 'occupied' | 'billing' | 'reserved';

export interface POSTableSection {
  id: string;
  branch_id: string;
  name: string;
  sort_order: number;
}

export interface POSTable {
  id: string;
  branch_id: string;
  section_id: string | null;
  table_number: string;
  capacity: number;
  shape: string;
  status: TableStatus;
  guest_name: string | null;
  guest_count: number | null;
  occupied_at: string | null;
  current_total: number;
  open_bill: any;
  merged_into: string | null;
  is_active: boolean;
  sort_order: number;
}

// New tables are not in generated types yet; use an untyped client handle.
const db = supabase as any;

export const usePOSTables = (branchId: string | null) => {
  const [tables, setTables] = useState<POSTable[]>([]);
  const [sections, setSections] = useState<POSTableSection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) return;
    const [t, s] = await Promise.all([
      db.from('pos_tables').select('*').eq('branch_id', branchId).eq('is_active', true).order('sort_order').order('table_number'),
      db.from('pos_table_sections').select('*').eq('branch_id', branchId).order('sort_order'),
    ]);
    setTables((t.data || []) as POSTable[]);
    setSections((s.data || []) as POSTableSection[]);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
    if (!branchId) return;
    const channel = supabase
      .channel(`pos_tables_${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_tables', filter: `branch_id=eq.${branchId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, load]);

  const updateTable = async (id: string, patch: Partial<POSTable>) => {
    const { error } = await db.from('pos_tables').update(patch).eq('id', id);
    if (error) throw error;
    await load();
  };

  const releaseTable = (id: string) =>
    updateTable(id, {
      status: 'available', guest_name: null, guest_count: null, occupied_at: null,
      current_total: 0, open_bill: null, merged_into: null,
    });

  return { tables, sections, loading, reload: load, updateTable, releaseTable, db };
};
