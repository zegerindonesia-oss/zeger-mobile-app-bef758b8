import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Filter, Trophy, TrendingUp, Users, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const DAILY_COMMISSION = 30000;

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
  { min: 1500000, rate: 0.10 },
  { min: 1000000, rate: 0.07 },
];

const getCommissionRate = (weeklyRevenue: number): number => {
  for (const tier of COMMISSION_TIERS) {
    if (weeklyRevenue >= tier.min) return tier.rate;
  }
  return 0;
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
  total: number;
};

const RiderIncome = () => {
  const { userProfile } = useAuth();
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [selectedRider, setSelectedRider] = useState("all");
  const [loading, setLoading] = useState(false);

  const now = getJakartaNow();
  const todayStr = formatDateStr(now);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [transactionData, setTransactionData] = useState<any[]>([]);
  const [wasteData, setWasteData] = useState<any[]>([]);

  const branchId = userProfile?.branch_id;

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
      } catch (err: any) {
        toast.error("Gagal memuat data: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedRider, branchId]);

  const { resumeData, detailData } = useMemo(() => {
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

    // For each rider+week, determine which date in the filter range is the "last day" of that week
    // Sales commission lump sum goes on that day only
    const salesCommissionDay = new Map<string, Map<string, number>>(); // riderId -> date -> commission

    riderIds.forEach((riderId) => {
      const riderWeeks = weeklyRevenue.get(riderId);
      if (!riderWeeks) return;

      riderWeeks.forEach((revenue, weekMonday) => {
        const rate = getCommissionRate(revenue);
        const totalCommission = revenue * rate;

        // Find the last day of this week (Sun) that falls within filter range
        const monday = new Date(weekMonday + "T00:00:00");
        const sunday = getSunday(monday);

        // Last day of this week within filter range
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
      .map(([riderId, agg]) => ({
        riderId,
        ...agg,
        total: agg.dailyCommission + agg.salesCommission - agg.waste,
      }))
      .filter((r) => r.sales > 0 || r.salesCommission > 0 || r.waste > 0)
      .sort((a, b) => b.total - a.total);

    details.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : b.total - a.total));

    return { resumeData: resume, detailData: details };
  }, [transactionData, wasteData, riders, startDate, endDate, selectedRider]);

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

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 14;
    const marginR = 14;
    const contentW = pageW - marginL - marginR;
    let y = 16;

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Pendapatan Rider Zeger Coffee", pageW / 2, y, { align: "center" });
    y += 7;

    // Subtitle with period
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const riderName = selectedRider !== "all" ? riders.find(r => r.id === selectedRider)?.full_name : null;
    const periodText = `Periode ${formatDateLong(startDate)} s/d ${formatDateLong(endDate)}`;
    doc.text(riderName ? `${periodText} — Rider: ${riderName}` : periodText, pageW / 2, y, { align: "center" });
    y += 10;

    // Helper to draw a table
    const drawTable = (
      title: string,
      headers: string[],
      colWidths: number[],
      rows: string[][],
      startY: number
    ): number => {
      let cy = startY;

      // Section title
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title, marginL, cy);
      cy += 6;

      const rowH = 6;
      const headerH = 7;

      // Header
      doc.setFillColor(59, 130, 246);
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

      // Rows
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
          doc.setFillColor(245, 245, 245);
          doc.rect(marginL, cy, contentW, rowH, "F");
        }
        if (isTotal) {
          doc.setFillColor(220, 220, 220);
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
    const resumeHeaders = ["No", "Nama Rider", "Sales", "Komisi Harian", "Komisi Penjualan", "Waste (-)", "Total Pendapatan"];
    const resumeColWidths = [10, 50, 38, 38, 38, 38, 47];
    const resumeRows = resumeData.map((r, i) => [
      String(i + 1),
      r.riderName,
      formatCurrencyShort(r.sales),
      formatCurrencyShort(r.dailyCommission),
      formatCurrencyShort(r.salesCommission),
      formatCurrencyShort(r.waste),
      formatCurrencyShort(r.total),
    ]);
    resumeRows.push([
      "TOTAL", "",
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.sales, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.dailyCommission, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.salesCommission, 0)),
      formatCurrencyShort(resumeData.reduce((s, r) => s + r.waste, 0)),
      formatCurrencyShort(totalAll),
    ]);

    y = drawTable("Resume Pendapatan Rider", resumeHeaders, resumeColWidths, resumeRows, y);
    y += 4;

    // Detail Table
    const detailHeaders = ["Tanggal", "Hari", "Nama Rider", "Sales", "Komisi Harian", "Komisi Penjualan", "Waste (-)", "Total"];
    const detailColWidths = [28, 22, 45, 35, 35, 35, 35, 38];
    const detailRows = detailData.map((r) => [
      formatDateDisplay(r.date),
      r.dayName,
      r.riderName,
      formatCurrencyShort(r.sales),
      formatCurrencyShort(r.dailyCommission),
      formatCurrencyShort(r.salesCommission),
      formatCurrencyShort(r.waste),
      formatCurrencyShort(r.total),
    ]);

    if (y + 20 > pageH - 12) {
      doc.addPage();
      y = 14;
    }

    drawTable("Detail Pendapatan Rider", detailHeaders, detailColWidths, detailRows, y);

    const fileName = `Pendapatan_Rider_${startDate}_${endDate}.pdf`;
    doc.save(fileName);
    toast.success("PDF berhasil diexport!");
  }, [resumeData, detailData, startDate, endDate, selectedRider, riders, totalAll]);

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
                    <TableCell className="text-right font-bold">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(resumeData.reduce((s, r) => s + r.sales, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(resumeData.reduce((s, r) => s + r.dailyCommission, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(resumeData.reduce((s, r) => s + r.salesCommission, 0))}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(resumeData.reduce((s, r) => s + r.waste, 0))}</TableCell>
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
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RiderIncome;
