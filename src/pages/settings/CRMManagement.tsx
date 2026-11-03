import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Download, Upload, Cake, Crown, AlertTriangle, UserPlus, Wallet, ShoppingBag, MessageCircle, Loader2, Save, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { segmentOf, SEGMENT_LABEL, daysToBirthday, waPhone, type Segment } from "@/lib/crm-segments";
import { BlastDialog } from "@/components/crm/BlastDialog";

interface Cust {
  id: string; name: string; phone: string | null; email: string | null; address: string | null; birthday: string | null;
  gender: string | null; member_code: string | null; points: number; branch_id: string | null; branch_name: string | null;
  registered_by_name: string | null; source_channel: string | null; notes: string | null; is_active: boolean; created_at: string;
  order_count: number; total_spent: number; last_order_at: string | null; spent_30d: number;
}
interface Hist { channel: string; ref: string; at: string; amount: number; branch_name: string | null; payment: string | null; items: { name: string; qty: number; subtotal: number }[]; }

const rp = (n: number) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const CHANNEL: Record<string, string> = { pos: "Kasir POS", app: "Aplikasi", rider: "Rider", qr: "QR Meja", import: "Import Excel", backoffice: "Back Office" };
const SEG_VARIANT: Record<Segment, "default" | "secondary" | "destructive" | "outline"> = { vip: "default", loyal: "secondary", at_risk: "destructive", dormant: "outline", new: "secondary", prospect: "outline" };

