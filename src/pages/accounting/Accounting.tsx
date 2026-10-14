import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, ChevronRight, BookOpen, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BankTransactionsTab from "./BankTransactionsTab";

const db = supabase as any;
const rp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const monthStart = () => today().slice(0, 8) + "01";

const TYPES: Record<string, { label: string; nb: "debit" | "credit" }> = {
  asset: { label: "Aset", nb: "debit" },
  liability: { label: "Liabilitas", nb: "credit" },
  equity: { label: "Ekuitas", nb: "credit" },
  revenue: { label: "Pendapatan", nb: "credit" },
  cogs: { label: "HPP", nb: "debit" },
  expense: { label: "Beban Operasional", nb: "debit" },
  other: { label: "Lain-lain", nb: "debit" },
};

type Account = { id: string; code: string; name: string; account_type: string; parent_id: string | null; normal_balance: string; opening_balance: number; description: string | null; is_active: boolean };
type Line = { account_id: string; debit: number; credit: number; memo?: string };

const TABS = [
  { id: "accounts", label: "Bagan Akun & Kategori" },
  { id: "journal", label: "Jurnal Umum" },
  { id: "ledger", label: "Buku Besar" },
  { id: "trial-balance", label: "Neraca Saldo" },
  { id: "profit-loss", label: "Laba Rugi" },
  { id: "transactions", label: "Data Transaksi" },
];
const SOURCES: Record<string, string> = { manual: "Manual", pos_sales: "Penjualan", pos_cogs: "HPP Bahan Baku", purchase: "Pembelian Bahan", bank: "Mutasi Bank", opex: "Beban Outlet", rider_opex: "Beban Rider" };

export default function Accounting() {
  const { tab = "accounts" } = useParams();
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const loadAccounts = async () => {
    const { data, error } = await db.from("accounting_accounts").select("*").order("code");
    if (error) toast.error(error.message); else setAccounts(data || []);
  };
  const [branch, setBranch] = useState("all");
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string }[]>([]);
  useEffect(() => { loadAccounts(); db.from("branches").select("id, name, code").order("name").then(({ data }: any) => setBranches(data || [])); }, []);

  return (
    <div className="space-y-4 p-2 md:p-0">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Accounting</h1>
          <p className="text-sm text-muted-foreground">Bagan akun, jurnal, buku besar, laporan keuangan, dan mutasi bank.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">Cabang</Label>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang (Konsolidasi)</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ""}{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => nav(`/accounting/${v}`)}>
        <TabsList className="flex w-full overflow-x-auto justify-start">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {tab === "accounts" && <AccountsTab accounts={accounts} reload={loadAccounts} />}
      {tab === "journal" && <JournalTab accounts={accounts} branch={branch} />}
      {tab === "ledger" && <LedgerTab accounts={accounts} branch={branch} />}
      {tab === "trial-balance" && <TrialBalanceTab accounts={accounts} branch={branch} />}
      {tab === "profit-loss" && <ProfitLossTab accounts={accounts} branch={branch} />}
      {tab === "transactions" && <BankTransactionsTab accounts={accounts} branch={branch} branches={branches} />}
    </div>
  );
}

