import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureUnlockListeners, playAlertBeep } from "@/lib/audio";

let jingle: HTMLAudioElement | null = null;
export function stopRiderJingle() {
  if (jingle) { jingle.pause(); jingle.currentTime = 0; }
  toast.dismiss("rider-jingle");
}
function playRiderJingle() {
  if (!jingle) { jingle = new Audio("/sounds/zeger-notification.mp3"); jingle.loop = true; }
  jingle.currentTime = 0;
  // Fallback to a synthesized beep when the browser blocks or fails the MP3.
  jingle.play().catch(() => { try { playAlertBeep({ times: 5 }); } catch { /* ignore */ } });
  const stop = () => { stopRiderJingle(); window.removeEventListener("pointerdown", stop, true); window.removeEventListener("keydown", stop, true); };
  setTimeout(() => { window.addEventListener("pointerdown", stop, true); window.addEventListener("keydown", stop, true); }, 300);
}

export interface PendingRiderRequest {
  id: string;
  created_at: string;
  rider_name: string;
  item_count: number;
}

const seen = new Set<string>();

/** Pending rider stock orders for a Hub branch: realtime + polling fallback, toast + sound on new orders. */
export function useRiderRequestAlerts(branchId?: string | null, onOpen?: () => void) {
  const [pending, setPending] = useState<PendingRiderRequest[]>([]);
  const first = useRef(true);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  const load = useCallback(async () => {
    if (!branchId) return;
    const { data } = await (supabase as any)
      .from("rider_stock_requests")
      .select("id, created_at, rider:profiles!rider_stock_requests_rider_id_fkey(full_name), items:rider_stock_request_items(requested_qty)")
      .eq("hub_branch_id", branchId)
      .in("status", ["pending", "adjusted"])
      .order("created_at", { ascending: false });
    let rows = data;
    if (!rows) {
      const r2 = await (supabase as any)
        .from("rider_stock_requests")
        .select("id, created_at, rider_id, items:rider_stock_request_items(requested_qty)")
        .eq("hub_branch_id", branchId)
        .in("status", ["pending", "adjusted"])
        .order("created_at", { ascending: false });
      rows = r2.data || [];
    }
    const list: PendingRiderRequest[] = (rows || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      rider_name: r.rider?.full_name || "Rider",
      item_count: (r.items || []).reduce((s: number, i: any) => s + Number(i.requested_qty || 0), 0),
    }));
    const fresh = list.filter((r) => !seen.has(r.id));
    list.forEach((r) => seen.add(r.id));
    if (!first.current && fresh.length) {
      try { playRiderJingle(); } catch { /* ignore */ }
      fresh.forEach((r) =>
        toast.success("🔔 Order Stok Baru dari Rider", {
          description: `${r.rider_name} • ${r.item_count} item`,
          duration: 20000,
          onDismiss: stopRiderJingle,
          action: { label: "Lihat", onClick: () => (openRef.current ? openRef.current() : (window.location.href = "/inventory/rider-orders")) },
        })
      );
    }
    first.current = false;
    setPending(list);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    ensureUnlockListeners();
    first.current = true;
    load();
    const channel = supabase
      .channel(`rider_req_alert_${branchId}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_stock_requests", filter: `hub_branch_id=eq.${branchId}` }, () => load())
      .subscribe();
    const t = setInterval(load, 20000);
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [branchId, load]);

  return { pending, count: pending.length, reload: load };
}
