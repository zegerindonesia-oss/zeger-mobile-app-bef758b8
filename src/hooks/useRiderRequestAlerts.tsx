import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { playAlertBeep } from "@/lib/audio";

/** Toast + beep when a rider sends a new stock order to this Hub branch. */
export function useRiderRequestAlerts(branchId?: string | null, onOpen?: () => void) {
  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`rider_req_alert_${branchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rider_stock_requests", filter: `hub_branch_id=eq.${branchId}` },
        async (payload: any) => {
          const { data } = await supabase.from("profiles").select("full_name").eq("id", payload.new.rider_id).maybeSingle();
          try { playAlertBeep({ times: 3 }); } catch { /* ignore */ }
          toast.success("Order Stok Baru dari Rider", {
            description: `${data?.full_name || "Rider"} mengirim order ke Central Kitchen`,
            duration: 15000,
            action: { label: "Lihat", onClick: () => (onOpen ? onOpen() : (window.location.href = "/stock-transfer")) },
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branchId]);
}
