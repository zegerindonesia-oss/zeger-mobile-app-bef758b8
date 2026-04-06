import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Filter, Trophy, TrendingUp, Users, AlertTriangle, FileDown, Target, Zap, Calendar, ArrowUpRight, Star } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const DAILY_COMMISSION = 30000;
const DAILY_TARGET = 500000;
const WEEKLY_TARGET = 3500000;
const MONTHLY_TARGET = 15000000;

const COMMISSION_TIERS = [
  { min: 6000000, rate: 0.175 },
  { min: 5500000, rate: 0.17 },
  { min: 5000000, rate: 0.165 },
  { min: 4500000, rate: 0.16 },
  { min: 4000000, rate: 0.155 },
  { min: 3500000, rate: 0.15 },
  { min: 3000000, rate: 0.14 },
  { min: 2500000, rate: 0.13 },
  { min: 2000000, rate: 0.11 },
  { min: 1500000, rate: 0.08 },
  { min: 1000000, rate: 0.05 },
];

const getCommissionRate = (weeklyRevenue: number): number => {
  for (const tier of COMMISSION_TIERS) {
    if (weeklyRevenue >= tier.min) return tier.rate;
  }
  return 0;
};

const getNextTier = (weeklyRevenue: number): { nextMin: number; nextRate: number } | null => {
  // COMMISSION_TIERS is sorted descending by min
  // Find the next tier above current sales
  const reversedTiers = [...COMMISSION_TIERS].reverse(); // ascending
  for (const tier of reversedTiers) {
    if (weeklyRevenue < tier.min) {
      return { nextMin: tier.min, nextRate: tier.rate };
    }
  }
  return null; // already at max tier
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

const formatCurrencyShort = (amount: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(amount);

const formatDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getJakartaNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
};

const getSunday = (monday: Date): Date => {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return sun;
};

const getWeekKey = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  const monday = getMonday(d);
  return formatDateStr(monday);
};

const getDayName = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "long" });
};

const formatDateDisplay = (dateStr: string): string => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateLong = (dateStr: string): string => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

interface RiderProfile {
  id: string;
  full_name: string;
}

type DetailRow = {
  date: string;
  dayName: string;
  riderId: string;
  riderName: string;
  sales: number;
  dailyCommission: number;
  salesCommission: number;
  waste: number;
  total: number;
};

type ResumeRow = {
  riderId: string;
  riderName: string;
  sales: number;
  dailyCommission: number;
  salesCommission: number;
  waste: number;
  kasbon: number;
  total: number;
};