/* ---------------- Bagan Akun ---------------- */
function AccountsTab({ accounts, reload }: { accounts: Account[]; reload: () => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [edit, setEdit] = useState<Partial<Account> | null>(null);

  const roots = accounts.filter((a) => !a.parent_id);
  const childrenOf = (id: string) => accounts.filter((a) => a.parent_id === id);
  const matches = (a: Account) => (type === "all" || a.account_type === type) && (!q || `${a.code} ${a.name}`.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    if (!edit?.code || !edit?.name || !edit?.account_type) return toast.error("Kode, nama, dan tipe wajib diisi");
    const payload = {
      code: edit.code, name: edit.name, account_type: edit.account_type,
      parent_id: edit.parent_id || null,
      normal_balance: edit.normal_balance || TYPES[edit.account_type].nb,
      opening_balance: Number(edit.opening_balance) || 0,
      description: edit.description || null, is_active: edit.is_active ?? true,
    };
    const res = edit.id ? await db.from("accounting_accounts").update(payload).eq("id", edit.id) : await db.from("accounting_accounts").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Akun disimpan"); setEdit(null); reload();
  };
  const remove = async (a: Account) => {
    if (!confirm(`Hapus akun ${a.code} ${a.name}?`)) return;
    const { error } = await db.from("accounting_accounts").delete().eq("id", a.id);
    if (error) return toast.error("Akun sudah dipakai di jurnal — nonaktifkan saja.");
    reload();
  };

  const Row = ({ a, depth }: { a: Account; depth: number }) => {
    const kids = childrenOf(a.id);
    const show = matches(a) || kids.some(matches);
    if (!show) return null;
    return (
      <>
        <TableRow className={depth === 0 ? "bg-muted/40 font-semibold" : ""}>
          <TableCell className="font-mono text-xs">{a.code}</TableCell>
          <TableCell>
            <span style={{ paddingLeft: depth * 18 }} className="inline-flex items-center gap-1">
              {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}{a.name}
              {!a.is_active && <Badge variant="outline" className="ml-2">Nonaktif</Badge>}
            </span>
          </TableCell>
          <TableCell><Badge variant="secondary">{TYPES[a.account_type]?.label}</Badge></TableCell>
          <TableCell className="capitalize text-xs">{a.normal_balance}</TableCell>
          <TableCell className="text-right">{rp(a.opening_balance)}</TableCell>
          <TableCell className="text-right whitespace-nowrap">
            <Button size="icon" variant="ghost" title="Tambah sub-kategori" onClick={() => setEdit({ parent_id: a.id, account_type: a.account_type, normal_balance: a.normal_balance, code: "" })}><Plus className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
          </TableCell>
        </TableRow>
        {kids.map((k) => <Row key={k.id} a={k} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <CardTitle className="text-base">Bagan Akun (Chart of Accounts)</CardTitle>
        <div className="flex flex-wrap gap-2">
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8 w-48" placeholder="Cari akun" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua tipe</SelectItem>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => setEdit({ account_type: "expense", code: "" })}><Plus className="h-4 w-4 mr-1" />Kategori / Akun</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Akun</TableHead><TableHead>Tipe</TableHead><TableHead>Saldo Normal</TableHead><TableHead className="text-right">Saldo Awal</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{roots.map((r) => <Row key={r.id} a={r} depth={0} />)}</TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Ubah Akun" : edit?.parent_id ? "Tambah Sub-Kategori" : "Tambah Kategori / Akun"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kode Akun</Label><Input value={edit.code || ""} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="6-1010" /></div>
                <div><Label>Tipe</Label>
                  <Select value={edit.account_type} onValueChange={(v) => setEdit({ ...edit, account_type: v, normal_balance: TYPES[v].nb })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Nama Akun</Label><Input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="mis. Beban Kebersihan" /></div>
              <div><Label>Induk (kategori)</Label>
                <Select value={edit.parent_id || "none"} onValueChange={(v) => setEdit({ ...edit, parent_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— Kategori utama —</SelectItem>{accounts.filter((a) => a.id !== edit.id).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Saldo Normal</Label>
                  <Select value={edit.normal_balance || "debit"} onValueChange={(v) => setEdit({ ...edit, normal_balance: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Kredit</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Saldo Awal</Label><Input type="number" value={edit.opening_balance ?? 0} onChange={(e) => setEdit({ ...edit, opening_balance: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Keterangan</Label><Input value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Aktif</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Jurnal Umum ---------------- */
function AccountPicker({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (v: string) => void }) {
  const leaf = accounts.filter((a) => a.is_active && a.parent_id);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="min-w-[200px]"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
      <SelectContent>{leaf.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function JournalTab({ accounts, branch }: { accounts: Account[]; branch: string }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [all, setList] = useState<any[]>([]);
  const [src, setSrc] = useState("all");
  const [st, setSt] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const list = all.filter((j) => (src === "all" || (j.source || "manual") === src) && (st === "all" || j.status === st));
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState({ date: today(), description: "", reference: "" });
  const [lines, setLines] = useState<Line[]>([{ account_id: "", debit: 0, credit: 0 }, { account_id: "", debit: 0, credit: 0 }]);
  const accName = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? `${a.code} ${a.name}` : "-"; };

  const load = async () => {
    const out: any[] = [];
    for (let p = 0; ; p++) {
      let q2 = db.from("accounting_journals").select("*, accounting_journal_lines(*)").gte("journal_date", from).lte("journal_date", to).order("journal_date", { ascending: false }).order("created_at", { ascending: false }).range(p * 1000, p * 1000 + 999);
      if (branch !== "all") q2 = q2.eq("branch_id", branch);
      const { data, error } = await q2;
      if (error) { toast.error(error.message); break; }
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setList(out);
  };
  useEffect(() => { load(); }, [from, to, branch]);
  const sync = async () => {
    setSyncing(true);
    const { data, error } = await db.rpc("sync_accounting_auto", { _from: from, _to: to });
    if (error) { setSyncing(false); return toast.error(error.message); }
    const inv = await db.rpc("sync_accounting_inventory", { _from: from, _to: to });
    setSyncing(false);
    if (inv.error) toast.error(inv.error.message);
    toast.success(`Terjurnal: ${data.sales} penjualan, ${inv.data?.cogs ?? 0} HPP bahan baku, ${inv.data?.purchase ?? 0} pembelian, ${data.opex} beban outlet, ${data.rider_opex} beban rider`);
    load();
  };

  const td = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const tc = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = td > 0 && td === tc && lines.every((l) => l.account_id);

  const save = async () => {
    if (!balanced) return toast.error("Debit dan kredit harus seimbang & semua akun dipilih");
    const { error } = await db.rpc("create_accounting_journal", { _date: form.date, _description: form.description, _reference: form.reference || null, _branch_id: branch !== "all" ? branch : null, _lines: lines.filter((l) => l.debit || l.credit) });
    if (error) return toast.error(error.message);
    toast.success("Jurnal tersimpan"); setOpen(false);
    setLines([{ account_id: "", debit: 0, credit: 0 }, { account_id: "", debit: 0, credit: 0 }]); setForm({ date: today(), description: "", reference: "" });
    load();
  };
  const voidJ = async (j: any) => {
    if (!confirm(`Batalkan jurnal ${j.journal_number}?`)) return;
    const { error } = await db.from("accounting_journals").update({ status: "void" }).eq("id", j.id);
    if (error) toast.error(error.message); else { setDetail(null); load(); }
  };
  const setLine = (i: number, p: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...p } : l)));

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <CardTitle className="text-base">Jurnal Umum</CardTitle>
        <div className="flex flex-wrap gap-2 items-center">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select value={src} onValueChange={setSrc}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua Sumber</SelectItem>{Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={st} onValueChange={setSt}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua Status</SelectItem><SelectItem value="posted">Posted</SelectItem><SelectItem value="void">Dibatalkan</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" disabled={syncing} onClick={sync}><RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />Posting Otomatis</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Jurnal Baru</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">"Posting Otomatis" menjurnal penjualan (tunai/QRIS/transfer, tanpa transaksi void), HPP bahan baku (dari resep × harga bahan, atau harga modal produk), pembelian bahan dari PO yang diterima, dan pengeluaran operasional outlet & rider pada periode di atas. Aman diklik berulang — tidak akan dobel.</p>
        <Table>
          <TableHeader><TableRow><TableHead>No. Jurnal</TableHead><TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead>Sumber</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada jurnal pada periode ini</TableCell></TableRow>}
            {list.map((j) => (
              <TableRow key={j.id} className="cursor-pointer" onClick={() => setDetail(j)}>
                <TableCell className="font-mono text-xs">{j.journal_number}</TableCell>
                <TableCell>{j.journal_date}</TableCell>
                <TableCell>{j.description}</TableCell>
                <TableCell><Badge variant="outline">{SOURCES[j.source || "manual"] || j.source}</Badge></TableCell>
                <TableCell className="text-right">{rp(j.total_amount)}</TableCell>
                <TableCell><Badge variant={j.status === "void" ? "destructive" : "secondary"}>{j.status === "void" ? "Dibatalkan" : "Posted"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Jurnal Baru</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Tanggal</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Keterangan</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="mis. Bayar sewa outlet Oktober" /></div>
            <div><Label>No. Referensi / Nota</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Akun</TableHead><TableHead>Memo</TableHead><TableHead>Debit</TableHead><TableHead>Kredit</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell><AccountPicker accounts={accounts} value={l.account_id} onChange={(v) => setLine(i, { account_id: v })} /></TableCell>
                    <TableCell><Input value={l.memo || ""} onChange={(e) => setLine(i, { memo: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" className="w-32" value={l.debit || ""} onChange={(e) => setLine(i, { debit: Number(e.target.value), credit: 0 })} /></TableCell>
                    <TableCell><Input type="number" className="w-32" value={l.credit || ""} onChange={(e) => setLine(i, { credit: Number(e.target.value), debit: 0 })} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell><Button size="sm" variant="outline" onClick={() => setLines([...lines, { account_id: "", debit: 0, credit: 0 }])}><Plus className="h-4 w-4 mr-1" />Baris</Button></TableCell>
                  <TableCell className="text-right">Total</TableCell><TableCell>{rp(td)}</TableCell><TableCell>{rp(tc)}</TableCell><TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className={`text-sm ${balanced ? "text-primary" : "text-destructive"}`}>{balanced ? "Seimbang ✓" : `Selisih ${rp(Math.abs(td - tc))}`}</p>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button disabled={!balanced} onClick={save}>Posting Jurnal</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{detail?.journal_number} · {detail?.journal_date}</DialogTitle></DialogHeader>
          <p className="text-sm">{detail?.description}</p>
          <Table>
            <TableHeader><TableRow><TableHead>Akun</TableHead><TableHead>Memo</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Kredit</TableHead></TableRow></TableHeader>
            <TableBody>{detail?.accounting_journal_lines?.map((l: any) => (
              <TableRow key={l.id}><TableCell>{accName(l.account_id)}</TableCell><TableCell>{l.memo}</TableCell><TableCell className="text-right">{l.debit ? rp(l.debit) : ""}</TableCell><TableCell className="text-right">{l.credit ? rp(l.credit) : ""}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
          {detail?.status !== "void" && <DialogFooter><Button variant="destructive" onClick={() => voidJ(detail)}>Batalkan Jurnal</Button></DialogFooter>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Helpers: posted lines ---------------- */
async function fetchLines(to: string, from?: string, branch = "all") {
  const all: any[] = [];
  for (let p = 0; ; p++) {
    let q = db.from("accounting_journal_lines").select("account_id, debit, credit, memo, accounting_journals!inner(journal_number, journal_date, description, status)").eq("accounting_journals.status", "posted").lte("accounting_journals.journal_date", to).range(p * 1000, p * 1000 + 999);
    if (from) q = q.gte("accounting_journals.journal_date", from);
    if (branch !== "all") q = q.eq("accounting_journals.branch_id", branch);
    const { data, error } = await q;
    if (error) { toast.error(error.message); break; }
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

/* ---------------- Buku Besar ---------------- */
function LedgerTab({ accounts, branch }: { accounts: Account[]; branch: string }) {
  const [acc, setAcc] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchLines(to, undefined, branch).then((l) => { setLines(l); setLoading(false); });
  }, [to, branch]);

  const groups = useMemo(() => {
    const leafs = accounts.filter((a) => a.parent_id && (acc === "all" || a.id === acc))
      .filter((a) => !q || `${a.code} ${a.name}`.toLowerCase().includes(q.toLowerCase()));
    return leafs.map((a) => {
      const sign = a.normal_balance === "credit" ? -1 : 1;
      const mine = lines.filter((l) => l.account_id === a.id);
      const before = mine.filter((l) => l.accounting_journals.journal_date < from).reduce((s, l) => s + sign * (l.debit - l.credit), 0);
      const opening = Number(a.opening_balance || 0) + before;
      const rows = mine.filter((l) => l.accounting_journals.journal_date >= from)
        .sort((x, y) => x.accounting_journals.journal_date.localeCompare(y.accounting_journals.journal_date) || String(x.accounting_journals.journal_number).localeCompare(String(y.accounting_journals.journal_number)));
      let bal = opening;
      const withBal = rows.map((l) => { bal += sign * (l.debit - l.credit); return { ...l, bal }; });
      const td = rows.reduce((s, l) => s + Number(l.debit), 0), tc = rows.reduce((s, l) => s + Number(l.credit), 0);
      return { a, opening, rows: withBal, closing: bal, td, tc };
    }).filter((g) => acc !== "all" || g.rows.length || g.opening);
  }, [accounts, lines, acc, q, from]);

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Buku Besar</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={acc} onValueChange={setAcc}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Akun</SelectItem>
              {accounts.filter((a) => a.parent_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative"><Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" /><Input className="pl-8 w-48" placeholder="Cari akun" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && <p className="text-center text-muted-foreground py-6">Memuat…</p>}
        {!loading && groups.length === 0 && <p className="text-center text-muted-foreground py-8">Belum ada mutasi pada periode ini</p>}
        {!loading && groups.map((g) => (
          <div key={g.a.id} className="rounded-lg border">
            <div className="flex flex-wrap justify-between gap-2 px-3 py-2 bg-muted/40 font-semibold text-sm">
              <span><span className="font-mono">{g.a.code}</span> · {g.a.name}</span>
              <span className="text-muted-foreground font-normal">Saldo normal {g.a.normal_balance === "credit" ? "Kredit" : "Debit"}</span>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No. Jurnal</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Kredit</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={5} className="italic">Saldo Awal</TableCell><TableCell className="text-right">{rp(g.opening)}</TableCell></TableRow>
                {g.rows.map((l: any, i: number) => (
                  <TableRow key={i}><TableCell>{l.accounting_journals.journal_date}</TableCell><TableCell className="font-mono text-xs">{l.accounting_journals.journal_number}</TableCell><TableCell>{l.memo ? `${l.accounting_journals.description} — ${l.memo}` : l.accounting_journals.description}</TableCell><TableCell className="text-right">{l.debit ? rp(l.debit) : ""}</TableCell><TableCell className="text-right">{l.credit ? rp(l.credit) : ""}</TableCell><TableCell className="text-right">{rp(l.bal)}</TableCell></TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40"><TableCell colSpan={3}>Saldo Akhir</TableCell><TableCell className="text-right">{rp(g.td)}</TableCell><TableCell className="text-right">{rp(g.tc)}</TableCell><TableCell className="text-right">{rp(g.closing)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- Laba Rugi ---------------- */
function ProfitLossTab({ accounts, branch }: { accounts: Account[]; branch: string }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [lines, setLines] = useState<any[]>([]);
  useEffect(() => { fetchLines(to, from, branch).then(setLines); }, [from, to, branch]);
  const sec = (type: string, credit: boolean) => {
    const rows = accounts.filter((a) => a.parent_id && a.account_type === type).map((a) => {
      const v = lines.filter((l) => l.account_id === a.id).reduce((s, l) => s + (credit ? l.credit - l.debit : l.debit - l.credit), 0);
      return { a, v };
    }).filter((r) => r.v);
    return { rows, total: rows.reduce((s, r) => s + r.v, 0) };
  };
  const rev = sec("revenue", true), cogs = sec("cogs", false), exp = sec("expense", false), oth = sec("other", true);
  const gross = rev.total - cogs.total, net = gross - exp.total + oth.total;
  const Block = ({ title, s }: { title: string; s: ReturnType<typeof sec> }) => (<>
    <TableRow className="bg-muted/40 font-semibold"><TableCell colSpan={2}>{title}</TableCell></TableRow>
    {s.rows.map((r) => <TableRow key={r.a.id}><TableCell className="pl-6">{r.a.code} {r.a.name}</TableCell><TableCell className="text-right">{rp(r.v)}</TableCell></TableRow>)}
    <TableRow><TableCell className="font-medium">Total {title}</TableCell><TableCell className="text-right font-medium">{rp(s.total)}</TableCell></TableRow>
  </>);
  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <CardTitle className="text-base">Laba Rugi</CardTitle>
        <div className="flex gap-2"><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </CardHeader>
      <CardContent>
        <Table><TableBody>
          <Block title="Pendapatan" s={rev} />
          <Block title="Harga Pokok Penjualan" s={cogs} />
          <TableRow className="font-semibold"><TableCell>Laba Kotor</TableCell><TableCell className="text-right">{rp(gross)}</TableCell></TableRow>
          <Block title="Beban Operasional" s={exp} />
          <Block title="Pendapatan / Beban Lain (bersih)" s={oth} />
          <TableRow className="font-bold bg-muted/60"><TableCell>Laba Bersih</TableCell><TableCell className={`text-right ${net < 0 ? "text-destructive" : "text-primary"}`}>{rp(net)}</TableCell></TableRow>
        </TableBody></Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Neraca Saldo ---------------- */
function TrialBalanceTab({ accounts, branch }: { accounts: Account[]; branch: string }) {
  const [to, setTo] = useState(today());
  const [lines, setLines] = useState<any[]>([]);
  useEffect(() => { fetchLines(to, undefined, branch).then(setLines); }, [to, branch]);

  const rows = useMemo(() => accounts.filter((a) => a.parent_id).map((a) => {
    const mv = lines.filter((l) => l.account_id === a.id).reduce((s, l) => s + l.debit - l.credit, 0);
    const ob = a.normal_balance === "credit" ? -Number(a.opening_balance) : Number(a.opening_balance);
    const net = ob + mv;
    return { a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  }).filter((r) => r.debit || r.credit), [accounts, lines]);
  const td = rows.reduce((s, r) => s + r.debit, 0), tc = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <CardTitle className="text-base">Neraca Saldo (Trial Balance)</CardTitle>
        <div className="flex items-center gap-2"><Label>Per tanggal</Label><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Akun</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Kredit</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada saldo</TableCell></TableRow>}
            {rows.map((r) => <TableRow key={r.a.id}><TableCell className="font-mono text-xs">{r.a.code}</TableCell><TableCell>{r.a.name}</TableCell><TableCell className="text-right">{r.debit ? rp(r.debit) : ""}</TableCell><TableCell className="text-right">{r.credit ? rp(r.credit) : ""}</TableCell></TableRow>)}
            <TableRow className="font-semibold bg-muted/40"><TableCell colSpan={2}>Total {td === tc ? "✓ Seimbang" : "⚠ Tidak seimbang"}</TableCell><TableCell className="text-right">{rp(td)}</TableCell><TableCell className="text-right">{rp(tc)}</TableCell></TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
