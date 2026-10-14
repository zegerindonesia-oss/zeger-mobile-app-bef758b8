import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, Pencil, Send, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;
const rp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const monthStart = () => today().slice(0, 8) + "01";

type Acc = { id: string; code: string; name: string; account_type: string; parent_id: string | null };
type Row = { id?: string; txn_date: string; description: string; reference?: string | null; direction: "in" | "out"; amount: number; balance?: number | null; category_account_id: string | null; bank_account_id?: string | null; branch_id?: string | null; status?: string; journal_id?: string | null };

/* Keyword → kata kunci nama/kode akun COA (pencocokan pertama yang ditemukan dipakai) */
const RULES: { re: RegExp; dir?: "in" | "out"; match: string[] }[] = [
  { re: /bunga|jasa giro|interest/i, dir: "in", match: ["bunga", "pendapatan lain"] },
  { re: /adm|biaya admin|admin fee|biaya bulanan|pajak bunga|materai/i, dir: "out", match: ["admin bank"] },
  { re: /mdr|qris fee|biaya qris/i, dir: "out", match: ["mdr"] },
  { re: /qris|qr |setoran|setor tunai|penjualan|sales|kasir|gopay|ovo|shopee|grab|gofood|dana/i, dir: "in", match: ["penjualan outlet", "penjualan"] },
  { re: /pln|listrik|pdam|air |telkom|indihome|internet|wifi/i, dir: "out", match: ["listrik"] },
  { re: /sewa|rent/i, dir: "out", match: ["sewa"] },
  { re: /gaji|payroll|salary|thr|upah/i, dir: "out", match: ["gaji"] },
  { re: /komisi|insentif/i, dir: "out", match: ["komisi"] },
  { re: /pertamina|bensin|bbm|shell|solar|parkir|tol/i, dir: "out", match: ["bensin"] },
  { re: /iklan|ads|meta|facebook|instagram|tiktok|marketing|promo/i, dir: "out", match: ["marketing"] },
  { re: /service|servis|perbaikan|maintenance|perawatan/i, dir: "out", match: ["perawatan"] },
  { re: /pajak|djp|pph|ppn|pb1/i, dir: "out", match: ["hutang pajak", "pajak"] },
  { re: /supplier|pt |cv |ud |toko|belanja|bahan|susu|kopi|gula/i, dir: "out", match: ["hutang supplier", "persediaan bahan"] },
  { re: /prive|tarik pribadi/i, dir: "out", match: ["prive"] },
  { re: /modal|setoran modal|investasi/i, dir: "in", match: ["modal"] },
];

function suggest(desc: string, dir: "in" | "out", leafs: Acc[], suppliers: string[]): string | null {
  const find = (keys: string[]) => {
    for (const k of keys) { const a = leafs.find((x) => x.name.toLowerCase().includes(k)); if (a) return a.id; }
    return null;
  };
  const d = desc.toLowerCase();
  if (dir === "out" && suppliers.some((s) => s && d.includes(s.toLowerCase()))) { const id = find(["hutang supplier", "persediaan bahan"]); if (id) return id; }
  for (const r of RULES) if ((!r.dir || r.dir === dir) && r.re.test(desc)) { const id = find(r.match); if (id) return id; }
  return find(dir === "in" ? ["pendapatan lain"] : ["operasional"]);
}

