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
  category?: string | null;
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

export type KDSStation = 'all' | 'bar' | 'kitchen';
const FOOD_RE = /(makan|food|snack|roti|cake|pastry|nasi|mie|toast|kentang|dessert)/i;
export const stationOf = (category?: string | null): Exclude<KDSStation, 'all'> =>
  category && FOOD_RE.test(category) ? 'kitchen' : 'bar';

export const usePOSKDS = (branchId: string | null) => {
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [recent, setRecent] = useState<KDSTicket[]>([]);
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
    const productIds = Array.from(new Set((items || []).map((i: any) => i.product_id).filter(Boolean)));
    const { data: prods } = productIds.length
      ? await supabase.from('products').select('id, category').in('id', productIds)
      : { data: [] };
    const catMap = new Map((prods || []).map((p: any) => [p.id, p.category as string | null]));
    const merged: KDSTicket[] = tk.map((t: any) => ({
      ...t,
      items: (items || [])
        .filter((i: any) => i.ticket_id === t.id)
        .map((i: any) => ({ ...i, category: i.product_id ? catMap.get(i.product_id) ?? null : null })),
    }));
    setTickets(merged);
    if (merged.length > lastCountRef.current && lastCountRef.current > 0) {
      try { playAlertBeep({ times: 2, freq: 900, durationMs: 250, intervalMs: 350 }); } catch {}
    }
    lastCountRef.current = merged.length;

    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: rc } = await supabase
      .from('pos_kds_tickets')
      .select('*')
      .eq('branch_id', branchId)
      .eq('status', 'served')
      .gte('served_at', since)
      .order('served_at', { ascending: false })
      .limit(20);
    setRecent(((rc || []) as any[]).map((t) => ({ ...t, items: [] })));
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

  const recallTicket = useCallback(async (ticketId: string) => {
    await supabase.from('pos_kds_tickets').update({ status: 'ready', served_at: null }).eq('id', ticketId);
    await fetchTickets();
  }, [fetchTickets]);

  const toggleItemDone = useCallback(async (itemId: string, isDone: boolean) => {
    await supabase
      .from('pos_kds_ticket_items')
      .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
      .eq('id', itemId);
    // Auto-bump ticket to ready when every item is done
    const ticket = tickets.find((t) => t.items.some((i) => i.id === itemId));
    if (ticket && isDone && ticket.status !== 'ready') {
      const allDone = ticket.items.every((i) => i.id === itemId || i.is_done);
      if (allDone) {
        await supabase.from('pos_kds_tickets')
          .update({ status: 'ready', ready_at: new Date().toISOString() })
          .eq('id', ticket.id);
      }
    }
    await fetchTickets();
  }, [fetchTickets, tickets]);

  return { tickets, recent, loading, updateStatus, recallTicket, toggleItemDone, refetch: fetchTickets };
};