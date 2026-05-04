import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wallet, Trophy, TrendingUp, Target, Zap, Calendar, Star, ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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

const getNextTier = (weeklyRevenue: number) => {
  const reversedTiers = [...COMMISSION_TIERS].reverse();
  for (const tier of reversedTiers) {
    if (weeklyRevenue < tier.min) return { nextMin: tier.min, nextRate: tier.rate };
  }
  return null;
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
  return formatDateStr(getMonday(d));
};

const getDayName = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "long" });
};

const formatDateDisplay = (dateStr: string): string => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};

type Period = "today" | "yesterday" | "week" | "month" | "custom";

interface DetailRow {
  date: string;
  dayName: string;
  sales: number;
  dailyCommission: number;
  salesCommission: number;
  waste: number;
  total: number;
}

const MobileRiderIncome = () => {
  const { userProfile } = useAuth();
  const riderId = userProfile?.id;

  const [period, setPeriod] = useState<Period>("today");
  const [customStart, setCustomStart] = useState<string>(() => formatDateStr(getJakartaNow()));
  const [customEnd, setCustomEnd] = useState<string>(() => formatDateStr(getJakartaNow()));
  const [loading, setLoading] = useState(false);
  const [transactionData, setTransactionData] = useState<any[]>([]);
  const [wasteData, setWasteData] = useState<any[]>([]);
  const [kasbonValue, setKasbonValue] = useState(0);

  const { startDate, endDate } = useMemo(() => {
    const now = getJakartaNow();
    const today = formatDateStr(now);
    switch (period) {
      case "today":
        return { startDate: today, endDate: today };
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const ys = formatDateStr(y);
        return { startDate: ys, endDate: ys };
      }
      case "week": {
        const mon = getMonday(now);
        return { startDate: formatDateStr(mon), endDate: today };
      }
      case "month": {
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: formatDateStr(ms), endDate: today };
      }
      case "custom": {
        const s = customStart || today;
        const e = customEnd || today;
        return s <= e ? { startDate: s, endDate: e } : { startDate: e, endDate: s };
      }
    }
  }, [period, customStart, customEnd]);

  const fetchData = async () => {
    if (!riderId) return;
    setLoading(true);
    try {
      const filterStart = new Date(startDate + "T00:00:00");
      const filterEnd = new Date(endDate + "T00:00:00");
      // expand fetch range to include full week boundaries (for weekly commission calc)
      const weekStart = getMonday(filterStart);
      const lastMonday = getMonday(filterEnd);
      const weekEnd = getSunday(lastMonday);
      const txStartStr = formatDateStr(weekStart);
      const txEndStr = formatDateStr(weekEnd);

      const fetchAll = async (query: any) => {
        const all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await query.range(from, from + 999);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return all;
      };

      const txQ = supabase
        .from("transactions")
        .select("rider_id, final_amount, transaction_date")
        .eq("status", "completed")
        .eq("is_voided", false)
        .eq("rider_id", riderId)
        .gte("transaction_date", `${txStartStr}T00:00:00+07:00`)
        .lte("transaction_date", `${txEndStr}T23:59:59+07:00`);

      const wasteQ = supabase
        .from("product_waste")
        .select("rider_id, total_waste, created_at")
        .eq("rider_id", riderId)
        .gte("created_at", `${startDate}T00:00:00+07:00`)
        .lte("created_at", `${endDate}T23:59:59+07:00`);

      const [tx, waste] = await Promise.all([fetchAll(txQ), fetchAll(wasteQ)]);
      setTransactionData(tx);
      setWasteData(waste);

      // Try to fetch kasbon value from rider_kasbon table if exists (silent fail)
      try {
        const { data: kasbon } = await supabase
          .from("rider_kasbon" as any)
          .select("amount")
          .eq("rider_id", riderId)
          .gte("kasbon_date", startDate)
          .lte("kasbon_date", endDate);
        if (kasbon) {
          const total = (kasbon as any[]).reduce((s, k) => s + Number(k.amount || 0), 0);
          setKasbonValue(total);
        }
      } catch {
        setKasbonValue(0);
      }
    } catch (err: any) {
      toast.error("Gagal memuat data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId, startDate, endDate]);

  // Realtime subscription for transactions
  useEffect(() => {
    if (!riderId) return;
    const channel = supabase
      .channel(`rider-income-${riderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `rider_id=eq.${riderId}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_waste", filter: `rider_id=eq.${riderId}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId, startDate, endDate]);

  const { detailRows, totalSales, totalDailyCommission, totalSalesCommission, totalWaste, totalIncome, currentWeeklySales, daysWorkedThisWeek, todaySales, weeklySales, monthlySales } = useMemo(() => {
    // Per-date sales
    const dailySales = new Map<string, number>();
    const weeklyRevenue = new Map<string, number>();

    transactionData.forEach((tx) => {
      const date = tx.transaction_date.split("T")[0];
      const amount = Number(tx.final_amount || 0);
      dailySales.set(date, (dailySales.get(date) || 0) + amount);
      const wk = getWeekKey(date);
      weeklyRevenue.set(wk, (weeklyRevenue.get(wk) || 0) + amount);
    });

    const wasteByDate = new Map<string, number>();
    wasteData.forEach((w) => {
      const date = w.created_at.split("T")[0];
      wasteByDate.set(date, (wasteByDate.get(date) || 0) + Number(w.total_waste || 0));
    });

    // dates in range
    const dates: string[] = [];
    const d = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (d <= end) {
      dates.push(formatDateStr(d));
      d.setDate(d.getDate() + 1);
    }

    // sales commission per last day in range of each week
    const salesCommissionDay = new Map<string, number>();
    weeklyRevenue.forEach((revenue, weekMonday) => {
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
      if (lastDayInRange && totalCommission > 0) {
        salesCommissionDay.set(lastDayInRange, (salesCommissionDay.get(lastDayInRange) || 0) + totalCommission);
      }
    });

    const rows: DetailRow[] = [];
    let tSales = 0, tDaily = 0, tSalesComm = 0, tWaste = 0;

    dates.forEach((date) => {
      const ds = dailySales.get(date) || 0;
      const daily = ds > 0 ? DAILY_COMMISSION : 0;
      const sc = salesCommissionDay.get(date) || 0;
      const w = wasteByDate.get(date) || 0;
      const total = daily + sc - w;
      if (ds > 0 || sc > 0 || w > 0) {
        rows.push({ date, dayName: getDayName(date), sales: ds, dailyCommission: daily, salesCommission: sc, waste: w, total });
        tSales += ds; tDaily += daily; tSalesComm += sc; tWaste += w;
      }
    });

    rows.sort((a, b) => (a.date > b.date ? -1 : 1));

    // current week stats
    const jakartaNow = getJakartaNow();
    const todayStr = formatDateStr(jakartaNow);
    const currentWeekMon = formatDateStr(getMonday(jakartaNow));
    const currentMonthStart = formatDateStr(new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 1));

    let todayS = 0, weekS = 0, monthS = 0, daysWorked = 0;
    dailySales.forEach((amt, date) => {
      if (date === todayStr) todayS += amt;
      if (date >= currentWeekMon) {
        weekS += amt;
        if (amt > 0) daysWorked++;
      }
      if (date >= currentMonthStart) monthS += amt;
    });
    const weeklyRev = weeklyRevenue.get(currentWeekMon) || 0;
    const finalWeekly = Math.max(weekS, weeklyRev);

    return {
      detailRows: rows,
      totalSales: tSales,
      totalDailyCommission: tDaily,
      totalSalesCommission: tSalesComm,
      totalWaste: tWaste,
      totalIncome: tDaily + tSalesComm - tWaste - kasbonValue,
      currentWeeklySales: finalWeekly,
      daysWorkedThisWeek: daysWorked,
      todaySales: todayS,
      weeklySales: finalWeekly,
      monthlySales: monthS,
    };
  }, [transactionData, wasteData, startDate, endDate, kasbonValue]);

  const currentRate = getCommissionRate(currentWeeklySales);
  const nextTier = getNextTier(currentWeeklySales);
  const currentTierMin = COMMISSION_TIERS.slice().reverse().find(t => currentWeeklySales >= t.min)?.min || 0;
  const progressToNext = nextTier
    ? Math.min(((currentWeeklySales - currentTierMin) / (nextTier.nextMin - currentTierMin)) * 100, 100)
    : 100;

  const weeklyCommissionEst = currentWeeklySales * currentRate;
  const weeklyAttendanceEst = daysWorkedThisWeek * DAILY_COMMISSION;
  const estWeeklyIncome = weeklyCommissionEst + weeklyAttendanceEst;
  const estMonthlyIncome = estWeeklyIncome * 4;

  const targets = [
    { label: "Harian", current: todaySales, target: DAILY_TARGET, icon: Target },
    { label: "Mingguan", current: weeklySales, target: WEEKLY_TARGET, icon: Calendar },
    { label: "Bulanan", current: monthlySales, target: MONTHLY_TARGET, icon: TrendingUp },
  ];

  return (
    <div className="p-3 space-y-4 bg-gradient-to-br from-white via-red-50/30 to-white min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-bold text-gray-900">Pendapatan Saya</h2>
        </div>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Period Filter */}
      <div className="grid grid-cols-5 gap-1.5">
        {([
          { v: "today", l: "Hari Ini" },
          { v: "yesterday", l: "Kemarin" },
          { v: "week", l: "Minggu" },
          { v: "month", l: "Bulan" },
          { v: "custom", l: "Custom" },
        ] as { v: Period; l: string }[]).map((p) => (
          <Button
            key={p.v}
            size="sm"
            variant={period === p.v ? "default" : "outline"}
            onClick={() => setPeriod(p.v)}
            className={`h-9 text-xs ${period === p.v ? "bg-red-600 hover:bg-red-700" : ""}`}
          >
            {p.l}
          </Button>
        ))}
      </div>

      {period === "custom" && (
        <Card>
          <CardContent className="p-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dari Tanggal</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sampai Tanggal</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Income Hero */}
      <Card className="bg-gradient-to-br from-red-600 to-red-700 text-white border-0 shadow-lg">
        <CardContent className="p-4">
          <p className="text-xs opacity-90">Total Pendapatan Periode Ini</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalIncome)}</p>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="bg-white/15 rounded-lg p-2">
              <p className="opacity-80">Penjualan</p>
              <p className="font-semibold">{formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-white/15 rounded-lg p-2">
              <p className="opacity-80">Komisi Total</p>
              <p className="font-semibold">{formatCurrency(totalDailyCommission + totalSalesCommission)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rincian Pendapatan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Komisi Harian (Kehadiran)</span>
            <span className="font-medium text-green-600">+ {formatCurrency(totalDailyCommission)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Komisi Penjualan</span>
            <span className="font-medium text-green-600">+ {formatCurrency(totalSalesCommission)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Waste</span>
            <span className="font-medium text-red-600">- {formatCurrency(totalWaste)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kasbon</span>
            <span className="font-medium text-red-600">- {formatCurrency(kasbonValue)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-bold">Total</span>
            <span className="font-bold text-lg text-red-600">{formatCurrency(totalIncome)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Tier Komisi */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" /> Tier Komisi Mingguan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Penjualan Minggu Ini</p>
              <p className="text-base font-bold">{formatCurrency(currentWeeklySales)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Rate</p>
              <p className="text-2xl font-bold text-red-600">{(currentRate * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimasi Komisi Mingguan</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(weeklyCommissionEst)}</p>
          </div>
          {currentWeeklySales < 1000000 && (
            <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
              ⚠️ Belum mencapai Rp 1.000.000 — belum dapat komisi penjualan
            </div>
          )}
          {nextTier && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Menuju {(nextTier.nextRate * 100).toFixed(1)}%</span>
                <span className="font-medium">{formatCurrency(nextTier.nextMin - currentWeeklySales)} lagi</span>
              </div>
              <Progress value={progressToNext} className="h-2" />
            </div>
          )}
          {!nextTier && currentWeeklySales >= 6000000 && (
            <div className="rounded-lg bg-green-500/10 p-2 text-xs text-green-700">
              🏆 Tier tertinggi tercapai!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Penjualan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-red-600" /> Target Penjualan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {targets.map(({ label, current, target, icon: Icon }) => {
            const pct = Math.min(Math.round((current / target) * 100), 100);
            const achieved = current >= target;
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{label}</span>
                  </div>
                  <span className={`font-bold ${achieved ? "text-green-600" : ""}`}>{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{formatCurrency(current)}</span>
                  <span>{formatCurrency(target)}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Proyeksi Pendapatan */}
      <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" /> Proyeksi Pendapatan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Estimasi Minggu Ini</p>
              <p className="text-base font-bold">{formatCurrency(estWeeklyIncome)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Komisi: {formatCurrencyShort(weeklyCommissionEst)}</p>
              <p className="text-[10px] text-muted-foreground">Hadir: {formatCurrencyShort(weeklyAttendanceEst)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Estimasi Bulanan</p>
              <p className="text-base font-bold">{formatCurrency(estMonthlyIncome)}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <ArrowUpRight className="h-3 w-3" /> Performa saat ini
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Harian */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-red-600" /> Detail Harian
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {detailRows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Belum ada data pendapatan untuk periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tanggal</TableHead>
                    <TableHead className="text-xs text-right">Sales</TableHead>
                    <TableHead className="text-xs text-right">Hadir</TableHead>
                    <TableHead className="text-xs text-right">Komisi</TableHead>
                    <TableHead className="text-xs text-right">Waste</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="text-xs py-2">
                        <div className="font-medium">{formatDateDisplay(r.date)}</div>
                        <div className="text-[10px] text-muted-foreground">{r.dayName}</div>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrencyShort(r.sales)}</TableCell>
                      <TableCell className="text-xs py-2 text-right text-green-600">{formatCurrencyShort(r.dailyCommission)}</TableCell>
                      <TableCell className="text-xs py-2 text-right text-green-600">{formatCurrencyShort(r.salesCommission)}</TableCell>
                      <TableCell className="text-xs py-2 text-right text-red-600">{r.waste > 0 ? `-${formatCurrencyShort(r.waste)}` : "0"}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-bold">{formatCurrencyShort(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier Reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tabel Tier Komisi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Penjualan Mingguan</TableHead>
                <TableHead className="text-xs text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className={currentWeeklySales < 1000000 ? "bg-destructive/5" : ""}>
                <TableCell className="text-xs py-1.5">&lt; Rp 1.000.000</TableCell>
                <TableCell className="text-xs py-1.5 text-right text-destructive font-medium">0%</TableCell>
              </TableRow>
              {[...COMMISSION_TIERS].reverse().map((tier, idx, arr) => {
                const nextT = arr[idx + 1];
                const isActive = currentWeeklySales >= tier.min && (!nextT || currentWeeklySales < nextT.min);
                return (
                  <TableRow key={tier.min} className={isActive ? "bg-primary/10 font-bold" : ""}>
                    <TableCell className="text-xs py-1.5">
                      {nextT
                        ? `${formatCurrencyShort(tier.min)} – ${formatCurrencyShort(nextT.min - 1)}`
                        : `≥ ${formatCurrencyShort(tier.min)}`}
                      {isActive && <span className="ml-1 text-red-600">←</span>}
                    </TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-medium">{(tier.rate * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[10px] text-center text-muted-foreground pb-4">
        💡 Data update real-time. Kasbon dipotong jika tercatat di sistem.
      </p>
    </div>
  );
};

export default MobileRiderIncome;