import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Filter, RefreshCw } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mapExpenseToCategory } from "@/lib/financial-utils";

const db = supabase as any;
const rp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Unit = { key: string; label: string; kind: "branch" | "rider" };
const EXP_LABEL: Record<string, string> = {
  operationalDaily: "Beban Operasional Harian", salary: "Beban Gaji Karyawan", rent: "Beban Sewa",
  household: "Beban Listrik, Air & Rumah Tangga", environment: "Beban Lingkungan / Iuran", marketing: "Beban Marketing",
  administration: "Beban Administrasi", depreciation: "Beban Penyusutan", interest: "Beban Bunga", tax: "Beban Pajak",
  other: "Beban Lain-lain", rawMaterial: "Pembelian Bahan Baku",
};
type PL = { cash: number; qris: number; transfer: number; other: number; cogs: number; mdr: number; exp: Record<string, number> };
const emptyPL = (): PL => ({ cash: 0, qris: 0, transfer: 0, other: 0, cogs: 0, mdr: 0, exp: {} });
const payKey = (m: string) => {
  const s = (m || "").toLowerCase();
  if (s.includes("cash") || s.includes("tunai")) return "cash";
  if (s.includes("qris") || s.includes("gopay") || s.includes("ovo") || s.includes("dana") || s.includes("shopee")) return "qris";
  if (s.includes("transfer") || s.includes("bank") || s.includes("edc") || s.includes("debit")) return "transfer";
  return "other";
};

async function fetchAll(build: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await build(p * 1000, p * 1000 + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function fetchIn(table: string, cols: string, col: string, ids: string[]) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    out.push(...(await fetchAll((a, b) => db.from(table).select(cols).in(col, chunk).range(a, b))));
  }
  return out;
}