// === Commission Tier Card Component ===
const CommissionTierCard = ({ weeklySales }: { weeklySales: number }) => {
  const currentRate = getCommissionRate(weeklySales);
  const nextTier = getNextTier(weeklySales);
  const currentCommission = weeklySales * currentRate;

  // Progress to next tier
  const currentTierMin = COMMISSION_TIERS.slice().reverse().find(t => weeklySales >= t.min)?.min || 0;
  const nextTierMin = nextTier?.nextMin || currentTierMin;
  const progressToNext = nextTier
    ? Math.min(((weeklySales - currentTierMin) / (nextTierMin - currentTierMin)) * 100, 100)
    : 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" /> Tier Komisi Saat Ini
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Penjualan Minggu Ini</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(weeklySales)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Rate Komisi</p>
            <p className="text-3xl font-bold text-primary">{(currentRate * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Komisi Penjualan Minggu Ini</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(currentCommission)}</p>
        </div>

        {weeklySales < 1000000 && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            ⚠️ Penjualan belum mencapai Rp 1.000.000 — belum dapat komisi penjualan. Hanya mendapat bonus kehadiran.
          </div>
        )}

        {nextTier && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Menuju tier berikutnya ({(nextTier.nextRate * 100).toFixed(1)}%)</span>
              <span className="font-medium text-foreground">
                {formatCurrency(nextTier.nextMin - weeklySales)} lagi
              </span>
            </div>
            <Progress value={progressToNext} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">
              Target: {formatCurrency(nextTier.nextMin)}
            </p>
          </div>
        )}

        {!nextTier && weeklySales >= 6000000 && (
          <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700">
            🏆 Sudah di tier tertinggi! Komisi 17.5%
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// === Target Tracker Component ===
const TargetTrackerCard = ({ todaySales, weeklySales, monthlySales }: { todaySales: number; weeklySales: number; monthlySales: number }) => {
  const targets = [
    { label: "Harian", current: todaySales, target: DAILY_TARGET, icon: Target },
    { label: "Mingguan", current: weeklySales, target: WEEKLY_TARGET, icon: Calendar },
    { label: "Bulanan", current: monthlySales, target: MONTHLY_TARGET, icon: TrendingUp },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Target Penjualan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {targets.map(({ label, current, target, icon: Icon }) => {
          const pct = Math.min(Math.round((current / target) * 100), 100);
          const achieved = current >= target;
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className={`text-sm font-bold ${achieved ? "text-green-600" : "text-foreground"}`}>
                  {pct}%
                </span>
              </div>
              <Progress value={pct} className="h-2.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(current)}</span>
                <span>{formatCurrency(target)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// === Income Projection Component ===
const IncomeProjectionCard = ({ weeklySales, daysWorkedThisWeek, monthlySales }: { weeklySales: number; daysWorkedThisWeek: number; monthlySales: number }) => {
  const rate = getCommissionRate(weeklySales);
  const weeklyCommission = weeklySales * rate;
  const weeklyAttendance = daysWorkedThisWeek * DAILY_COMMISSION;
  const estimatedWeeklyIncome = weeklyCommission + weeklyAttendance;

  // Estimate monthly: assume 4 weeks similar performance
  const estimatedMonthlyIncome = estimatedWeeklyIncome * 4;

  return (
    <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" /> Proyeksi Pendapatan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Estimasi Minggu Ini</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(estimatedWeeklyIncome)}</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Komisi: {formatCurrency(weeklyCommission)}</p>
              <p>Kehadiran: {formatCurrency(weeklyAttendance)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Estimasi Bulanan</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(estimatedMonthlyIncome)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Berdasarkan performa saat ini
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// === Commission Tiers Reference ===
const CommissionTiersReference = ({ currentWeeklySales }: { currentWeeklySales: number }) => {
  const tiersAsc = [...COMMISSION_TIERS].reverse();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tabel Tier Komisi</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Penjualan Mingguan</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className={currentWeeklySales < 1000000 ? "bg-destructive/5" : ""}>
              <TableCell className="text-sm">&lt; Rp 1.000.000</TableCell>
              <TableCell className="text-right font-medium text-destructive">0%</TableCell>
            </TableRow>
            {tiersAsc.map((tier, idx) => {
              const nextTier = tiersAsc[idx + 1];
              const isActive = currentWeeklySales >= tier.min && (!nextTier || currentWeeklySales < nextTier.min);
              return (
                <TableRow key={tier.min} className={isActive ? "bg-primary/10 font-bold" : ""}>
                  <TableCell className="text-sm">
                    {nextTier
                      ? `Rp ${formatCurrencyShort(tier.min)} – ${formatCurrencyShort(nextTier.min - 1)}`
                      : `≥ Rp ${formatCurrencyShort(tier.min)}`
                    }
                    {isActive && <span className="ml-2 text-primary">← Saat Ini</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{(tier.rate * 100).toFixed(1)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const RiderIncome = () => {
  const { userProfile } = useAuth();
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [selectedRider, setSelectedRider] = useState("all");
  const [loading, setLoading] = useState(false);
  const [kasbonValues, setKasbonValues] = useState<Record<string, number>>({});

  const now = getJakartaNow();
  const todayStr = formatDateStr(now);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [transactionData, setTransactionData] = useState<any[]>([]);
  const [wasteData, setWasteData] = useState<any[]>([]);
  const [productSalesData, setProductSalesData] = useState<{ name: string; qty: number }[]>([]);
  const branchId = userProfile?.branch_id;

  // === Existing fetch riders ===
  useEffect(() => {
    const fetchRiders = async () => {
      let q = supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["rider", "sb_rider", "bh_rider"])
        .eq("is_active", true);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q.order("full_name");
      setRiders(data || []);
    };
    fetchRiders();
  }, [branchId]);

  // === Existing fetch data ===
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const filterStart = new Date(startDate + "T00:00:00");
        const filterEnd = new Date(endDate + "T00:00:00");
        const weekStart = getMonday(filterStart);
        const lastMonday = getMonday(filterEnd);
        const weekEnd = getSunday(lastMonday);

        const txStartStr = formatDateStr(weekStart);
        const txEndStr = formatDateStr(weekEnd);

        let txQ = supabase
          .from("transactions")
          .select("rider_id, final_amount, transaction_date")
          .eq("status", "completed")
          .eq("is_voided", false)
          .gte("transaction_date", `${txStartStr}T00:00:00+07:00`)
          .lte("transaction_date", `${txEndStr}T23:59:59+07:00`);
        if (branchId) txQ = txQ.eq("branch_id", branchId);
        if (selectedRider !== "all") txQ = txQ.eq("rider_id", selectedRider);

        let wasteQ = supabase
          .from("product_waste")
          .select("rider_id, total_waste, created_at")
          .gte("created_at", `${startDate}T00:00:00+07:00`)
          .lte("created_at", `${endDate}T23:59:59+07:00`);
        if (branchId) wasteQ = wasteQ.eq("branch_id", branchId);
        if (selectedRider !== "all") wasteQ = wasteQ.eq("rider_id", selectedRider);

        const fetchAll = async (query: any) => {
          const all: any[] = [];
          let from = 0;
          while (true) {
            const { data } = await query.range(from, from + 999);
            if (!data || data.length === 0) break;
            all.push(...data);
            if (data.length < 1000) break;
            from += 1000;
          }
          return all;
        };

        const [tx, waste] = await Promise.all([fetchAll(txQ), fetchAll(wasteQ)]);
        setTransactionData(tx);
        setWasteData(waste);

        // Fetch product sales data for menu terjual
        let prodQ = supabase
          .from("transaction_items")
          .select(`quantity, products!inner(name), transactions!inner(status, is_voided, transaction_date, branch_id, rider_id)`)
          .eq("transactions.status", "completed")
          .eq("transactions.is_voided", false)
          .gte("transactions.transaction_date", `${startDate}T00:00:00+07:00`)
          .lte("transactions.transaction_date", `${endDate}T23:59:59+07:00`);
        if (branchId) prodQ = prodQ.eq("transactions.branch_id", branchId);
        if (selectedRider !== "all") prodQ = prodQ.eq("transactions.rider_id", selectedRider);

        const prodItems = await fetchAll(prodQ);
        const prodMap = new Map<string, number>();
        prodItems.forEach((item: any) => {
          const name = item.products?.name || "Unknown";
          prodMap.set(name, (prodMap.get(name) || 0) + Number(item.quantity || 0));
        });
        const sorted = Array.from(prodMap.entries())
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty);
        setProductSalesData(sorted);
      } catch (err: any) {
        toast.error("Gagal memuat data: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedRider, branchId]);

  // === Existing data computation + new rider stats ===
  const { resumeData, detailData, riderStats } = useMemo(() => {
    const riderMap = new Map<string, string>();
    riders.forEach((r) => riderMap.set(r.id, r.full_name));

    // Daily sales per rider per date
    const dailySales = new Map<string, Map<string, number>>();
    // Weekly revenue per rider per weekMonday
    const weeklyRevenue = new Map<string, Map<string, number>>();

    transactionData.forEach((tx) => {
      if (!tx.rider_id) return;
      const txDate = tx.transaction_date.split("T")[0];
      const amount = Number(tx.final_amount || 0);

      if (!dailySales.has(tx.rider_id)) dailySales.set(tx.rider_id, new Map());
      dailySales.get(tx.rider_id)!.set(txDate, (dailySales.get(tx.rider_id)!.get(txDate) || 0) + amount);

      const wk = getWeekKey(txDate);
      if (!weeklyRevenue.has(tx.rider_id)) weeklyRevenue.set(tx.rider_id, new Map());
      weeklyRevenue.get(tx.rider_id)!.set(wk, (weeklyRevenue.get(tx.rider_id)!.get(wk) || 0) + amount);
    });

    // Waste per rider per date
    const wasteByRiderDate = new Map<string, Map<string, number>>();
    wasteData.forEach((w) => {
      const dateStr = w.created_at.split("T")[0];
      if (!wasteByRiderDate.has(w.rider_id)) wasteByRiderDate.set(w.rider_id, new Map());
      wasteByRiderDate.get(w.rider_id)!.set(dateStr, (wasteByRiderDate.get(w.rider_id)!.get(dateStr) || 0) + Number(w.total_waste || 0));
    });

    // Generate dates in filter range
    const dates: string[] = [];
    const d = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (d <= end) {
      dates.push(formatDateStr(d));
      d.setDate(d.getDate() + 1);
    }

    // Collect rider IDs
    const riderIds = new Set<string>();
    transactionData.forEach((tx) => { if (tx.rider_id) riderIds.add(tx.rider_id); });
    wasteData.forEach((w) => riderIds.add(w.rider_id));
    if (selectedRider !== "all") {
      riderIds.add(selectedRider);
    } else {
      riders.forEach((r) => riderIds.add(r.id));
    }

    // Sales commission lump sum mapping
    const salesCommissionDay = new Map<string, Map<string, number>>();

    riderIds.forEach((riderId) => {
      const riderWeeks = weeklyRevenue.get(riderId);
      if (!riderWeeks) return;

      riderWeeks.forEach((revenue, weekMonday) => {
        const rate = getCommissionRate(revenue);
        const totalCommission = revenue * rate;

        const monday = new Date(weekMonday + "T00:00:00");

        let lastDayInRange: string | null = null;
        for (let i = 6; i >= 0; i--) {
          const day = new Date(monday);
          day.setDate(monday.getDate() + i);
          const ds = formatDateStr(day);
          if (ds >= startDate && ds <= endDate) {
            lastDayInRange = ds;
            break;
          }
        }

        if (!lastDayInRange || totalCommission === 0) return;

        if (!salesCommissionDay.has(riderId)) salesCommissionDay.set(riderId, new Map());
        const rd = salesCommissionDay.get(riderId)!;
        rd.set(lastDayInRange, (rd.get(lastDayInRange) || 0) + totalCommission);
      });
    });

    // Build detail rows
    const details: DetailRow[] = [];
    const resumeAgg = new Map<string, { riderName: string; sales: number; dailyCommission: number; salesCommission: number; waste: number }>();

    riderIds.forEach((riderId) => {
      const name = riderMap.get(riderId) || riderId.slice(0, 8);
      if (!resumeAgg.has(riderId))
        resumeAgg.set(riderId, { riderName: name, sales: 0, dailyCommission: 0, salesCommission: 0, waste: 0 });
      const agg = resumeAgg.get(riderId)!;

      dates.forEach((date) => {
        const daySales = dailySales.get(riderId)?.get(date) || 0;
        const daily = daySales > 0 ? DAILY_COMMISSION : 0;
        const salesComm = salesCommissionDay.get(riderId)?.get(date) || 0;
        const waste = wasteByRiderDate.get(riderId)?.get(date) || 0;
        const total = daily + salesComm - waste;

        if (daySales > 0 || salesComm > 0 || waste > 0) {
          details.push({
            date,
            dayName: getDayName(date),
            riderId,
            riderName: name,
            sales: daySales,
            dailyCommission: daily,
            salesCommission: salesComm,
            waste,
            total,
          });
          agg.sales += daySales;
          agg.dailyCommission += daily;
          agg.salesCommission += salesComm;
          agg.waste += waste;
        }
      });
    });

    const resume: ResumeRow[] = Array.from(resumeAgg.entries())
      .map(([riderId, agg]) => {
        const kasbon = kasbonValues[riderId] || 0;
        return {
          riderId,
          ...agg,
          kasbon,
          total: agg.dailyCommission + agg.salesCommission - agg.waste - kasbon,
        };
      })
      .filter((r) => r.sales > 0 || r.salesCommission > 0 || r.waste > 0)
      .sort((a, b) => b.total - a.total);

    details.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : b.total - a.total));

    // === Calculate rider stats for dashboard cards ===
    const jakartaNow = getJakartaNow();
    const todayDateStr = formatDateStr(jakartaNow);
    const currentWeekMonday = formatDateStr(getMonday(jakartaNow));
    const currentMonthStart = formatDateStr(new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 1));

    // Per-rider stats (for single rider view)
    const stats = new Map<string, { todaySales: number; weeklySales: number; monthlySales: number; daysWorkedThisWeek: number }>();

    riderIds.forEach((riderId) => {
      const riderDailySales = dailySales.get(riderId) || new Map();

      let todaySalesVal = 0;
      let weeklySalesVal = 0;
      let monthlySalesVal = 0;
      let daysWorked = 0;

      riderDailySales.forEach((amount, date) => {
        if (date === todayDateStr) todaySalesVal += amount;
        if (date >= currentWeekMonday) {
          weeklySalesVal += amount;
          if (amount > 0) daysWorked++;
        }
        if (date >= currentMonthStart) monthlySalesVal += amount;
      });

      // Also check weeklyRevenue for current week (it may include full week data)
      const riderWeeklyRev = weeklyRevenue.get(riderId)?.get(currentWeekMonday) || 0;
      // Use the larger value (weeklyRevenue includes the full week fetched data)
      const finalWeeklySales = Math.max(weeklySalesVal, riderWeeklyRev);

      stats.set(riderId, {
        todaySales: todaySalesVal,
        weeklySales: finalWeeklySales,
        monthlySales: monthlySalesVal,
        daysWorkedThisWeek: daysWorked,
      });
    });

    return { resumeData: resume, detailData: details, riderStats: stats };
  }, [transactionData, wasteData, riders, startDate, endDate, selectedRider, kasbonValues]);

  const handleQuickFilter = (type: string) => {
    const now = getJakartaNow();
    const today = formatDateStr(now);
    switch (type) {
      case "today":
        setStartDate(today);
        setEndDate(today);
        break;
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const ys = formatDateStr(y);
        setStartDate(ys);
        setEndDate(ys);
        break;
      }
      case "week": {
        const mon = getMonday(now);
        setStartDate(formatDateStr(mon));
        setEndDate(today);
        break;
      }
      case "month": {
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(formatDateStr(ms));
        setEndDate(today);
        break;
      }
    }
  };

  const totalAll = resumeData.reduce((s, r) => s + r.total, 0);

  // Get current rider stats for dashboard
  const currentRiderStats = selectedRider !== "all" ? riderStats.get(selectedRider) : null;
  const currentRiderWeeklySales = currentRiderStats?.weeklySales || 0;

  // === PDF export with logo, red brand, tier table, menu terjual ===
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 14;
    const marginR = 14;
    const contentW = pageW - marginL - marginR;
    let y = 16;

    // Add logo top-right (1:1 aspect ratio)
    try {
      const logoImg = new Image();
      logoImg.src = "/images/zeger-logo.png";
      const logoSize = 18;
      doc.addImage(logoImg, "PNG", pageW - marginR - logoSize, 4, logoSize, logoSize);
    } catch (e) { /* skip */ }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Pendapatan Rider Zeger Coffee", pageW / 2, y, { align: "center" });
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const riderName = selectedRider !== "all" ? riders.find(r => r.id === selectedRider)?.full_name : null;
    const periodText = `Periode ${formatDateLong(startDate)} s/d ${formatDateLong(endDate)}`;
    doc.text(riderName ? `${periodText} — Rider: ${riderName}` : periodText, pageW / 2, y, { align: "center" });
    y += 10;

    const brandRed = 220, brandGn = 38, brandBl = 38;

    const drawTable = (
      title: string,
      headers: string[],
      colWidths: number[],
      rows: string[][],
      startY: number
    ): number => {
      let cy = startY;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(title, marginL, cy);
      cy += 6;

      const rowH = 6;
      const headerH = 7;

      doc.setFillColor(brandRed, brandGn, brandBl);
      doc.rect(marginL, cy, contentW, headerH, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      let cx = marginL;
      headers.forEach((h, i) => {
        const align = i >= 2 ? "right" : "left";
        const tx = align === "right" ? cx + colWidths[i] - 2 : cx + 2;
        doc.text(h, tx, cy + 5, { align });
        cx += colWidths[i];
      });
      cy += headerH;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);

      rows.forEach((row, rowIdx) => {
        if (cy + rowH > pageH - 12) {
          doc.addPage();
          cy = 14;
        }
        const isTotal = row[0] === "TOTAL";
        if (rowIdx % 2 === 0 && !isTotal) {
          doc.setFillColor(255, 240, 240);
          doc.rect(marginL, cy, contentW, rowH, "F");
        }
        if (isTotal) {
          doc.setFillColor(254, 202, 202);
          doc.rect(marginL, cy, contentW, rowH, "F");
          doc.setFont("helvetica", "bold");
        }
        cx = marginL;
        row.forEach((cell, i) => {
          const align = i >= 2 ? "right" : "left";
          const tx = align === "right" ? cx + colWidths[i] - 2 : cx + 2;
          doc.text(cell, tx, cy + 4.5, { align });
          cx += colWidths[i];
        });
        if (isTotal) doc.setFont("helvetica", "normal");
        cy += rowH;
      });
      return cy + 4;
    };

    // Resume Table
    const resumeHeaders = ["No", "Nama Rider", "Sales", "Komisi Harian", "Komisi Penjualan", "Waste (-)", "Kasbon (-)", "Total Pendapatan"];
    const resumeColWidths = [10, 40, 32, 32, 34, 32, 32, 52];
    const resumeRows = resumeData.map((r, i) => [
      String(i + 1), r.riderName,
      formatCurrencyShort(r.sales), formatCurrencyShort(r.dailyCommission),
      formatCurrencyShort(r.salesCommission), formatCurrencyShort(r.waste),
      formatCurrencyShort(r.kasbon), formatCurrencyShort(r.total),
    ]);
    resumeRows.push([
      "TOTAL", "",
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.sales, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.dailyCommission, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.salesCommission, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.waste, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.kasbon, 0)),
      formatCurrencyShort(totalAll),
    ]);
    y = drawTable("Resume Pendapatan Rider", resumeHeaders, resumeColWidths, resumeRows, y);
    y += 4;

    // Detail Table
    const detailHeaders = ["Tanggal", "Hari", "Nama Rider", "Sales", "Komisi Harian", "Komisi Penjualan", "Waste (-)", "Total"];
    const detailColWidths = [28, 22, 45, 35, 35, 35, 35, 38];
    const detailRows = detailData.map((r) => [
      formatDateDisplay(r.date), r.dayName, r.riderName,
      formatCurrencyShort(r.sales), formatCurrencyShort(r.dailyCommission),
      formatCurrencyShort(r.salesCommission), formatCurrencyShort(r.waste),
      formatCurrencyShort(r.total),
    ]);
    detailRows.push([
      "TOTAL", `${detailData.length} hari`, "",
      formatCurrencyShort(detailData.reduce((s, r) => s + r.sales, 0)),
      formatCurrencyShort(detailData.reduce((s, r) => s + r.dailyCommission, 0)),
      formatCurrencyShort(detailData.reduce((s, r) => s + r.salesCommission, 0)),
      formatCurrencyShort(detailData.reduce((s, r) => s + r.waste, 0)),
      formatCurrencyShort(detailData.reduce((s, r) => s + r.total, 0)),
    ]);

    if (y + 20 > pageH - 12) { doc.addPage(); y = 14; }
    y = drawTable("Detail Pendapatan Rider", detailHeaders, detailColWidths, detailRows, y);

    // === New Page: Tier Komisi + Menu Terjual ===
    doc.addPage();
    y = 16;
    try {
      const logoImg2 = new Image();
      logoImg2.src = "/images/zeger-logo.png";
      doc.addImage(logoImg2, "PNG", pageW - marginR - 35, 6, 35, 14);
    } catch (e) { /* skip */ }

    // Tier Table
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Tabel Tier Komisi Penjualan", marginL, y);
    y += 6;

    const tierRowH = 6, tierHeaderH = 7;
    const tierTotalW = 120;

    doc.setFillColor(brandRed, brandGn, brandBl);
    doc.rect(marginL, y, tierTotalW, tierHeaderH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Penjualan Mingguan", marginL + 2, y + 5);
    doc.text("Rate", marginL + tierTotalW - 2, y + 5, { align: "right" });
    y += tierHeaderH;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.setFillColor(255, 240, 240);
    doc.rect(marginL, y, tierTotalW, tierRowH, "F");
    doc.text("< Rp 1.000.000", marginL + 2, y + 4.5);
    doc.setTextColor(brandRed, brandGn, brandBl);
    doc.text("0%", marginL + tierTotalW - 2, y + 4.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += tierRowH;

    const tiersAsc = [...COMMISSION_TIERS].reverse();
    tiersAsc.forEach((tier, idx) => {
      const nextTier = tiersAsc[idx + 1];
      if (idx % 2 === 1) {
        doc.setFillColor(255, 240, 240);
        doc.rect(marginL, y, tierTotalW, tierRowH, "F");
      }
      const label = nextTier
        ? `Rp ${formatCurrencyShort(tier.min)} - ${formatCurrencyShort(nextTier.min - 1)}`
        : `>= Rp ${formatCurrencyShort(tier.min)}`;
      doc.text(label, marginL + 2, y + 4.5);
      doc.text(`${(tier.rate * 100).toFixed(1)}%`, marginL + tierTotalW - 2, y + 4.5, { align: "right" });
      y += tierRowH;
    });
    y += 10;

    // Menu Terjual with donut chart
    if (productSalesData.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Menu Terjual", marginL, y);
      y += 6;

      const totalQty = productSalesData.reduce((s, p) => s + p.qty, 0);
      const top5 = productSalesData.slice(0, 5);
      const othersQty = productSalesData.slice(5).reduce((s, p) => s + p.qty, 0);

      const centerX = marginL + 30;
      const centerY2 = y + 30;
      const outerR = 25, innerR = 14;
      const chartColors: [number, number, number][] = [
        [220, 38, 38], [239, 68, 68], [252, 165, 165],
        [254, 202, 202], [254, 226, 226], [200, 200, 200],
      ];

      const items = [...top5];
      if (othersQty > 0) items.push({ name: "Lainnya", qty: othersQty });

      let startAngle = -Math.PI / 2;
      items.forEach((item, idx) => {
        const sliceAngle = (item.qty / totalQty) * 2 * Math.PI;
        const [cr, cg, cb] = chartColors[idx % chartColors.length];
        const steps = Math.max(Math.round(sliceAngle * 30), 2);
        const pts: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + (sliceAngle * i) / steps;
          pts.push([centerX + Math.cos(a) * outerR, centerY2 + Math.sin(a) * outerR]);
        }
        for (let i = steps; i >= 0; i--) {
          const a = startAngle + (sliceAngle * i) / steps;
          pts.push([centerX + Math.cos(a) * innerR, centerY2 + Math.sin(a) * innerR]);
        }
        doc.setFillColor(cr, cg, cb);
        for (let i = 1; i < pts.length - 1; i++) {
          doc.triangle(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "F");
        }
        startAngle += sliceAngle;
      });

      doc.setFillColor(255, 255, 255);
      doc.circle(centerX, centerY2, innerR - 1, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(String(totalQty), centerX, centerY2 + 1, { align: "center" });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("Products", centerX, centerY2 + 5, { align: "center" });

      let legendY = y + 8;
      const legendX = marginL + 65;
      items.forEach((item, idx) => {
        const [cr, cg, cb] = chartColors[idx % chartColors.length];
        doc.setFillColor(cr, cg, cb);
        doc.circle(legendX, legendY, 2, "F");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        const pct = Math.round((item.qty / totalQty) * 100);
        doc.text(item.name, legendX + 5, legendY + 1);
        doc.text(String(item.qty), legendX + 75, legendY + 1, { align: "right" });
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`${pct}%`, legendX + 85, legendY + 1, { align: "right" });
        legendY += 7;
      });
    }

    const fileName = `Pendapatan_Rider_${startDate}_${endDate}.pdf`;
    doc.save(fileName);
    toast.success("PDF berhasil diexport!");
  }, [resumeData, detailData, startDate, endDate, selectedRider, riders, totalAll, productSalesData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pendapatan Rider</h1>
          <p className="text-muted-foreground text-sm">Monitoring komisi harian, komisi penjualan, dan waste rider secara real-time</p>
        </div>
        <Button onClick={handleExportPDF} disabled={loading || resumeData.length === 0} className="gap-2">
          <FileDown className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Hari Ini", val: "today" },
              { label: "Kemarin", val: "yesterday" },
              { label: "Minggu Ini", val: "week" },
              { label: "Bulan Ini", val: "month" },
            ].map((f) => (
              <Button key={f.val} variant="outline" size="sm" className="text-xs" onClick={() => handleQuickFilter(f.val)}>
                {f.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Rider</Label>
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger><SelectValue placeholder="Pilih Rider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Rider</SelectItem>
                  {riders.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Tanggal Akhir</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Rider Aktif</p>
                <p className="text-xl font-bold">{resumeData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Komisi Harian</p>
                <p className="text-xl font-bold">{formatCurrency(resumeData.reduce((s, r) => s + r.dailyCommission, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Komisi Penjualan</p>
                <p className="text-xl font-bold">{formatCurrency(resumeData.reduce((s, r) => s + r.salesCommission, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Waste</p>
                <p className="text-xl font-bold">{formatCurrency(resumeData.reduce((s, r) => s + r.waste, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === NEW: Rider Dashboard Cards (when specific rider selected) === */}
      {selectedRider !== "all" && currentRiderStats && (
        <div className="space-y-4">
          {/* Sales Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Penjualan Hari Ini</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(currentRiderStats.todaySales)}</p>
                <p className="text-xs text-muted-foreground mt-1">Target: {formatCurrency(DAILY_TARGET)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Penjualan Minggu Ini</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(currentRiderStats.weeklySales)}</p>
                <p className="text-xs text-muted-foreground mt-1">Target: {formatCurrency(WEEKLY_TARGET)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Penjualan Bulan Ini</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(currentRiderStats.monthlySales)}</p>
                <p className="text-xs text-muted-foreground mt-1">Target: {formatCurrency(MONTHLY_TARGET)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Commission Tier + Target Tracker */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CommissionTierCard weeklySales={currentRiderWeeklySales} />
            <TargetTrackerCard
              todaySales={currentRiderStats.todaySales}
              weeklySales={currentRiderStats.weeklySales}
              monthlySales={currentRiderStats.monthlySales}
            />
          </div>

          {/* Income Projection + Tier Reference */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IncomeProjectionCard
              weeklySales={currentRiderStats.weeklySales}
              daysWorkedThisWeek={currentRiderStats.daysWorkedThisWeek}
              monthlySales={currentRiderStats.monthlySales}
            />
            <CommissionTiersReference currentWeeklySales={currentRiderWeeklySales} />
          </div>
        </div>
      )}

      {/* Resume Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" /> Resume Pendapatan Rider - Top Rank
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : resumeData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Tidak ada data untuk periode ini</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Nama Rider</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Komisi Harian</TableHead>
                  <TableHead className="text-right">Komisi Penjualan</TableHead>
                  <TableHead className="text-right">Waste (-)</TableHead>
                  <TableHead className="text-right">Kasbon (-)</TableHead>
                  <TableHead className="text-right">Total Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumeData.map((row, idx) => (
                  <TableRow key={row.riderId}>
                    <TableCell className="font-medium">
                      {idx < 3 ? (
                        <span className="inline-flex items-center gap-1">
                          <Trophy className={`h-4 w-4 ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : "text-amber-600"}`} />
                          {idx + 1}
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.riderName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.sales)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.dailyCommission)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.salesCommission)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(row.waste)}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        className="w-28 text-right ml-auto"
                        value={kasbonValues[row.riderId] || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setKasbonValues((prev) => ({ ...prev, [row.riderId]: val }));
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(resumeData.reduce((s, r) => s + r.sales, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(resumeData.reduce((s, r) => s + r.dailyCommission, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(resumeData.reduce((s, r) => s + r.salesCommission, 0))}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(resumeData.reduce((s, r) => s + r.waste, 0))}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(resumeData.reduce((s, r) => s + r.kasbon, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalAll)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Pendapatan Rider</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : detailData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Tidak ada data detail</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead>Nama Rider</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Komisi Harian</TableHead>
                  <TableHead className="text-right">Komisi Penjualan</TableHead>
                  <TableHead className="text-right">Waste (-)</TableHead>
                  <TableHead className="text-right">Total Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailData.map((row, idx) => (
                  <TableRow key={`${row.date}-${row.riderId}-${idx}`}>
                    <TableCell>{formatDateDisplay(row.date)}</TableCell>
                    <TableCell>{row.dayName}</TableCell>
                    <TableCell className="font-medium">{row.riderName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.sales)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.dailyCommission)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.salesCommission)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(row.waste)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell>{detailData.length} hari</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(detailData.reduce((s, r) => s + r.sales, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(detailData.reduce((s, r) => s + r.dailyCommission, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(detailData.reduce((s, r) => s + r.salesCommission, 0))}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(detailData.reduce((s, r) => s + r.waste, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(detailData.reduce((s, r) => s + r.total, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RiderIncome;