export default function CRMManagement() {
  const [rows, setRows] = useState<Cust[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("all");
  const [seg, setSeg] = useState<"all" | Segment>("all");
  const [tab, setTab] = useState("dashboard");
  const [openId, setOpenId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [blastOpen, setBlastOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("crm_customer_list");
    if (error) toast.error("Gagal memuat pelanggan: " + error.message);
    setRows((data || []).map((r: any) => ({ ...r, total_spent: Number(r.total_spent), spent_30d: Number(r.spent_30d), order_count: Number(r.order_count) })));
    setLoading(false);
  };
  useEffect(() => {
    document.title = "CRM Pelanggan | Flow F&B";
    load();
    supabase.from("branches").select("id, name").eq("is_active", true).order("name").then(({ data }) => setBranches(data || []));
  }, []);

  const withSeg = useMemo(() => rows.map((r) => ({ ...r, seg: segmentOf(r) })), [rows]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return withSeg.filter((r) =>
      (branch === "all" || r.branch_id === branch) && (seg === "all" || r.seg === seg) &&
      (!s || r.name?.toLowerCase().includes(s) || r.phone?.includes(s) || r.email?.toLowerCase().includes(s) || r.member_code?.toLowerCase().includes(s)))
      .sort((a, b) => b.total_spent - a.total_spent);
  }, [withSeg, q, branch, seg]);

  const kpi = useMemo(() => {
    const now = Date.now();
    const newMonth = rows.filter((r) => new Date(r.created_at).getMonth() === new Date().getMonth() && new Date(r.created_at).getFullYear() === new Date().getFullYear()).length;
    const active = rows.filter((r) => r.last_order_at && now - new Date(r.last_order_at).getTime() < 30 * 86400000).length;
    const ltv = rows.reduce((a, r) => a + r.total_spent, 0);
    const orders = rows.reduce((a, r) => a + r.order_count, 0);
    return { total: rows.length, newMonth, active, ltv, aov: orders ? ltv / orders : 0 };
  }, [rows]);
  const segCount = useMemo(() => withSeg.reduce((a, r) => ({ ...a, [r.seg]: (a[r.seg] || 0) + 1 }), {} as Record<string, number>), [withSeg]);
  const birthdays = useMemo(() => withSeg.map((r) => ({ r, d: daysToBirthday(r.birthday) })).filter((x) => x.d !== null && x.d <= 7).sort((a, b) => a.d! - b.d!), [withSeg]);
  const byBranch = useMemo(() => {
    const m: Record<string, { n: number; s: number }> = {};
    rows.forEach((r) => { const k = r.branch_name || "Tanpa cabang"; m[k] = m[k] || { n: 0, s: 0 }; m[k].n++; m[k].s += r.total_spent; });
    return Object.entries(m).sort((a, b) => b[1].n - a[1].n);
  }, [rows]);

  const exportXlsx = () => {
    const data = filtered.map((c) => ({
      "Nama": c.name, "No HP": c.phone || "", "Email": c.email || "", "Alamat": c.address || "", "Tanggal Lahir": c.birthday || "",
      "Gender": c.gender || "", "Kode Member": c.member_code || "", "Poin": c.points, "Cabang": c.branch_name || "",
      "Didaftarkan Oleh": c.registered_by_name || "", "Channel": CHANNEL[c.source_channel || ""] || c.source_channel || "",
      "Segmen": SEGMENT_LABEL[c.seg], "Jumlah Transaksi": c.order_count, "Total Belanja": c.total_spent,
      "Belanja 30 Hari": c.spent_30d, "Terakhir Belanja": c.last_order_at ? c.last_order_at.slice(0, 10) : "", "Terdaftar": c.created_at.slice(0, 10), "Catatan": c.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pelanggan");
    const d = new Date();
    XLSX.writeFile(wb, `pelanggan-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.xlsx`);
  };

  const sendBirthday = (c: Cust) => {
    const msg = `Halo ${c.name}! 🎉 Selamat ulang tahun dari Zeger Coffee. Ada hadiah spesial menantimu di outlet kami minggu ini ☕`;
    window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> CRM Pelanggan</h1>
          <p className="text-sm text-muted-foreground">Satu data pelanggan dari Kasir POS, Aplikasi Customer & Rider</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-2" />Import Excel</Button>
          <Button variant="outline" onClick={exportXlsx} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
          <Button variant="outline" onClick={() => setBlastOpen(true)} disabled={!filtered.length}><MessageCircle className="w-4 h-4 mr-2" />Kirim Promo</Button>
          <Button onClick={() => setOpenId("new")}><UserPlus className="w-4 h-4 mr-2" />Tambah</Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="data">Data Pelanggan</TabsTrigger></TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { l: "Total Pelanggan", v: kpi.total.toLocaleString("id-ID"), i: Users },
              { l: "Baru Bulan Ini", v: kpi.newMonth.toLocaleString("id-ID"), i: UserPlus },
              { l: "Aktif 30 Hari", v: kpi.active.toLocaleString("id-ID"), i: ShoppingBag },
              { l: "Total Lifetime Value", v: rp(kpi.ltv), i: Wallet },
              { l: "Rata-rata per Transaksi", v: rp(kpi.aov), i: Wallet },
            ].map((k) => (
              <Card key={k.l}><CardContent className="p-4">
                <k.i className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">{k.l}</p>
                <p className="text-xl font-bold">{loading ? "…" : k.v}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Segmen Pelanggan</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => (
                <button key={s} onClick={() => { setSeg(s); setTab("data"); }} className="rounded-xl border p-3 text-left hover:bg-accent transition-colors">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">{s === "vip" && <Crown className="w-3 h-3" />}{s === "at_risk" && <AlertTriangle className="w-3 h-3" />}{SEGMENT_LABEL[s]}</p>
                  <p className="text-2xl font-bold">{segCount[s] || 0}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Cake className="w-4 h-4 text-primary" />Ulang Tahun 7 Hari ke Depan</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {!birthdays.length && <p className="text-sm text-muted-foreground">Belum ada. Lengkapi tanggal lahir pelanggan.</p>}
                {birthdays.map(({ r, d }) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <button className="text-left min-w-0" onClick={() => setOpenId(r.id)}>
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{d === 0 ? "Hari ini 🎂" : `${d} hari lagi`} · {r.birthday?.slice(5)}</p>
                    </button>
                    {r.phone && <Button size="sm" variant="outline" onClick={() => sendBirthday(r)}><MessageCircle className="w-4 h-4 mr-1" />Ucapkan</Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-primary" />Top Pelanggan</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[...rows].sort((a, b) => b.total_spent - a.total_spent).slice(0, 6).map((r, i) => (
                  <button key={r.id} onClick={() => setOpenId(r.id)} className="w-full flex justify-between text-sm hover:bg-accent rounded-lg px-2 py-1">
                    <span className="truncate">{i + 1}. {r.name}</span><span className="font-semibold">{rp(r.total_spent)}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Store className="w-4 h-4 text-primary" />Akuisisi per Cabang</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {byBranch.map(([b, v]) => (
                  <div key={b} className="flex justify-between text-sm"><span className="truncate">{b}</span><span className="text-muted-foreground">{v.n} org · {rp(v.s)}</span></div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-3 mt-4">
          <Card><CardContent className="p-3 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari nama, No HP, email, kode member…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Select value={branch} onValueChange={setBranch}><SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua Cabang</SelectItem>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            <Select value={seg} onValueChange={(v) => setSeg(v as any)}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua Segmen</SelectItem>{(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>)}</SelectContent></Select>
          </CardContent></Card>
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>
                <th className="p-3">Pelanggan</th><th className="p-3">Cabang · Didaftarkan</th><th className="p-3">Segmen</th>
                <th className="p-3 text-right">Transaksi</th><th className="p-3 text-right">Total Belanja</th><th className="p-3 text-right">Poin</th><th className="p-3">Terakhir</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>}
                {!loading && !filtered.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Tidak ada pelanggan</td></tr>}
                {filtered.slice(0, 500).map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="border-t cursor-pointer hover:bg-accent/50">
                    <td className="p-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone || "-"}</p></td>
                    <td className="p-3"><p>{c.branch_name || "-"}</p><p className="text-xs text-muted-foreground">{c.registered_by_name || "-"} · {CHANNEL[c.source_channel || ""] || c.source_channel || "-"}</p></td>
                    <td className="p-3"><Badge variant={SEG_VARIANT[c.seg]}>{SEGMENT_LABEL[c.seg]}</Badge></td>
                    <td className="p-3 text-right">{c.order_count}</td>
                    <td className="p-3 text-right font-semibold">{rp(c.total_spent)}</td>
                    <td className="p-3 text-right">{c.points}</td>
                    <td className="p-3 text-xs">{dt(c.last_order_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && <p className="p-3 text-xs text-muted-foreground">Menampilkan 500 dari {filtered.length}. Gunakan pencarian/filter atau Export Excel.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <CustomerSheet id={openId} customer={rows.find((r) => r.id === openId) || null} branches={branches} onClose={() => setOpenId(null)} onSaved={load} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} branches={branches} onDone={load} />
      <BlastDialog open={blastOpen} onOpenChange={setBlastOpen} targets={filtered} />
    </main>
  );
}

function CustomerSheet({ id, customer, branches, onClose, onSaved }: { id: string | null; customer: Cust | null; branches: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({});
  const [hist, setHist] = useState<Hist[]>([]);
  const [loadingH, setLoadingH] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = id === "new";

  useEffect(() => {
    if (!id) return;
    setForm(customer ? { name: customer.name, phone: customer.phone || "", email: customer.email || "", address: customer.address || "", birthday: customer.birthday || "", gender: customer.gender || "", notes: customer.notes || "", branch_id: customer.branch_id || "" } : { name: "", phone: "" });
    setHist([]);
    if (!isNew) {
      setLoadingH(true);
      (supabase as any).rpc("crm_customer_history", { _customer: id }).then(({ data, error }: any) => {
        if (error) toast.error(error.message);
        setHist((data || []).map((h: any) => ({ ...h, amount: Number(h.amount) })));
        setLoadingH(false);
      });
    }
  }, [id]); // eslint-disable-line

  const favorites = useMemo(() => {
    const m: Record<string, number> = {};
    hist.forEach((h) => (h.items || []).forEach((i) => { if (i.name) m[i.name] = (m[i.name] || 0) + Number(i.qty || 0); }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [hist]);
  const monthly = useMemo(() => {
    const m: Record<string, { n: number; s: number }> = {};
    hist.forEach((h) => { const d = new Date(h.at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; m[k] = m[k] || { n: 0, s: 0 }; m[k].n++; m[k].s += h.amount; });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [hist]);
  const byChannel = useMemo(() => hist.reduce((a, h) => ({ ...a, [h.channel]: (a[h.channel] || 0) + h.amount }), {} as Record<string, number>), [hist]);

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Nama wajib diisi");
    setSaving(true);
    const { error } = await (supabase as any).rpc("crm_upsert_customer", { _id: isNew ? null : id, _data: form });
    setSaving(false);
    if (error) return toast.error("Gagal simpan: " + error.message);
    toast.success("Data pelanggan tersimpan");
    onSaved(); if (isNew) onClose();
  };
  const f = (k: string) => ({ value: form[k] || "", onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{isNew ? "Pelanggan Baru" : customer?.name}</SheetTitle></SheetHeader>
        {customer && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[["Total Belanja", rp(customer.total_spent)], ["Transaksi", customer.order_count], ["Rata-rata", rp(customer.order_count ? customer.total_spent / customer.order_count : 0)], ["Poin", customer.points]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="font-bold">{v}</p></div>
            ))}
          </div>
        )}
        {customer && (
          <p className="text-xs text-muted-foreground mt-3">
            Kode {customer.member_code || "-"} · Terdaftar {dt(customer.created_at)} di <b>{customer.branch_name || "-"}</b> oleh <b>{customer.registered_by_name || "-"}</b> via {CHANNEL[customer.source_channel || ""] || customer.source_channel || "-"} · Segmen {SEGMENT_LABEL[segmentOf(customer)]}
          </p>
        )}
        <Tabs defaultValue={isNew ? "profil" : "ringkasan"} className="mt-4">
          <TabsList>{!isNew && <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>}<TabsTrigger value="profil">Profil</TabsTrigger>{!isNew && <TabsTrigger value="riwayat">Riwayat ({hist.length})</TabsTrigger>}</TabsList>
          <TabsContent value="ringkasan" className="space-y-4 mt-3">
            {loadingH ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
              <div><p className="text-sm font-semibold mb-2">Menu Favorit</p>
                {!favorites.length && <p className="text-sm text-muted-foreground">Belum ada data item.</p>}
                {favorites.map(([n, q]) => <div key={n} className="flex justify-between text-sm py-0.5"><span>{n}</span><span className="text-muted-foreground">{q}×</span></div>)}</div>
              <div><p className="text-sm font-semibold mb-2">Belanja per Bulan</p>
                {monthly.map(([m, v]) => <div key={m} className="flex justify-between text-sm py-0.5"><span>{m}</span><span>{v.n} trx · <b>{rp(v.s)}</b></span></div>)}</div>
              <div><p className="text-sm font-semibold mb-2">Per Channel</p>
                {Object.entries(byChannel).map(([c, s]) => <div key={c} className="flex justify-between text-sm py-0.5"><span>{c}</span><b>{rp(s)}</b></div>)}</div>
            </>}
          </TabsContent>
          <TabsContent value="profil" className="space-y-3 mt-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs space-y-1">Nama<Input {...f("name")} /></label>
              <label className="text-xs space-y-1">No HP<Input {...f("phone")} inputMode="tel" /></label>
              <label className="text-xs space-y-1">Email<Input {...f("email")} type="email" /></label>
              <label className="text-xs space-y-1">Tanggal Lahir<Input {...f("birthday")} type="date" /></label>
              <label className="text-xs space-y-1">Gender
                <Select value={form.gender || "none"} onValueChange={(v) => setForm({ ...form, gender: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">-</SelectItem><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></label>
              <label className="text-xs space-y-1">Cabang
                <Select value={form.branch_id || "none"} onValueChange={(v) => setForm({ ...form, branch_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">-</SelectItem>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></label>
            </div>
            <label className="text-xs space-y-1 block">Alamat<Textarea {...f("address")} rows={2} /></label>
            <label className="text-xs space-y-1 block">Catatan (alergi, preferensi, dll)<Textarea {...f("notes")} rows={2} /></label>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Simpan</Button>
          </TabsContent>
          <TabsContent value="riwayat" className="space-y-2 mt-3">
            {loadingH && <Loader2 className="w-5 h-5 animate-spin" />}
            {!loadingH && !hist.length && <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>}
            {hist.map((h, i) => (
              <div key={i} className="rounded-xl border p-3">
                <div className="flex justify-between text-sm"><span className="font-medium">{h.ref}</span><b>{rp(h.amount)}</b></div>
                <p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString("id-ID")} · <Badge variant="outline" className="text-[10px]">{h.channel}</Badge> · {h.branch_name || "-"} · {h.payment || "-"}</p>
                {!!h.items?.length && <p className="text-xs mt-1">{h.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</p>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ImportDialog({ open, onOpenChange, branches, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; branches: { id: string; name: string }[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const template = () => {
    const ws = XLSX.utils.json_to_sheet([{ "Nama": "Budi Santoso", "No HP": "081234567890", "Email": "budi@email.com", "Alamat": "Jl. Kemiri 1", "Tanggal Lahir": "1995-08-17", "Gender": "L", "Cabang": branches[0]?.name || "", "Catatan": "" }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Pelanggan"); XLSX.writeFile(wb, "template-pelanggan.xlsx");
  };
  const pick = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const g = (r: any, ...keys: string[]) => { for (const k of Object.keys(r)) if (keys.some((x) => k.toLowerCase().startsWith(x))) return r[k]; return ""; };
    const toDate = (v: any) => {
      if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
      const s = String(v || "").trim(); const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
    };
    setRows(raw.map((r) => {
      const bn = String(g(r, "cabang", "branch")).trim().toLowerCase();
      return {
        name: String(g(r, "nama", "name")).trim(), phone: String(g(r, "no hp", "hp", "phone", "telepon")).trim(),
        email: String(g(r, "email")).trim(), address: String(g(r, "alamat", "address")).trim(), birthday: toDate(g(r, "tanggal lahir", "ulang", "birthday")),
        gender: String(g(r, "gender", "jenis")).trim().toUpperCase().slice(0, 1), notes: String(g(r, "catatan", "notes")).trim(),
        branch_id: branches.find((b) => b.name.toLowerCase() === bn)?.id || "", source_channel: "import",
      };
    }).filter((r) => r.name || r.phone));
  };
  const run = async () => {
    setBusy(true); let ok = 0, fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const { error } = await (supabase as any).rpc("crm_upsert_customer", { _id: null, _data: rows[i] });
      error ? fail++ : ok++; setProgress(i + 1);
    }
    setBusy(false); toast.success(`${ok} pelanggan tersimpan${fail ? `, ${fail} gagal` : ""}`);
    setRows([]); setProgress(0); onOpenChange(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Import Pelanggan dari Excel</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Kolom: Nama, No HP, Email, Alamat, Tanggal Lahir (YYYY-MM-DD), Gender (L/P), Cabang, Catatan. No HP yang sudah ada akan diperbarui, bukan dobel.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={template}><Download className="w-4 h-4 mr-2" />Download Template</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Pilih File</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </div>
        {!!rows.length && (
          <div className="max-h-64 overflow-auto border rounded-lg text-xs">
            <table className="w-full"><thead className="bg-muted/50"><tr><th className="p-2 text-left">Nama</th><th className="p-2 text-left">No HP</th><th className="p-2 text-left">Lahir</th><th className="p-2 text-left">Cabang</th></tr></thead>
              <tbody>{rows.slice(0, 100).map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.name}</td><td className="p-2">{r.phone}</td><td className="p-2">{r.birthday}</td><td className="p-2">{branches.find((b) => b.id === r.branch_id)?.name || "-"}</td></tr>)}</tbody></table>
          </div>
        )}
        <Button onClick={run} disabled={!rows.length || busy}>{busy ? `Menyimpan ${progress}/${rows.length}…` : `Import ${rows.length} pelanggan`}</Button>
      </DialogContent>
    </Dialog>
  );
}