const num = (v: any): number => {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1) s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  return Math.abs(Number(s) || 0);
};
const toDate = (v: any): string | null => {
  if (v instanceof Date) return ymd(v);
  if (typeof v === "number" && v > 20000) { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${pad(d.m)}-${pad(d.d)}`; }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(); return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  return null;
};

function parseSheet(rows: any[][]): Omit<Row, "category_account_id">[] {
  const hi = rows.findIndex((r) => r.some((c) => /tanggal|tgl|date/i.test(String(c))));
  if (hi < 0) return [];
  const h = rows[hi].map((c) => String(c).toLowerCase());
  const col = (re: RegExp) => h.findIndex((c) => re.test(c));
  const cDate = col(/tanggal|tgl|date/), cDesc = col(/keterangan|uraian|deskripsi|description|remark|transaksi/);
  const cRef = col(/ref|no\.|nomor|cabang/), cDebit = col(/^debit|debet|keluar|withdraw|^db$/), cCredit = col(/^kredit|credit|masuk|deposit|^cr$/);
  const cAmt = col(/nominal|jumlah|amount|mutasi/), cType = col(/tipe|type|jenis|d\/k|db\/cr/), cBal = col(/saldo|balance/);
  const out: Omit<Row, "category_account_id">[] = [];
  for (const r of rows.slice(hi + 1)) {
    const date = toDate(r[cDate]); if (!date) continue;
    let dir: "in" | "out" = "out", amount = 0;
    if (cDebit >= 0 || cCredit >= 0) {
      const dv = cDebit >= 0 ? num(r[cDebit]) : 0, cv = cCredit >= 0 ? num(r[cCredit]) : 0;
      if (cv > 0) { dir = "in"; amount = cv; } else { amount = dv; }
    } else if (cAmt >= 0) {
      const raw = String(r[cAmt] ?? ""); amount = num(raw);
      const t = String(cType >= 0 ? r[cType] : raw).toLowerCase();
      dir = /cr|kredit|credit|masuk|\bk\b/.test(t) && !/db|debit/.test(t) ? "in" : raw.trim().startsWith("-") ? "out" : /db|debit|keluar|\bd\b/.test(t) ? "out" : "in";
    }
    if (!amount) continue;
    out.push({ txn_date: date, description: String(r[cDesc] ?? "").trim() || "-", reference: cRef >= 0 ? String(r[cRef] ?? "") || null : null, direction: dir, amount, balance: cBal >= 0 ? num(r[cBal]) || null : null });
  }
  return out;
}

export default function BankTransactionsTab({ accounts, branch, branches }: { accounts: Acc[]; branch: string; branches: { id: string; name: string; code?: string }[] }) {
  const leafs = useMemo(() => accounts.filter((a) => a.parent_id), [accounts]);
  const bankAccs = useMemo(() => leafs.filter((a) => a.account_type === "asset" && /bank|kas|qris/i.test(a.name)), [leafs]);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState("all");
  const [list, setList] = useState<Row[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [bankAcc, setBankAcc] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const accLabel = (id?: string | null) => { const a = accounts.find((x) => x.id === id); return a ? `${a.code} ${a.name}` : "—"; };

  useEffect(() => { db.from("suppliers").select("name").then(({ data }: any) => setSuppliers((data || []).map((s: any) => s.name))); }, []);
  useEffect(() => { if (!bankAcc && bankAccs.length) setBankAcc((bankAccs.find((a) => /bank/i.test(a.name)) || bankAccs[0]).id); }, [bankAccs]);

  const load = async () => {
    const out: Row[] = [];
    for (let p = 0; ; p++) {
      let q = db.from("bank_statement_transactions").select("*").gte("txn_date", from).lte("txn_date", to).order("txn_date", { ascending: false }).order("created_at").range(p * 1000, p * 1000 + 999);
      if (branch !== "all") q = q.eq("branch_id", branch);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) { toast.error(error.message); break; }
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setList(out); setSel([]);
  };
  useEffect(() => { load(); }, [from, to, branch, status]);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      const parsed = parseSheet(rows);
      if (!parsed.length) return toast.error("Kolom Tanggal / Keterangan / Nominal tidak ditemukan. Gunakan template.");
      setPreview(parsed.map((r) => ({ ...r, category_account_id: suggest(r.description, r.direction, leafs, suppliers) })));
    } catch (e: any) { toast.error("Gagal membaca file: " + e.message); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tanggal", "Keterangan", "Referensi", "Debit (Keluar)", "Kredit (Masuk)", "Saldo"],
      ["01/10/2026", "SETORAN QRIS MERCHANT ZEGER", "", "", 2500000, 12500000],
      ["02/10/2026", "TRSF E-BANKING PLN PASCABAYAR", "", 850000, "", 11650000],
      ["03/10/2026", "BIAYA ADM BULANAN", "", 15000, "", 11635000],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Mutasi"); XLSX.writeFile(wb, "template-mutasi-bank.xlsx");
  };

  const saveImport = async () => {
    if (!preview) return;
    if (!bankAcc) return toast.error("Pilih akun bank");
    setBusy(true);
    const payload = preview.map((r) => ({ ...r, bank_account_id: bankAcc, branch_id: branch !== "all" ? branch : null, status: "draft" }));
    const { error } = await db.from("bank_statement_transactions").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} mutasi disimpan sebagai draft`);
    setPreview(null); load();
  };

  const saveEdit = async () => {
    if (!edit) return;
    const { id, journal_id, status: _s, ...rest } = edit as any;
    const body = { ...rest, amount: Number(rest.amount) || 0, branch_id: rest.branch_id || null };
    const { error } = id ? await db.from("bank_statement_transactions").update(body).eq("id", id) : await db.from("bank_statement_transactions").insert({ ...body, status: "draft" });
    if (error) return toast.error(error.message);
    toast.success("Tersimpan"); setEdit(null); load();
  };

  const remove = async (ids: string[]) => {
    if (!ids.length || !confirm(`Hapus ${ids.length} mutasi? Jurnal yang sudah diposting tetap ada (batalkan di Jurnal Umum).`)) return;
    const { error } = await db.from("bank_statement_transactions").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); load();
  };

  const post = async (ids: string[]) => {
    const ok = list.filter((r) => ids.includes(r.id!) && r.status !== "posted");
    if (!ok.length) return toast.info("Pilih mutasi draft");
    const missing = ok.filter((r) => !r.category_account_id || !r.bank_account_id).length;
    if (missing) toast.warning(`${missing} mutasi dilewati karena akun belum dipilih`);
    setBusy(true);
    const { data, error } = await db.rpc("post_bank_statements", { _ids: ok.map((r) => r.id) });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${data} mutasi diposting ke Jurnal Umum`); load();
  };

  const setCat = async (r: Row, v: string) => {
    setList((l) => l.map((x) => (x.id === r.id ? { ...x, category_account_id: v } : x)));
    await db.from("bank_statement_transactions").update({ category_account_id: v }).eq("id", r.id);
  };
  const autoSuggest = async () => {
    const drafts = list.filter((r) => r.status !== "posted");
    for (const r of drafts) {
      const s = suggest(r.description, r.direction, leafs, suppliers);
      if (s && s !== r.category_account_id) await db.from("bank_statement_transactions").update({ category_account_id: s }).eq("id", r.id);
    }
    toast.success("Saran kategori diperbarui"); load();
  };

  const tin = list.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0);
  const tout = list.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0);
  const AccSelect = ({ value, onChange, opts = leafs, w = "w-56" }: { value?: string | null; onChange: (v: string) => void; opts?: Acc[]; w?: string }) => (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className={`${w} h-8 text-xs`}><SelectValue placeholder="Pilih akun" /></SelectTrigger>
      <SelectContent className="max-h-72">{opts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Uang Masuk</p><p className="text-lg font-bold text-primary">{rp(tin)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Uang Keluar</p><p className="text-lg font-bold text-destructive">{rp(tout)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Belum diposting</p><p className="text-lg font-bold">{list.filter((r) => r.status !== "posted").length} mutasi</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
          <CardTitle className="text-base">Data Transaksi (Mutasi Bank)</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua status</SelectItem><SelectItem value="draft">Perlu Review</SelectItem><SelectItem value="posted">Terjurnal</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" onClick={template}><Download className="h-4 w-4 mr-1" />Template</Button>
            <Button variant="outline" onClick={() => setEdit({ txn_date: today(), description: "", direction: "out", amount: 0, category_account_id: null, bank_account_id: bankAcc, branch_id: branch !== "all" ? branch : null })}><Plus className="h-4 w-4 mr-1" />Manual</Button>
            <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Upload CSV / Excel</Button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" variant="secondary" onClick={autoSuggest}><Sparkles className="h-4 w-4 mr-1" />Sarankan kategori</Button>
            <Button size="sm" disabled={!sel.length || busy} onClick={() => post(sel)}><Send className="h-4 w-4 mr-1" />Posting terpilih ({sel.length})</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => post(list.map((r) => r.id!))}>Posting semua draft</Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={!sel.length} onClick={() => remove(sel)}><Trash2 className="h-4 w-4 mr-1" />Hapus terpilih</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8"><Checkbox checked={!!list.length && sel.length === list.length} onCheckedChange={(v) => setSel(v ? list.map((r) => r.id!) : [])} /></TableHead>
              <TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Masuk</TableHead><TableHead className="text-right">Keluar</TableHead><TableHead>Kategori Akun</TableHead><TableHead>Status</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {!list.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada mutasi. Upload rekening koran (CSV/Excel) dari BCA, Mandiri, BRI, BNI, dll.</TableCell></TableRow>}
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Checkbox checked={sel.includes(r.id!)} onCheckedChange={(v) => setSel((s) => (v ? [...s, r.id!] : s.filter((x) => x !== r.id)))} /></TableCell>
                  <TableCell className="whitespace-nowrap">{r.txn_date}</TableCell>
                  <TableCell className="max-w-xs"><div className="truncate">{r.description}</div><div className="text-xs text-muted-foreground">{accLabel(r.bank_account_id)}{r.branch_id ? ` · ${branches.find((b) => b.id === r.branch_id)?.name || ""}` : ""}</div></TableCell>
                  <TableCell className="text-right text-primary">{r.direction === "in" ? rp(r.amount) : ""}</TableCell>
                  <TableCell className="text-right text-destructive">{r.direction === "out" ? rp(r.amount) : ""}</TableCell>
                  <TableCell>{r.status === "posted" ? <span className="text-xs">{accLabel(r.category_account_id)}</span> : <AccSelect value={r.category_account_id} onChange={(v) => setCat(r, v)} />}</TableCell>
                  <TableCell>{r.status === "posted" ? <Badge>Terjurnal</Badge> : <Badge variant="outline">Perlu Review</Badge>}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.status !== "posted" && <><Button size="icon" variant="ghost" onClick={() => post([r.id!])} title="Posting"><Send className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button></>}
                    <Button size="icon" variant="ghost" onClick={() => remove([r.id!])}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Import — {preview?.length} mutasi</DialogTitle></DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Label>Akun bank / kas</Label>
            <AccSelect value={bankAcc} onChange={setBankAcc} opts={bankAccs.length ? bankAccs : leafs} w="w-64" />
            <span className="text-xs text-muted-foreground">Cabang: {branch === "all" ? "tanpa cabang (pilih cabang di atas jika perlu)" : branches.find((b) => b.id === branch)?.name}</span>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead>Tipe</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead>Saran Kategori</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {preview?.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">{r.txn_date}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                  <TableCell><Badge variant={r.direction === "in" ? "default" : "destructive"}>{r.direction === "in" ? "Masuk" : "Keluar"}</Badge></TableCell>
                  <TableCell className="text-right">{rp(r.amount)}</TableCell>
                  <TableCell><AccSelect value={r.category_account_id} onChange={(v) => setPreview((p) => p!.map((x, j) => (j === i ? { ...x, category_account_id: v } : x)))} /></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setPreview((p) => p!.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter><Button variant="outline" onClick={() => setPreview(null)}>Batal</Button><Button disabled={busy} onClick={saveImport}>Simpan sebagai Draft</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit Mutasi" : "Tambah Mutasi"}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Tanggal</Label><Input type="date" value={edit.txn_date} onChange={(e) => setEdit({ ...edit, txn_date: e.target.value })} /></div>
              <div><Label>Tipe</Label><Select value={edit.direction} onValueChange={(v: any) => setEdit({ ...edit, direction: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in">Uang Masuk</SelectItem><SelectItem value="out">Uang Keluar</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Keterangan</Label><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nominal</Label><Input type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} /></div>
              <div><Label>Referensi</Label><Input value={edit.reference || ""} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} /></div>
            </div>
            <div><Label>Akun bank / kas</Label><AccSelect value={edit.bank_account_id} onChange={(v) => setEdit({ ...edit, bank_account_id: v })} opts={bankAccs.length ? bankAccs : leafs} w="w-full" /></div>
            <div><Label>Kategori akun</Label><AccSelect value={edit.category_account_id} onChange={(v) => setEdit({ ...edit, category_account_id: v })} w="w-full" /></div>
            <div><Label>Cabang</Label><Select value={edit.branch_id || "none"} onValueChange={(v) => setEdit({ ...edit, branch_id: v === "none" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa cabang</SelectItem>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={saveEdit}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
