import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  fetchMemberPointsHistory,
  channelLabel,
  statusLabel,
  type PointHistoryRow,
} from "@/lib/loyalty";

interface Props {
  memberId: string | null | undefined;
  limit?: number;
  emptyText?: string;
  refreshKey?: number;
}

export function PointsHistoryList({ memberId, limit = 50, emptyText = "Belum ada riwayat poin", refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<PointHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!memberId) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchMemberPointsHistory(memberId, limit);
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [memberId, limit, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const positive = r.change > 0;
        return (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.description || channelLabel(r.source)}</p>
              <p className="text-xs text-muted-foreground">
                {channelLabel(r.source)} •{" "}
                {new Date(r.created_at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {statusLabel(r.status)}
              </Badge>
            </div>
            <span className={`shrink-0 text-sm font-bold ${positive ? "text-emerald-600" : "text-destructive"}`}>
              {positive ? "+" : ""}
              {r.change} poin
            </span>
          </div>
        );
      })}
    </div>
  );
}
