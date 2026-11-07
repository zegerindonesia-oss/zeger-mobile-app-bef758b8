import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Loader2, MessageCircle } from "lucide-react";
import { POSSalesAnalytics } from "@/components/pos/POSSalesAnalytics";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString("id-ID")}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-");
const HO = ["ho_admin", "ho_owner", "ho_staff", "1_HO_Admin", "1_HO_Owner", "1_HO_Staff", "finance"];
const MODE: Record<string, string> = { take_away: "Take Away", dine_in: "Dine In", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", delivery: "Delivery", pickup: "Pick Up" };

type Table = { head: string[]; rows: (string | number)[][] };

const pageAll = async (build: (a: number, b: number) => any) => {
  const out: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await build(i, i + 999);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

export default function POSBackOfficeReports() {
  const { userProfile } = useAuth();
  const isHO = HO.includes(userProfile?.role || "");
  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branch, setBranch] = useState("all");
  const [tab, setTab] = useState("grafik");
  const [loading, setLoading] = useState(false);
  const [rawTxs, setTxs] = useState<any[]>([]);
  const [rawItems, setItems] = useState<any[]>([]);
  const [brandF, setBrandF] = useState("all");
  const [shifts, setShifts] = useState<any[]>([]);
  const [cash, setCash] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [brandOf, setBrandOf] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    supabase.from("branches").select("id,name").order("name").then(({ data }) => setBranches(data || []));
    supabase.from("products").select("id,brand").then(({ data }) => setBrandOf(new Map((data || []).map((p: any) => [p.id, p.brand || "Tanpa Brand"]))));
  }, []);
  useEffect(() => { if (!isHO && userProfile?.branch_id) setBranch(userProfile.branch_id); }, [isHO, userProfile?.branch_id]);

  const bId = branch === "all" ? null : branch;
  const bName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      const db = supabase as any;
      const a = `${from}T00:00:00+07:00`, b = `${to}T23:59:59+07:00`;
      const scope = (q: any) => (bId ? q.eq("branch_id", bId) : q);
      const [t, s, c, tb] = await Promise.all([
        pageAll((x, y) => scope(db.from("pos_transactions").select("id,branch_id,transaction_number,created_at,customer_name,cashier_name,status,order_type,payment_method_1,amount_1,payment_method_2,amount_2,change_amount,subtotal,discount_item,discount_bill,service_charge,tax,total,void_at").gte("created_at", a).lte("created_at", b).order("created_at", { ascending: false })).range(x, y)),
        pageAll((x, y) => scope(db.from("pos_shifts").select("*").gte("opened_at", a).lte("opened_at", b).order("opened_at", { ascending: false })).range(x, y)),
        pageAll((x, y) => scope(db.from("pos_cash_movements").select("*").gte("created_at", a).lte("created_at", b).order("created_at", { ascending: false })).range(x, y)),
        scope(db.from("pos_tables").select("id,branch_id,table_number,status,guest_name,occupied_at,current_total,open_bill").neq("status", "available")).then((r: any) => r.data || []),
      ]);
      const ids = t.filter((r: any) => r.status === "paid" && !r.void_at).map((r: any) => r.id);
      let its: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db.from("pos_transaction_items").select("transaction_id,product_id,product_name,category,qty,price,subtotal_item,notes").in("transaction_id", ids.slice(i, i + 200));
        its = its.concat(data || []);
      }
      if (off) return;
      setTxs(t); setShifts(s); setCash(c); setTables(tb.filter((x: any) => x.open_bill || x.status === "occupied")); setItems(its); setLoading(false);
    })();
    return () => { off = true; };
  }, [from, to, bId]);

  const brandList = useMemo(() => [...new Set(rawItems.map((i) => brandOf.get(i.product_id) || "Tanpa Brand"))].sort(), [rawItems, brandOf]);
  const items = useMemo(() => (brandF === "all" ? rawItems : rawItems.filter((i) => (brandOf.get(i.product_id) || "Tanpa Brand") === brandF)), [rawItems, brandF, brandOf]);
  const txs = useMemo(() => {
    if (brandF === "all") return rawTxs;
    // Per-brand view: transaction totals become that brand's item subtotal.
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.transaction_id, (m.get(i.transaction_id) || 0) + Number(i.subtotal_item || 0)));
    return rawTxs.filter((t) => m.has(t.id)).map((t) => ({ ...t, subtotal: m.get(t.id), total: m.get(t.id), discount_item: 0, discount_bill: 0, service_charge: 0, tax: 0, amount_1: t.payment_method_2 ? t.amount_1 : m.get(t.id), change_amount: 0 }));
  }, [rawTxs, items, brandF]);
  const paid = txs.filter((t) => t.status === "paid" && !t.void_at);
  const voids = txs.filter((t) => t.void_at || t.status === "void" || t.status === "voided");
  const sum = (k: string) => paid.reduce((s, t) => s + Number(t[k] || 0), 0);
  const gross = sum("subtotal"), disc = sum("discount_item") + sum("discount_bill"), net = sum("total");
  const qty = items.reduce((s, i) => s + Number(i.qty || 0), 0);

  const group = (rows: any[], key: (r: any) => string, val: (r: any) => number, q?: (r: any) => number) => {
    const m: Record<string, { n: number; v: number }> = {};
    rows.forEach((r) => { const k = key(r); m[k] ??= { n: 0, v: 0 }; m[k].n += q ? q(r) : 1; m[k].v += val(r); });
    return Object.entries(m).sort((x, y) => y[1].v - x[1].v);
  };
  const pct = (v: number, tot: number) => (tot ? ((v / tot) * 100).toFixed(1) + "%" : "0%");

  const tablesData: Record<string, { title: string } & Table> = useMemo(() => {
    const payRows: any[] = [];
    paid.forEach((t) => {
      payRows.push({ m: t.payment_method_1 || "lainnya", v: Number(t.amount_1 || t.total || 0) - (String(t.payment_method_1).toLowerCase().includes("cash") || t.payment_method_1 === "tunai" ? Number(t.change_amount || 0) : 0) });
      if (t.payment_method_2) payRows.push({ m: t.payment_method_2, v: Number(t.amount_2 || 0) });
    });
    const payTot = payRows.reduce((s, r) => s + r.v, 0);
    const menuG = group(items, (i) => i.product_name || "Item", (i) => Number(i.subtotal_item || 0), (i) => Number(i.qty || 0));
    const brandG = group(items, (i) => brandOf.get(i.product_id) || "Tanpa Brand", (i) => Number(i.subtotal_item || 0), (i) => Number(i.qty || 0));
    const itemTot = items.reduce((s, i) => s + Number(i.subtotal_item || 0), 0);
    const branchG = group(paid, (t) => bName.get(t.branch_id) || "-", (t) => Number(t.total || 0));
    const modeG = group(paid, (t) => MODE[t.order_type] || t.order_type || "-", (t) => Number(t.total || 0));
    const cat = new Map(items.map((i) => [i.product_name, i.category]));
    return {
      rekap: { title: "Rekapitulasi Penjualan", head: ["Keterangan", "Nilai"], rows: [
        ["Penjualan Kotor", rp(gross)], ["Diskon", "-" + rp(disc)], ["Service Charge", rp(sum("service_charge"))], ["Pajak", rp(sum("tax"))], ["Penjualan Bersih", rp(net)],
        ["Jumlah Transaksi", paid.length], ["Rata-rata / Transaksi", rp(paid.length ? net / paid.length : 0)], ["Item Terjual", qty], ["Void / Batal", voids.length],
        ...branchG.map(([k, v]) => [`Cabang: ${k}`, `${rp(v.v)} (${pct(v.v, net)})`]),
        ...modeG.map(([k, v]) => [`Mode: ${k}`, `${v.n} trx · ${rp(v.v)}`]),
      ] },
      rincian: { title: "Rincian Penjualan", head: ["No. Struk", "Waktu", "Cabang", "Kasir", "Pelanggan", "Mode", "Bayar", "Total", "Status"], rows: txs.map((t) => [
        t.transaction_number, dt(t.created_at), bName.get(t.branch_id) || "-", t.cashier_name || "-", t.customer_name || "-", MODE[t.order_type] || t.order_type || "-",
        [t.payment_method_1, t.payment_method_2].filter(Boolean).join(" + ").toUpperCase(), rp(t.total), t.void_at ? "VOID" : t.status]) },
      bayar: { title: "Data Pembayaran", head: ["Metode", "Jumlah", "Nominal", "%"], rows: group(payRows, (r) => String(r.m).toUpperCase(), (r) => r.v).map(([k, v]) => [k, v.n, rp(v.v), pct(v.v, payTot)]) },
      menu: { title: "Penjualan per Menu", head: ["Menu", "Kategori", "Brand", "Qty", "Omzet", "%"], rows: menuG.map(([k, v]) => [k, cat.get(k) || "-", brandOf.get(items.find((i) => i.product_name === k)?.product_id) || "-", v.n, rp(v.v), pct(v.v, itemTot)]) },
      brand: { title: "Penjualan per Brand", head: ["Brand", "Qty", "Omzet", "%"], rows: brandG.map(([k, v]) => [k, v.n, rp(v.v), pct(v.v, itemTot)]) },
      brandmenu: { title: "Rincian Menu per Brand", head: ["Brand", "Menu", "Kategori", "Qty", "Omzet", "% Brand"], rows: brandG.flatMap(([b, bv]) => [
        ...group(items.filter((i) => (brandOf.get(i.product_id) || "Tanpa Brand") === b), (i) => i.product_name || "Item", (i) => Number(i.subtotal_item || 0), (i) => Number(i.qty || 0))
          .map(([k, v]) => [b, k, cat.get(k) || "-", v.n, rp(v.v), pct(v.v, bv.v)]),
        [`TOTAL ${b}`, "", "", bv.n, rp(bv.v), "100%"],
      ]) },
      shift: { title: "Riwayat Shift & Tutup Laci", head: ["Cabang", "Kasir", "Buka", "Tutup", "Modal", "Penjualan", "Kas Masuk", "Kas Keluar", "Seharusnya", "Uang Fisik", "Selisih", "Status"], rows: shifts.map((s) => [
        bName.get(s.branch_id) || "-", s.cashier_name || "-", dt(s.opened_at), dt(s.closed_at), rp(s.opening_cash), rp(s.total_sales), rp(s.total_cash_in), rp(s.total_cash_out), rp(s.expected_cash), s.closing_cash == null ? "-" : rp(s.closing_cash), s.cash_difference == null ? "-" : rp(s.cash_difference), s.status]) },
      kas: { title: "Kas Masuk / Keluar Laci", head: ["Waktu", "Cabang", "Jenis", "Kategori", "Nominal", "Keterangan"], rows: cash.map((c) => [dt(c.created_at), bName.get(c.branch_id) || "-", c.movement_type === "in" || c.movement_type === "cash_in" ? "Masuk" : "Keluar", c.category || "-", rp(c.amount), c.reason || "-"]) },
      titip: { title: "Titip Pesanan / Open Bill", head: ["Cabang", "Meja", "Atas Nama", "Sejak", "Item", "Total"], rows: tables.map((t) => [bName.get(t.branch_id) || "-", t.table_number, t.guest_name || "-", dt(t.occupied_at), (t.open_bill?.items || []).map((i: any) => `${i.qty}x ${i.name || i.product_name}`).join(", ") || "-", rp(t.current_total)]) },
    };
  }, [txs, items, shifts, cash, tables, brandOf, bName]);

  const label = `${bId ? bName.get(bId) : "Semua Cabang"}${brandF !== "all" ? " · Brand " + brandF : ""} · ${from}${from !== to ? " s/d " + to : ""}`;
  const cur = tablesData[tab] || tablesData.rekap;
  const sendWa = () => {
    const r = tablesData.rekap.rows.slice(0, 9).map((x) => `${x[0]}: ${x[1]}`);
    const b = tablesData.brand.rows.map((x) => `- ${x[0]} (${x[1]}): ${x[2]}`);
    const text = [`*Laporan POS*`, label, "", ...r, "", "*Per Brand*", ...b].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    Object.entries(tablesData).forEach(([k, t]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[t.title], [label], [], t.head, ...t.rows]), k));
    XLSX.writeFile(wb, `Laporan-POS-${from}_${to}.xlsx`);
  };
  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: cur.head.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), m = 10, cw = (W - m * 2) / cur.head.length;
    let y = 14;
    pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.text(cur.title, m, y); y += 6;
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.text(label, m, y); y += 7;
    const row = (r: (string | number)[], bold = false) => {
      if (y > H - 12) { pdf.addPage(); y = 14; }
      pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(7.5);
      r.forEach((c, i) => pdf.text(pdf.splitTextToSize(String(c ?? ""), cw - 1)[0] || "", m + i * cw, y));
      y += 5;
    };
    row(cur.head, true); pdf.line(m, y - 3.5, W - m, y - 3.5);
    cur.rows.forEach((r) => row(r));
    pdf.save(`${cur.title}-${from}_${to}.pdf`);
  };

  const TABS: [string, string][] = [["grafik", "Grafik & Analisa"], ["rekap", "Rekap"], ["rincian", "Rincian Penjualan"], ["bayar", "Pembayaran"], ["menu", "Per Menu"], ["brand", "Per Brand"], ["brandmenu", "Rincian Brand & Menu"], ["shift", "Shift & Tutup Laci"], ["kas", "Kas Laci"], ["titip", "Titip / Open Bill"]];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Laporan POS</h1>
        <p className="text-sm text-muted-foreground">Semua laporan kasir dari setiap cabang, bisa diunduh PDF & Excel.</p>
      </div>
      <div className="bo-card p-4 flex flex-wrap gap-2 items-center">
        <Select value={branch} onValueChange={setBranch} disabled={!isHO}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {isHO && <SelectItem value="all">Semua Cabang</SelectItem>}
            {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-muted-foreground text-sm">s/d</span>
        <Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        <Select value={brandF} onValueChange={setBrandF}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Brand</SelectItem>
            {brandList.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={sendWa} disabled={loading}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline" onClick={exportPdf} disabled={loading}><FileText className="h-4 w-4" /> PDF</Button>
          <Button onClick={exportXlsx} disabled={loading}><FileSpreadsheet className="h-4 w-4" /> Excel (semua)</Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto justify-start">
          {TABS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}
        </TabsList>
        {TABS.map(([k]) => (
          <TabsContent key={k} value={k}>
            {k === "grafik" ? (loading ? <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : <POSSalesAnalytics txs={paid} items={items} brandOf={brandOf} from={from} to={to} />) :
            <div className="bo-card p-0 overflow-x-auto">
              {loading ? <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground bg-muted/40">{tablesData[k].head.map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>
                    {tablesData[k].rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-3 whitespace-nowrap">{c}</td>)}</tr>)}
                    {!tablesData[k].rows.length && <tr><td colSpan={tablesData[k].head.length} className="p-8 text-center text-muted-foreground">Belum ada data</td></tr>}
                  </tbody>
                </table>
              )}
            </div>}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
