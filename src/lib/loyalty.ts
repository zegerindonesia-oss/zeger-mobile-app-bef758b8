import { supabase } from "@/integrations/supabase/client";

export interface LoyaltyEarnSettings {
  enabled: boolean;
  rupiah_per_point: number;
  min_transaction: number;
}

export interface RedemptionInfo {
  id: string;
  code: string;
  member_id: string;
  member_name: string | null;
  reward_name: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  min_transaction: number;
  status: string;
}

export interface PointHistoryRow {
  id: string;
  change: number;
  description: string | null;
  source: string | null;
  reference_id: string | null;
  status: string | null;
  created_at: string;
}

const QUEUE_KEY = "zeger_loyalty_queue_v1";

export const DEFAULT_EARN_SETTINGS: LoyaltyEarnSettings = {
  enabled: true,
  rupiah_per_point: 10000,
  min_transaction: 0,
};

export async function getLoyaltyEarnSettings(): Promise<LoyaltyEarnSettings> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "loyalty.earning")
      .maybeSingle();
    const v: any = data?.setting_value || {};
    return {
      enabled: v.enabled ?? true,
      rupiah_per_point: Number(v.rupiah_per_point ?? 10000),
      min_transaction: Number(v.min_transaction ?? 0),
    };
  } catch {
    return DEFAULT_EARN_SETTINGS;
  }
}

export function estimatePoints(amount: number, settings: LoyaltyEarnSettings): number {
  if (!settings.enabled || settings.rupiah_per_point <= 0) return 0;
  if (amount < settings.min_transaction) return 0;
  return Math.floor(amount / settings.rupiah_per_point);
}

export const CHANNEL_LABELS: Record<string, string> = {
  rider: "On The Wheels (Rider)",
  street: "On The Street",
  pos: "Outlet / Kasir",
  app: "App Customer",
  order: "App Customer",
  redeem: "Tukar Poin",
};

export function channelLabel(source?: string | null) {
  if (!source) return "Lainnya";
  return CHANNEL_LABELS[source] || source;
}

export const STATUS_LABELS: Record<string, string> = {
  earned: "Masuk",
  pending: "Pending (offline)",
  locked: "Terkunci",
  redeemed: "Terpakai",
  expired: "Kedaluwarsa",
};

export function statusLabel(status?: string | null) {
  if (!status) return "Masuk";
  return STATUS_LABELS[status] || status;
}

/* ---------------- Offline queue ---------------- */

export interface QueuedAward {
  memberId: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description?: string | null;
  queuedAt: string;
}

function readQueue(): QueuedAward[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedAward[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function pendingLoyaltyCount(): number {
  return readQueue().length;
}

function enqueue(item: QueuedAward) {
  const q = readQueue();
  if (item.referenceId && q.some((x) => x.referenceId === item.referenceId && x.source === item.source)) return;
  q.push(item);
  writeQueue(q);
}

/**
 * Award points. When offline (or the request fails), the award is queued in
 * localStorage and replayed automatically once the connection is back.
 * The RPC is idempotent per (source, reference_id) so replays never double-count.
 */
export async function awardLoyaltyPoints(params: {
  memberId: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description?: string | null;
}): Promise<{ points: number; queued: boolean }> {
  const payload: QueuedAward = {
    memberId: params.memberId,
    amount: params.amount,
    source: params.source,
    referenceId: params.referenceId ?? null,
    description: params.description ?? null,
    queuedAt: new Date().toISOString(),
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(payload);
    return { points: 0, queued: true };
  }

  try {
    const { data, error } = await (supabase as any).rpc("award_loyalty_points", {
      _member_id: params.memberId,
      _amount: params.amount,
      _source: params.source,
      _reference_id: params.referenceId ?? null,
      _description: params.description ?? null,
    });
    if (error) throw error;
    return { points: Number(data) || 0, queued: false };
  } catch (e) {
    console.error("awardLoyaltyPoints failed, queued for sync", e);
    enqueue(payload);
    return { points: 0, queued: true };
  }
}

export async function flushLoyaltyQueue(): Promise<number> {
  const q = readQueue();
  if (!q.length) return 0;
  const remaining: QueuedAward[] = [];
  let synced = 0;
  for (const item of q) {
    try {
      const { error } = await (supabase as any).rpc("award_loyalty_points", {
        _member_id: item.memberId,
        _amount: item.amount,
        _source: item.source,
        _reference_id: item.referenceId ?? null,
        _description: item.description ?? null,
      });
      if (error) throw error;
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return synced;
}

let syncInitialized = false;

export function initLoyaltySync() {
  if (syncInitialized || typeof window === "undefined") return;
  syncInitialized = true;
  const run = () => {
    if (navigator.onLine) flushLoyaltyQueue();
  };
  window.addEventListener("online", run);
  window.setTimeout(run, 3000);
  window.setInterval(run, 60000);
}

/* ---------------- Redemption ---------------- */

export async function redeemReward(memberId: string, rewardId: string) {
  const { data, error } = await (supabase as any).rpc("redeem_loyalty_reward", {
    _member_id: memberId,
    _reward_id: rewardId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as {
    code: string;
    points_spent: number;
    remaining_points: number;
    discount_type: string;
    discount_value: number;
  };
}

export async function lookupRedemption(code: string): Promise<RedemptionInfo | null> {
  const { data, error } = await (supabase as any).rpc("lookup_redemption", { _code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as RedemptionInfo) || null;
}

export function previewRedemptionDiscount(r: RedemptionInfo, amount: number): number {
  if (amount < Number(r.min_transaction || 0)) return 0;
  let disc =
    r.discount_type === "percentage"
      ? (amount * Number(r.discount_value)) / 100
      : Number(r.discount_value);
  if (r.discount_type === "percentage" && r.max_discount) disc = Math.min(disc, Number(r.max_discount));
  return Math.max(0, Math.min(Math.round(disc), amount));
}

export async function useRedemption(code: string, amount: number, channel: string, reference?: string | null) {
  const { data, error } = await (supabase as any).rpc("use_redemption", {
    _code: code,
    _amount: amount,
    _channel: channel,
    _reference: reference ?? null,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export async function fetchMemberPointsHistory(memberId: string, limit = 50): Promise<PointHistoryRow[]> {
  const { data, error } = await (supabase as any).rpc("member_points_history", {
    _member_id: memberId,
    _limit: limit,
  });
  if (error) throw error;
  return (data || []) as PointHistoryRow[];
}
