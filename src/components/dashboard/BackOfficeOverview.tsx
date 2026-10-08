import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { TrendingUp, Receipt, Wallet, CalendarClock, AlertTriangle } from "lucide-react";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "jt" : n >= 1e3 ? (n / 1e3).toFixed(0) + "rb" : String(Math.round(n)));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jakartaNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
const PIE = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--primary-dark))", "hsl(var(--primary-light))"];

const fetchAll = async (build: () => any) => {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
};

interface Props { startDate: string; endDate: string; branchId: string; refreshKey?: number }

export const BackOfficeOverview = ({ startDate, endDate, branchId, refreshKey = 0 }: Props) => {
  const { userProfile } = useAuth();
  const role = userProfile?.role || "";
  const isHO = ["ho_admin", "ho_owner", "ho_staff", "1_HO_Admin", "1_HO_Owner", "1_HO_Staff", "finance"].includes(role);
  const lockedBranch = !isHO ? userProfile?.branch_id || null : null;
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const effectiveBranch = lockedBranch || (branchId === "all" ? null : branchId);
  const range = useMemo(() => ({ start: startDate, end: endDate }), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [txRows, poRes] = await Promise.all([
          fetchAll(() => {
            let q = supabase
              .from("transactions")
              .select("final_amount, payment_method, transaction_date")
              .eq("status", "completed")
              .eq("is_voided", false)
              .gte("transaction_date", `${range.start}T00:00:00+07:00`)
              .lte("transaction_date", `${range.end}T23:59:59+07:00`)
              .order("transaction_date");
            if (effectiveBranch) q = q.eq("branch_id", effectiveBranch);
            return q;
          }),
          (() => {
            let q = supabase
              .from("purchase_orders")
              .select("id, po_number, invoice_number, due_date, total_amount, paid_amount, status, suppliers(name), branches(name)")
              .not("due_date", "is", null)
              .order("due_date")
              .limit(200);
            if (effectiveBranch) q = q.eq("branch_id", effectiveBranch);
            return q;
          })(),
        ]);
        if (cancelled) return;
        setTx(txRows);
        setPos((poRes.data || []).filter((p: any) => Number(p.total_amount) - Number(p.paid_amount || 0) > 0));
      } catch (e) {
        console.error("Overview load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range, effectiveBranch, refreshKey]);

  const daily = useMemo(() => {
    const m = new Map<string, number>();
    const s = new Date(range.start + "T00:00:00"), e = new Date(range.end + "T00:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) m.set(ymd(d), 0);
    tx.forEach((t) => {
      const k = ymd(new Date(new Date(t.transaction_date).toLocaleString("en-US", { timeZone: "Asia/Jakarta" })));
      m.set(k, (m.get(k) || 0) + Number(t.final_amount || 0));
    });
    return Array.from(m, ([date, sales]) => ({ date: date.slice(8) + "/" + date.slice(5, 7), sales }));
  }, [tx, range]);

  const total = tx.reduce((s, t) => s + Number(t.final_amount || 0), 0);
  const pay = useMemo(() => {
    const m: Record<string, number> = {};
    tx.forEach((t) => {
      let k = (t.payment_method || "lainnya").toLowerCase();
      if (k === "bank_transfer" || k === "bank") k = "transfer";
      m[k] = (m[k] || 0) + Number(t.final_amount || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [tx]);

  const today = ymd(jakartaNow());
  const remaining = (p: any) => Number(p.total_amount) - Number(p.paid_amount || 0);
  const overdue = pos.filter((p) => p.due_date < today);
  const in7 = new Date(jakartaNow()); in7.setDate(in7.getDate() + 7);
  const dueSoon = pos.filter((p) => p.due_date >= today && p.due_date <= ymd(in7));
  const totalDebt = pos.reduce((s, p) => s + remaining(p), 0);

  // 4-week cash flow plan: projected inflow (avg daily sales x 7) vs scheduled supplier payments
  const avgDaily = daily.length ? total / daily.length : 0;
  const plan = useMemo(() => {
    const base = jakartaNow();
    return [0, 1, 2, 3].map((w) => {
      const s = new Date(base); s.setDate(base.getDate() + w * 7);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      const out = pos
        .filter((p) => (w === 0 ? p.due_date <= ymd(e) : p.due_date >= ymd(s) && p.due_date <= ymd(e)))
        .reduce((a, p) => a + remaining(p), 0);
      return { week: `Mgg ${w + 1}`, label: `${ymd(s).slice(5)} – ${ymd(e).slice(5)}`, masuk: avgDaily * 7, keluar: out, net: avgDaily * 7 - out };
    });
  }, [pos, avgDaily]);

  const kpis = [
    { label: "Total Penjualan", value: rp(total), icon: TrendingUp },
    { label: "Transaksi", value: tx.length.toLocaleString("id-ID"), icon: Receipt },
    { label: "Rata-rata / Struk", value: rp(tx.length ? total / tx.length : 0), icon: Wallet },
    { label: "Hutang Supplier", value: rp(totalDebt), icon: CalendarClock, warn: overdue.length > 0 },
  ];

  return (
    <section className="space-y-5 bo-fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bo-card bo-card-hover p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</span>
              <span className={`h-9 w-9 rounded-xl grid place-items-center ${k.warn ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><k.icon className="h-4 w-4" /></span>
            </div>
            {loading ? <Skeleton className="h-7 w-32" /> : <div className="text-xl md:text-2xl font-bold text-foreground">{k.value}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bo-card bo-card-hover p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Grafik Penjualan Harian</h3>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={daily}>
                <defs><linearGradient id="boSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v: number) => rp(v)} />
                <Area type="monotone" dataKey="sales" name="Penjualan" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#boSales)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bo-card bo-card-hover p-5">
          <h3 className="font-semibold">Metode Pembayaran</h3>
          <p className="text-xs text-muted-foreground mb-2">Porsi omset per metode</p>
          {loading ? <Skeleton className="h-64 w-full" /> : pay.length === 0 ? <p className="text-sm text-muted-foreground py-20 text-center">Belum ada transaksi</p> : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <defs>{PIE.map((c, i) => <linearGradient key={i} id={`boPie${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c} stopOpacity={1} /><stop offset="1" stopColor={c} stopOpacity={0.7} /></linearGradient>)}</defs>
                    <Pie data={pay} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={4} cornerRadius={8} stroke="none">
                      {pay.map((_, i) => <Cell key={i} fill={`url(#boPie${i % PIE.length})`} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => rp(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div><div className="text-base font-bold">{short(total)}</div></div>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {pay.sort((a, b) => b.value - a.value).map((p, i) => {
                  const pct = total ? (p.value / total) * 100 : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />{p.name}</span>
                        <span className="text-muted-foreground">{rp(p.value)} · <b className="text-foreground">{pct.toFixed(0)}%</b></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE[i % PIE.length] }} /></div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="bo-card bo-card-hover p-5 lg:col-span-2">
          <h3 className="font-semibold">Perencanaan Cash Flow (4 minggu)</h3>
          <p className="text-xs text-muted-foreground mb-4">Estimasi masuk = rata-rata penjualan harian × 7; keluar = invoice supplier jatuh tempo</p>
          {loading ? <Skeleton className="h-56 w-full" /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={plan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={(v: number) => rp(v)} />
                  <Bar dataKey="masuk" name="Masuk" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="keluar" name="Keluar" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-3">
                <thead><tr className="text-muted-foreground"><th className="text-left py-1">Minggu</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th><th className="text-right">Net</th></tr></thead>
                <tbody>{plan.map((p) => (
                  <tr key={p.week} className="border-t border-border"><td className="py-1.5">{p.week} <span className="text-muted-foreground">({p.label})</span></td><td className="text-right">{short(p.masuk)}</td><td className="text-right">{short(p.keluar)}</td><td className={`text-right font-semibold ${p.net < 0 ? "text-destructive" : "text-success"}`}>{short(p.net)}</td></tr>
                ))}</tbody>
              </table>
            </>
          )}
        </div>
        <div className="bo-card bo-card-hover p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Jatuh Tempo Invoice Supplier</h3>
            <div className="flex gap-2 text-xs">
              {overdue.length > 0 && <Badge variant="destructive" className="rounded-full"><AlertTriangle className="h-3 w-3 mr-1" />{overdue.length} lewat tempo</Badge>}
              <Badge variant="secondary" className="rounded-full">{dueSoon.length} ≤ 7 hari</Badge>
            </div>
          </div>
          {loading ? <Skeleton className="h-56 w-full" /> : pos.length === 0 ? <p className="text-sm text-muted-foreground py-16 text-center">Tidak ada hutang supplier yang belum lunas</p> : (
            <div className="overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card"><tr className="text-xs text-muted-foreground text-left"><th className="py-2">Supplier</th><th>PO / Invoice</th><th>Cabang</th><th>Jatuh Tempo</th><th className="text-right">Sisa</th></tr></thead>
                <tbody>{pos.slice(0, 50).map((p) => {
                  const days = Math.round((new Date(p.due_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                      <td className="py-2 font-medium">{p.suppliers?.name || "-"}</td>
                      <td className="text-xs">{p.po_number}<div className="text-muted-foreground">{p.invoice_number || ""}</div></td>
                      <td className="text-xs">{p.branches?.name || "-"}</td>
                      <td className="text-xs">{p.due_date}<div><Badge variant={days < 0 ? "destructive" : "secondary"} className="rounded-full text-[10px]">{days < 0 ? `lewat ${-days} hr` : days === 0 ? "hari ini" : `${days} hr lagi`}</Badge></div></td>
                      <td className="text-right font-semibold">{rp(remaining(p))}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
