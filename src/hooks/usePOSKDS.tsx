import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playAlertBeep } from '@/lib/audio';

export type KDSStatus = 'queued' | 'cooking' | 'ready' | 'served' | 'cancelled';

export interface KDSTicketItem {
  id: string;
  ticket_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  notes: string | null;
  is_done: boolean;
  done_at: string | null;
}

export interface KDSTicket {
  id: string;
  transaction_id: string;
  branch_id: string;
  status: KDSStatus;
  order_type: string | null;
  table_number: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  transaction_number: string | null;
  notes: string | null;
  started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  created_at: string;
  items: KDSTicketItem[];
}

export const usePOSKDS = (branchId: string | null) => {
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const lastCountRef = useRef(0);

  const fetchTickets = useCallback(async () => {
    if (!branchId) return;
    const { data: tk } = await supabase
      .from('pos_kds_tickets')
      .select('*')
      .eq('branch_id', branchId)
      .in('status', ['queued', 'cooking', 'ready'])
      .order('created_at', { ascending: true });
    if (!tk) {
      setTickets([]);
      setLoading(false);
      return;
    }
    const ids = tk.map((t) => t.id);
    const { data: items } = ids.length
      ? await supabase.from('pos_kds_ticket_items').select('*').in('ticket_id', ids)
      : { data: [] };
    const merged: KDSTicket[] = tk.map((t: any) => ({
      ...t,
      items: (items || []).filter((i: any) => i.ticket_id === t.id),
    }));
    setTickets(merged);
    if (merged.length > lastCountRef.current && lastCountRef.current > 0) {
      try { playAlertBeep({ times: 2, freq: 900, durationMs: 250, intervalMs: 350 }); } catch {}
    }
    lastCountRef.current = merged.length;
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!branchId) return;
    const ch = supabase
      .channel(`kds_${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_kds_tickets', filter: `branch_id=eq.${branchId}` },
        () => fetchTickets()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_kds_ticket_items' },
        () => fetchTickets()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [branchId, fetchTickets]);

  const updateStatus = useCallback(async (ticketId: string, status: KDSStatus) => {
    const patch: any = { status };
    if (status === 'cooking') patch.started_at = new Date().toISOString();
    if (status === 'ready') patch.ready_at = new Date().toISOString();
    if (status === 'served') patch.served_at = new Date().toISOString();
    await supabase.from('pos_kds_tickets').update(patch).eq('id', ticketId);
    await fetchTickets();
  }, [fetchTickets]);

  const toggleItemDone = useCallback(async (itemId: string, isDone: boolean) => {
    await supabase
      .from('pos_kds_ticket_items')
      .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
      .eq('id', itemId);
    await fetchTickets();
  }, [fetchTickets]);

  return { tickets, loading, updateStatus, toggleItemDone, refetch: fetchTickets };
};