export default function UnitProfitLoss() {
  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [units, setUnits] = useState<Unit[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [perUnit, setPerUnit] = useState<Record<string, PL>>({});
  const [unassigned, setUnassigned] = useState<PL>(emptyPL());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: br }, { data: rd }] = await Promise.all([
        db.from("branches").select("id, name, code").eq("is_active", true).order("name"),
        db.from("profiles").select("id, full_name").in("role", ["rider", "sb_rider", "bh_rider", "2_Hub_Rider", "3_SB_Rider"]).eq("is_active", true).order("full_name"),
      ]);
      setUnits([
        ...(br || []).map((b: any) => ({ key: `b:${b.id}`, label: `${b.code ? b.code + " · " : ""}${b.name}`, kind: "branch" as const })),
        ...(rd || []).map((r: any) => ({ key: `r:${r.id}`, label: r.full_name, kind: "rider" as const })),
      ]);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const s = `${from}T00:00:00+07:00`, e = `${to}T23:59:59+07:00`;
      const [pos, rtx, opex, ropex, prods] = await Promise.all([
        fetchAll((a, b) => db.from("pos_transactions").select("id, branch_id, total, status, payment_method_1, amount_1, payment_method_2, amount_2, change_amount").eq("status", "paid").gte("created_at", s).lte("created_at", e).range(a, b)),
        fetchAll((a, b) => db.from("transactions").select("id, rider_id, branch_id, final_amount, payment_method").eq("status", "completed").eq("is_voided", false).gte("transaction_date", s).lte("transaction_date", e).range(a, b)),
        fetchAll((a, b) => db.from("operational_expenses").select("amount, expense_category, branch_id, created_by").gte("expense_date", from).lte("expense_date", to).range(a, b)),
        fetchAll((a, b) => db.from("daily_operational_expenses").select("amount, expense_type, rider_id").gte("expense_date", from).lte("expense_date", to).range(a, b)),
        fetchAll((a, b) => db.from("products").select("id, cost_price").range(a, b)),
      ]);
      const cost = new Map<string, number>(prods.map((p: any) => [p.id, Number(p.cost_price || 0)]));
      const [posItems, rItems] = await Promise.all([
        fetchIn("pos_transaction_items", "transaction_id, product_id, qty", "transaction_id", pos.map((t: any) => t.id)),
        fetchIn("transaction_items", "transaction_id, product_id, quantity", "transaction_id", rtx.map((t: any) => t.id)),
      ]);
      const riderIds = new Set(units.filter((u) => u.kind === "rider").map((u) => u.key.slice(2)));
      const map: Record<string, PL> = {};
      const none = emptyPL();
      const get = (k: string | null) => (k ? (map[k] ||= emptyPL()) : none);
      const addPay = (pl: PL, m: string, amt: number) => { const k = payKey(m) as "cash"; pl[k] += amt; if (k === ("qris" as any)) pl.mdr += amt * 0.007; };

      const posUnit = new Map<string, string | null>();
      pos.forEach((t: any) => {
        const k = t.branch_id ? `b:${t.branch_id}` : null; posUnit.set(t.id, k);
        const pl = get(k);
        const a2 = Number(t.amount_2 || 0);
        if (t.payment_method_2 && a2 > 0) { addPay(pl, t.payment_method_1, Number(t.total) - a2); addPay(pl, t.payment_method_2, a2); }
        else addPay(pl, t.payment_method_1, Number(t.total || 0));
      });
      const rUnit = new Map<string, string | null>();
      rtx.forEach((t: any) => {
        const k = t.rider_id ? `r:${t.rider_id}` : t.branch_id ? `b:${t.branch_id}` : null; rUnit.set(t.id, k);
        addPay(get(k), t.payment_method, Number(t.final_amount || 0));
      });
      posItems.forEach((i: any) => { get(posUnit.get(i.transaction_id) ?? null).cogs += Number(i.qty || 0) * (cost.get(i.product_id) || 0); });
      rItems.forEach((i: any) => { get(rUnit.get(i.transaction_id) ?? null).cogs += Number(i.quantity || 0) * (cost.get(i.product_id) || 0); });
      const addExp = (pl: PL, cat: string, amt: number) => { const c = mapExpenseToCategory(cat || ""); pl.exp[c] = (pl.exp[c] || 0) + amt; };
      opex.forEach((x: any) => {
        const k = x.created_by && riderIds.has(x.created_by) ? `r:${x.created_by}` : x.branch_id ? `b:${x.branch_id}` : null;
        addExp(get(k), x.expense_category, Number(x.amount || 0));
      });
      ropex.forEach((x: any) => addExp(get(x.rider_id ? `r:${x.rider_id}` : null), x.expense_type, Number(x.amount || 0)));
      setPerUnit(map); setUnassigned(none);
    } catch (err: any) {
      toast.error("Gagal memuat laba rugi: " + (err?.message || err));
    } finally { setLoading(false); }
  };
  useEffect(() => { if (units.length) load(); }, [from, to, units]);

  const allSelected = selected.length === 0;
  const total = useMemo(() => {
    const keys = allSelected ? Object.keys(perUnit) : selected;
    const t = emptyPL();
    const add = (p?: PL) => { if (!p) return; t.cash += p.cash; t.qris += p.qris; t.transfer += p.transfer; t.other += p.other; t.cogs += p.cogs; t.mdr += p.mdr; Object.entries(p.exp).forEach(([k, v]) => (t.exp[k] = (t.exp[k] || 0) + v)); };
    keys.forEach((k) => add(perUnit[k]));
    if (allSelected) add(unassigned);
    return t;
  }, [perUnit, unassigned, selected, allSelected]);

  const calc = (p: PL) => {
    const rev = p.cash + p.qris + p.transfer + p.other;
    const hpp = p.cogs + p.mdr;
    const opx = Object.values(p.exp).reduce((s, v) => s + v, 0);
    return { rev, hpp, gross: rev - hpp, opx, net: rev - hpp - opx };
  };
  const T = calc(total);
  const expRows = Object.entries(total.exp).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  const scopeLabel = allSelected ? "Semua Unit (Konsolidasi)" : units.filter((u) => selected.includes(u.key)).map((u) => u.label).join(", ");
  const compare = units.filter((u) => (allSelected || selected.includes(u.key)) && perUnit[u.key]).map((u) => ({ u, ...calc(perUnit[u.key]) }))
    .sort((a, b) => b.net - a.net);
  const toggle = (k: string) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const exportPdf = () => {
    const doc = new jsPDF();
    let y = 16;
    const line = (l: string, r = "", bold = false, indent = 0) => {
      if (y > 280) { doc.addPage(); y = 16; }
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.text(l, 14 + indent, y); if (r) doc.text(r, 196, y, { align: "right" }); y += 6;
    };
    doc.setFontSize(15); line("LAPORAN LABA RUGI", "", true); doc.setFontSize(9);
    line(`Periode: ${from} s/d ${to}`);
    doc.splitTextToSize(`Unit: ${scopeLabel}`, 180).forEach((t: string) => line(t));
    y += 2; doc.setFontSize(10);
    line("PENDAPATAN", "", true);
    line("Penjualan Tunai", rp(total.cash), false, 4); line("Penjualan QRIS / E-Wallet", rp(total.qris), false, 4);
    line("Penjualan Transfer / EDC", rp(total.transfer), false, 4); if (total.other) line("Penjualan Lainnya", rp(total.other), false, 4);
    line("Total Pendapatan", rp(T.rev), true);
    line("HARGA POKOK PENJUALAN", "", true);
    line("HPP Produk Terjual", rp(total.cogs), false, 4); line("Biaya MDR QRIS (0.7%)", rp(total.mdr), false, 4);
    line("Total HPP", rp(T.hpp), true); line("LABA KOTOR", rp(T.gross), true);
    line("BEBAN OPERASIONAL", "", true);
    expRows.forEach(([k, v]) => line(EXP_LABEL[k] || k, rp(v), false, 4));
    line("Total Beban Operasional", rp(T.opx), true);
    y += 2; line("LABA BERSIH", rp(T.net), true);
    if (compare.length > 1) {
      y += 6; line("PERBANDINGAN PER UNIT", "", true); doc.setFontSize(8);
      compare.forEach((c) => line(`${c.u.label.slice(0, 40)}  | Omset ${rp(c.rev)} | HPP ${rp(c.hpp)} | Beban ${rp(c.opx)}`, rp(c.net)));
    }
    doc.save(`laba-rugi-${from}-${to}.pdf`);
  };

  const Row = ({ l, v, b, i }: { l: string; v?: number; b?: boolean; i?: boolean }) => (
    <TableRow className={b ? "font-semibold bg-muted/40" : ""}><TableCell className={i ? "pl-8" : ""}>{l}</TableCell><TableCell className="text-right">{v === undefined ? "" : rp(v)}</TableCell></TableRow>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <CardTitle className="text-base">Laba Rugi per Unit Usaha</CardTitle>
          <div className="flex flex-wrap gap-2 items-end">
            <div><Label className="text-xs">Dari</Label><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">Sampai</Label><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline"><Filter className="h-4 w-4 mr-2" />{allSelected ? "Semua Unit" : `${selected.length} unit dipilih`}</Button></PopoverTrigger>
              <PopoverContent className="w-80 max-h-[60vh] overflow-y-auto">
                <label className="flex items-center gap-2 py-1 font-semibold"><Checkbox checked={allSelected} onCheckedChange={() => setSelected([])} />Semua Unit (Konsolidasi)</label>
                {(["branch", "rider"] as const).map((kind) => (
                  <div key={kind} className="mt-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{kind === "branch" ? "Cabang / Outlet" : "Unit Rider (On The Wheels)"}</div>
                    {units.filter((u) => u.kind === kind).map((u) => (
                      <label key={u.key} className="flex items-center gap-2 py-1 text-sm"><Checkbox checked={selected.includes(u.key)} onCheckedChange={() => toggle(u.key)} />{u.label}</label>
                    ))}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button onClick={exportPdf}><FileText className="h-4 w-4 mr-2" />Export PDF</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Unit: {scopeLabel}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[["Pendapatan", T.rev], ["HPP", T.hpp], ["Laba Kotor", T.gross], ["Beban Operasional", T.opx], ["Laba Bersih", T.net]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className={`font-bold ${(v as number) < 0 ? "text-destructive" : ""}`}>{rp(v as number)}</div></div>
            ))}
          </div>
          {loading ? <p className="text-center text-muted-foreground py-8">Memuat…</p> : (
            <Table><TableBody>
              <Row l="PENDAPATAN" b />
              <Row l="Penjualan Tunai" v={total.cash} i /><Row l="Penjualan QRIS / E-Wallet" v={total.qris} i /><Row l="Penjualan Transfer / EDC" v={total.transfer} i />
              {total.other ? <Row l="Penjualan Lainnya" v={total.other} i /> : null}
              <Row l="Total Pendapatan" v={T.rev} b />
              <Row l="HARGA POKOK PENJUALAN" b />
              <Row l="HPP Produk Terjual" v={total.cogs} i /><Row l="Biaya MDR QRIS (0.7%)" v={total.mdr} i />
              <Row l="Total HPP" v={T.hpp} b />
              <Row l="LABA KOTOR" v={T.gross} b />
              <Row l="BEBAN OPERASIONAL" b />
              {expRows.length === 0 && <Row l="Belum ada pengeluaran pada periode ini" i />}
              {expRows.map(([k, v]) => <Row key={k} l={EXP_LABEL[k] || k} v={v} i />)}
              <Row l="Total Beban Operasional" v={T.opx} b />
              <TableRow className="font-bold bg-muted/60"><TableCell>LABA BERSIH</TableCell><TableCell className={`text-right ${T.net < 0 ? "text-destructive" : "text-primary"}`}>{rp(T.net)}</TableCell></TableRow>
            </TableBody></Table>
          )}
        </CardContent>
      </Card>
      {compare.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Perbandingan per Unit</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead className="text-right">Pendapatan</TableHead><TableHead className="text-right">HPP</TableHead><TableHead className="text-right">Laba Kotor</TableHead><TableHead className="text-right">Beban</TableHead><TableHead className="text-right">Laba Bersih</TableHead></TableRow></TableHeader>
              <TableBody>
                {compare.map((c) => (
                  <TableRow key={c.u.key} className="cursor-pointer" onClick={() => setSelected([c.u.key])}>
                    <TableCell>{c.u.label}<span className="ml-2 text-xs text-muted-foreground">{c.u.kind === "branch" ? "Cabang" : "Rider"}</span></TableCell>
                    <TableCell className="text-right">{rp(c.rev)}</TableCell><TableCell className="text-right">{rp(c.hpp)}</TableCell>
                    <TableCell className="text-right">{rp(c.gross)}</TableCell><TableCell className="text-right">{rp(c.opx)}</TableCell>
                    <TableCell className={`text-right font-semibold ${c.net < 0 ? "text-destructive" : ""}`}>{rp(c.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
