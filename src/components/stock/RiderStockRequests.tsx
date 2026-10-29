import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CupStickerButton } from "./CupStickerPrint";
import { latestShiftLeftover } from "@/lib/rider-leftover";
import { Bell, History, Minus, Pencil, Plus, Send, Trash2, Truck } from "lucide-react";

const db = supabase as any;
const STATUS: Record<string, { label: string; v: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu Hub", v: "secondary" },
  adjusted: { label: "Disesuaikan Hub", v: "outline" },
  transferred: { label: "Dikirim — konfirmasi terima di Stok", v: "default" },
  cancelled: { label: "Dibatalkan", v: "destructive" },
  rejected: { label: "Ditolak", v: "destructive" },
};
const rp = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");

function useRequests(filter: Record<string, string>, deps: any[], productFields = "name, cost_price") {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    let q = db.from("rider_stock_requests")
      .select(`*, rider:profiles!rider_stock_requests_rider_id_fkey(full_name), items:rider_stock_request_items(*, product:products(${productFields}))`)
      .order("created_at", { ascending: false }).limit(50);
    Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
    const { data, error } = await q;
    if (error) toast.error(error.message); else setRows(data || []);
  };
  useEffect(() => {
    if (Object.values(filter).some((v) => !v)) return;
    load();
    const ch = supabase.channel("rsr-" + Object.values(filter).join("-"))
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_stock_requests" }, (p: any) => {
        if (p.eventType === "INSERT" && filter.hub_branch_id) toast.info("Order stok baru dari rider!");
        load();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { rows, load };
}

const itemQty = (i: any) => Number(i.approved_qty ?? i.requested_qty ?? 0);
const orderQty = (r: any) => (r.items || []).reduce((s: number, i: any) => s + itemQty(i), 0);
const orderHpp = (r: any) => (r.items || []).reduce((s: number, i: any) => s + itemQty(i) * Number(i.product?.cost_price || 0), 0);
function groupByDay(rows: any[]): [string, any[]][] {
  const m = new Map<string, any[]>();
  rows.forEach((r) => { const k = new Date(r.created_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" }); m.set(k, [...(m.get(k) || []), r]); });
  return Array.from(m.entries());
}

/** Rider (On The Wheels): order menu jadi ke Branch Hub / Central Kitchen */
export function RiderStockRequestForm() {
  const { userProfile } = useAuth() as any;
  const [hubs, setHubs] = useState<any[]>([]);
  const [hubId, setHubId] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { rows, load } = useRequests({ rider_id: userProfile?.id }, [userProfile?.id], "name, cost_price");

  useEffect(() => {
    db.from("branches").select("id,name,branch_type").eq("branch_type", "hub").eq("is_active", true).then(({ data }: any) => {
      setHubs(data || []);
      setHubId(userProfile?.branch_id && data?.some((b: any) => b.id === userProfile.branch_id) ? userProfile.branch_id : data?.[0]?.id || "");
    });
    db.from("products").select("id,name,category,sub_category,brand,cost_price").eq("is_active", true).order("name").then(({ data }: any) => {
      const list = data || [];
      setProducts(list);
      setBrand((cur) => cur || list.map((p: any) => p.brand).find((b: string) => b && /on\s*the\s*wheel/i.test(b)) || "__all");
    });
  }, [userProfile?.branch_id]);

  const [brand, setBrand] = useState("");
  const catOf = (p: any) => p.sub_category || p.category || "Lainnya";
  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort() as string[], [products]);
  const brandProducts = useMemo(() => !brand || brand === "__all" ? products : products.filter((p) => p.brand === brand), [products, brand]);
  const categories = useMemo(() => Array.from(new Set(brandProducts.map(catOf))).sort() as string[], [brandProducts]);
  const [cats, setCats] = useState<string[]>([]);
  const list = useMemo(() => (search ? products : brandProducts).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) && (!!search || !cats.length || cats.includes(catOf(p)))
  ), [products, brandProducts, search, cats]);
  const toggleCat = (c: string) => setCats((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]);
  const picked = Object.entries(qty).filter(([, q]) => q > 0);
  const set = (id: string, d: number) => setQty((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) + d) }));

  const submit = async () => {
    if (!hubId || !picked.length) return toast.error("Pilih hub dan minimal 1 menu");
    setBusy(true);
    const { data: req, error } = await db.from("rider_stock_requests")
      .insert({ rider_id: userProfile.id, hub_branch_id: hubId, status: "pending", notes: notes || null }).select("id").single();
    if (!error) {
      const { error: e2 } = await db.from("rider_stock_request_items")
        .insert(picked.map(([product_id, q]) => ({ request_id: req.id, product_id, requested_qty: q })));
      if (e2) toast.error(e2.message); else { toast.success("Order terkirim ke Hub"); setQty({}); setNotes(""); load(); }
    } else toast.error(error.message);
    setBusy(false);
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-5 w-5 text-primary" />Order Stok ke Central Kitchen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="w-full rounded-md border bg-background p-2 text-sm" value={hubId} onChange={(e) => setHubId(e.target.value)}>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <Input placeholder="Cari menu (semua brand)…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {brands.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...brands, "__all"].map((b) => (
                <Button key={b} type="button" size="sm" variant={brand === b ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => { setBrand(b); setCats([]); }}>
                  {b === "__all" ? "Semua Brand" : b}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-2">
            {categories.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={cats.includes(c)} onChange={() => toggleCat(c)} />
                {c}
              </label>
            ))}
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {list.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{[p.brand, catOf(p)].filter(Boolean).join(" · ")} • HPP {rp(Number(p.cost_price))}/cup</p>{(qty[p.id] || 0) > 0 && <p className="text-xs font-semibold text-primary">Subtotal HPP {rp((qty[p.id] || 0) * Number(p.cost_price || 0))}</p>}</div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => set(p.id, -1)}><Minus className="h-4 w-4" /></Button>
                  <span className="w-6 text-center text-sm font-semibold">{qty[p.id] || 0}</span>
                  <Button size="icon" className="h-8 w-8" onClick={() => set(p.id, 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <Textarea placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button className="w-full" disabled={busy || !picked.length} onClick={submit}><Send className="mr-2 h-4 w-4" />Kirim Order ({picked.reduce((s, [, q]) => s + q, 0)} item • Total HPP {rp(picked.reduce((s, [id, q]) => s + q * Number(products.find((p) => p.id === id)?.cost_price || 0), 0))})</Button>
        </CardContent>
      </Card>
      <h3 className="font-semibold">Riwayat Order</h3>
      {groupByDay(rows).map(([day, list]) => {
        const valid = list.filter((r: any) => !["cancelled", "rejected"].includes(r.status));
        const dq = valid.reduce((s: number, r: any) => s + orderQty(r), 0);
        const dh = valid.reduce((s: number, r: any) => s + orderHpp(r), 0);
        return (
          <div key={day} className="space-y-2">
            <div className="rounded-lg bg-muted p-2 text-xs">
              <p className="font-semibold">{day}</p>
              <p>Total order: {valid.length} kali • {dq} cup • Total HPP {rp(dh)}</p>
            </div>
            {[...list].reverse().map((r: any, idx: number) => (
              <Card key={r.id}><CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Order #{idx + 1} — {new Date(r.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                  <Badge variant={STATUS[r.status]?.v}>{STATUS[r.status]?.label || r.status}</Badge>
                </div>
                {r.items.map((i: any) => {
                  const q = itemQty(i); const h = Number(i.product?.cost_price || 0);
                  return (
                    <div key={i.id} className="flex justify-between gap-2 text-sm">
                      <span className={q === 0 ? "line-through text-muted-foreground" : ""}>{i.product?.name}
                        <span className="block text-xs text-muted-foreground">{i.approved_qty != null && i.approved_qty !== i.requested_qty ? <><s>{i.requested_qty}</s> → </> : null}{q} × {rp(h)}</span>
                      </span>
                      <span className="font-medium">{rp(q * h)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t pt-2 text-sm"><span>{orderQty(r)} cup</span><b>Total HPP {rp(orderHpp(r))}</b></div>
                {r.hub_notes && <p className="text-xs text-muted-foreground">Hub: {r.hub_notes}</p>}
                {r.status === "pending" && <Button size="sm" variant="outline" onClick={async () => { await db.from("rider_stock_requests").update({ status: "cancelled" }).eq("id", r.id); load(); }}>Batalkan</Button>}
              </CardContent></Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Branch Hub / Central Kitchen: antrean order rider — 1 tabel per rider, kolom Sisa | Order 1..n | Total */
export function HubRiderRequestQueue({ branchId }: { branchId?: string }) {
  const { userProfile } = useAuth() as any;
  const hub = branchId || userProfile?.branch_id;
  const [tab, setTab] = useState<"open" | "done" | "manual">("open")
  const [mq, setMq] = useState<Record<string, number>>({});
  const [mRider, setMRider] = useState("");
  const [mSearch, setMSearch] = useState("");;
  const { rows, load } = useRequests({ hub_branch_id: hub }, [hub], "name, ck_price, cost_price, price, short_name, shelf_life_days");
  const [edit, setEdit] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const open = rows.filter((r) => ["pending", "adjusted"].includes(r.status));
  const [products, setProducts] = useState<any[]>([]);
  const [add, setAdd] = useState<Record<string, { pid: string; qty: number }>>({});
  useEffect(() => {
    db.from("products").select("id, name, category, price, short_name, shelf_life_days").eq("is_active", true).order("name").then(({ data }: any) => setProducts(data || []));
  }, []);
  const addMenu = async (reqs: any[]) => {
    const rid = reqs[0].rider_id; const a = add[rid];
    if (!a?.pid || !(a.qty > 0)) return toast.error("Pilih menu dan jumlahnya");
    const target = reqs[reqs.length - 1];
    const it = target.items.find((i: any) => i.product_id === a.pid);
    const res = it
      ? await db.from("rider_stock_request_items").update({ approved_qty: q(it) + a.qty }).eq("id", it.id)
      : await db.from("rider_stock_request_items").insert({ request_id: target.id, product_id: a.pid, requested_qty: 0, approved_qty: a.qty });
    if (res.error) return toast.error(res.error.message);
    await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", target.id);
    setAdd((s) => ({ ...s, [rid]: { pid: "", qty: 1 } }));
    toast.success("Menu ditambahkan"); load();
  };
  const done = rows.filter((r) => !["pending", "adjusted"].includes(r.status));
  const tm = (d: string) => new Date(d).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

  // group open orders per rider, oldest first
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    open.forEach((r) => m.set(r.rider_id, [...(m.get(r.rider_id) || []), r]));
    return Array.from(m.values()).map((arr) => arr.sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, [open]);

  // Sisa stok = stok kembali pada shift terakhir rider (sama dengan Rincian Per Shift di Stock Card Rider)
  const [leftover, setLeftover] = useState<Record<string, Record<string, { qty: number; name: string; product: any }>>>({});
  const loadLeftover = async (riderId: string, _before: string) => {
    // Read complete days, not a row-limited set of shifts that can split one day.
    const { data: recent, error: recentError } = await db.from("shift_management")
      .select("shift_date").eq("rider_id", riderId)
      .order("shift_date", { ascending: false }).limit(10);
    if (recentError) return toast.error(recentError.message);
    if (!recent?.length) {
      setLeftover((s) => ({ ...s, [riderId]: {} }));
      return toast.info("Rider belum punya shift");
    }
    const days = Array.from(new Set(recent.map((s: any) => s.shift_date))) as string[];
    for (const day of days) {
      const readPages = async (query: () => any) => {
        const rows: any[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await query().range(offset, offset + 499);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < 500) return rows;
        }
      };
      try {
        const [shifts, movements, waste] = await Promise.all([
          readPages(() => db.from("shift_management")
            .select("id, rider_id, shift_date, shift_number, shift_start_time, shift_end_time")
            .eq("rider_id", riderId).eq("shift_date", day).order("id")),
          readPages(() => db.from("stock_movements")
            .select("product_id, quantity, notes, created_at, products(name, cost_price, price, ck_price, short_name, shelf_life_days)")
            .eq("rider_id", riderId).in("movement_type", ["return", "out"])
            .gte("created_at", `${day}T00:00:00+07:00`).lte("created_at", `${day}T23:59:59.999999+07:00`).order("id")),
          readPages(() => db.from("product_waste").select("product_id, quantity, created_at")
            .eq("rider_id", riderId)
            .gte("created_at", `${day}T00:00:00+07:00`).lte("created_at", `${day}T23:59:59.999999+07:00`).order("id")),
        ]);
        const result = latestShiftLeftover(shifts, movements, waste);
        if (!result) continue;
        setLeftover((s) => ({ ...s, [riderId]: result.items }));
        return Object.keys(result.items).length
          ? toast.success(`Sisa stok shift #${result.shift.shift_number} (${day}) ditambahkan`)
          : toast.info(`Sisa stok shift #${result.shift.shift_number} (${day}) sudah habis`);
      } catch (error: any) {
        return toast.error(error.message || "Sisa stok gagal dimuat. Coba lagi.");
      }
    }
    setLeftover((s) => ({ ...s, [riderId]: {} }));
    toast.info("Tidak ada stok kembali di shift sebelumnya — isi manual lewat ikon pensil");
  };

  const [sisaEdit, setSisaEdit] = useState("");
  const setSisa = (rid: string, l: any, qty: number) => setLeftover((s) => {
    const cur = { ...(s[rid] || {}) };
    if (!(qty > 0)) delete cur[l.product_id];
    else cur[l.product_id] = { qty: Math.floor(qty), name: l.name, product: l.product };
    return { ...s, [rid]: cur };
  });
  const q = (i: any) => Number(edit[i.id] ?? i.approved_qty ?? i.requested_qty ?? 0);
  const buildLines = (reqs: any[]) => {
    const lo = leftover[reqs[0].rider_id] || {};
    const m = new Map<string, { product_id: string; name: string; product: any; sisa: number; per: Record<string, any> }>();
    const ensure = (pid: string, name: string, product: any) => {
      if (!m.has(pid)) m.set(pid, { product_id: pid, name, product, sisa: 0, per: {} });
      return m.get(pid)!;
    };
    reqs.forEach((r) => r.items.forEach((i: any) => { ensure(i.product_id, i.product?.name, i.product).per[r.id] = i; }));
    Object.entries(lo).forEach(([pid, v]) => { ensure(pid, v.name, v.product).sisa = v.qty; });
    return Array.from(m.values()).map((l) => ({ ...l, total: l.sisa + reqs.reduce((s, r) => s + (l.per[r.id] ? q(l.per[r.id]) : 0), 0) }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  };

  const saveAll = async (reqs: any[]) => {
    for (const r of reqs) {
      const changed = r.items.filter((i: any) => edit[i.id] != null);
      for (const i of changed) await db.from("rider_stock_request_items").update({ approved_qty: edit[i.id] }).eq("id", i.id);
      if (changed.length) await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", r.id);
    }
  };
  const removeItem = async (r: any, id: string) => {
    await db.from("rider_stock_request_items").update({ approved_qty: 0 }).eq("id", id);
    await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", r.id); load();
  };

  const fulfillAll = async (reqs: any[]) => {
    const rid = reqs[0].rider_id; setBusy(rid);
    await saveAll(reqs);
    // sisa stok ditambahkan ke order pertama, supaya ikut terkirim
    const first = reqs[0]; const lo = leftover[rid] || {};
    for (const [pid, v] of Object.entries(lo)) {
      if (!v.qty) continue;
      const it = first.items.find((i: any) => i.product_id === pid);
      const res = it
        ? await db.from("rider_stock_request_items").update({ approved_qty: q(it) + v.qty }).eq("id", it.id)
        : await db.from("rider_stock_request_items").insert({ request_id: first.id, product_id: pid, requested_qty: 0, approved_qty: v.qty });
      if (res.error) { setBusy(""); return toast.error(res.error.message); }
    }
    if (Object.keys(lo).length) await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", first.id);
    for (const r of reqs) {
      const { error } = await db.rpc("fulfill_rider_stock_request", { _request_id: r.id });
      if (error) { setBusy(""); toast.error(error.message); load(); return; }
    }
    setBusy(""); setEdit({}); setLeftover((s) => ({ ...s, [rid]: {} }));
    toast.success("Stok dikirim ke rider"); load();
  };

  if (!hub) return <p className="p-4 text-sm text-muted-foreground">Akun ini belum terhubung ke Branch Hub.</p>;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-5 w-5 text-primary" />Order Stok dari Rider {open.length > 0 && <Badge variant="destructive">{open.length}</Badge>}</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={tab === "open" ? "default" : "outline"} onClick={() => setTab("open")}>Antrean</Button>
          <Button size="sm" variant={tab === "done" ? "default" : "outline"} onClick={() => setTab("done")}>Riwayat</Button>
          <Button size="sm" variant={tab === "manual" ? "default" : "outline"} onClick={() => setTab("manual")}>Cetak Manual</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tab === "open" && !groups.length && <p className="text-sm text-muted-foreground">Tidak ada order.</p>}
        {tab === "open" && groups.map((reqs) => {
          const rid = reqs[0].rider_id;
          const L = buildLines(reqs);
          const hasSisa = !!leftover[rid];
          const hpp = L.reduce((s, l) => s + l.total * Number(l.product?.cost_price || 0), 0);
          const ck = L.reduce((s, l) => s + l.total * (Number(l.product?.ck_price) || Number(l.product?.cost_price) || 0), 0);
          const hasEdit = reqs.some((r) => r.items.some((i: any) => edit[i.id] != null));
          return (
            <div key={rid} className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold">{reqs[0].rider?.full_name}</p><p className="text-xs text-muted-foreground">{reqs.length} order belum dikirim</p></div>
                <Button size="sm" className="btn-glossy-primary" onClick={() => loadLeftover(rid, reqs[0].created_at)}>
                  <History className="mr-1 h-4 w-4" />Tambahkan Sisa Stok Shift Sebelumnya
                </Button>
              </div>
              {reqs.filter((r) => r.notes).map((r, i) => <p key={r.id} className="text-xs">Catatan order {reqs.indexOf(r) + 1}: {r.notes}</p>)}
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-sm [&_tbody_td]:border-b">
                  <thead className="table-head-raised">
                    <tr className="text-xs">
                      <th className="p-2 text-left">Menu</th>
                      <th className="p-2 text-center">Sisa Stok{!hasSisa && <span className="block font-normal">(klik tombol)</span>}</th>
                      {reqs.map((r, i) => <th key={r.id} className="p-2 text-center">Order {i + 1}<span className="block font-normal">{tm(r.created_at)} WIB</span></th>)}
                      <th className="p-2 text-center">Total Kirim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {L.map((l) => (
                      <tr key={l.product_id} className="border-b">
                        <td className={"p-2 " + (l.total === 0 ? "line-through text-muted-foreground" : "")}>{l.name}</td>
                        <td className="p-1 text-center">{sisaEdit === `${rid}:${l.product_id}` ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input autoFocus type="number" min={0} className="h-8 w-14 text-center" defaultValue={l.sisa}
                              onBlur={(e) => { setSisa(rid, l, Number(e.target.value)); setSisaEdit(""); }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                          </div>
                        ) : l.sisa ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-8">{l.sisa}</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit sisa stok" onClick={() => setSisaEdit(`${rid}:${l.product_id}`)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Hapus sisa stok" onClick={() => setSisa(rid, l, 0)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Isi sisa stok" onClick={() => setSisaEdit(`${rid}:${l.product_id}`)}><Pencil className="h-3.5 w-3.5 opacity-50" /></Button>
                        )}</td>
                        {reqs.map((r) => {
                          const it = l.per[r.id];
                          return <td key={r.id} className="p-1 text-center">{it ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input type="number" min={0} className="h-8 w-14 text-center" value={q(it)} onChange={(e) => setEdit((s) => ({ ...s, [it.id]: Math.max(0, Number(e.target.value)) }))} />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(r, it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : "-"}</td>;
                        })}
                        <td className="p-2 text-center font-bold">{l.total}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-bold">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-center">{L.reduce((s, l) => s + l.sisa, 0)}</td>
                      {reqs.map((r) => <td key={r.id} className="p-2 text-center">{r.items.reduce((s: number, i: any) => s + q(i), 0)}</td>)}
                      <td className="p-2 text-center">{L.reduce((s, l) => s + l.total, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
                <span className="text-xs font-semibold">Tambah menu (Hub):</span>
                <select className="h-8 min-w-[180px] flex-1 rounded-md border bg-background px-2 text-sm" value={add[rid]?.pid || ""} onChange={(e) => setAdd((s) => ({ ...s, [rid]: { pid: e.target.value, qty: s[rid]?.qty || 1 } }))}>
                  <option value="">Pilih menu…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.category ? ` — ${p.category}` : ""}</option>)}
                </select>
                <Input type="number" min={1} className="h-8 w-16 text-center" value={add[rid]?.qty ?? 1} onChange={(e) => setAdd((s) => ({ ...s, [rid]: { pid: s[rid]?.pid || "", qty: Math.max(1, Number(e.target.value)) } }))} />
                <Button size="sm" onClick={() => addMenu(reqs)}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span className="text-sm">Total HPP Menu: <b>{rp(hpp)}</b><span className="block text-xs text-muted-foreground">Nilai transfer (harga CK, internal): {rp(ck)}</span></span>
                <div className="flex flex-wrap gap-2">
                  <CupStickerButton rider={reqs[0].rider?.full_name || "Rider"} items={L.map((l) => ({ name: l.product?.name || l.name, short_name: l.product?.short_name, price: l.product?.price, shelf_life_days: l.product?.shelf_life_days, qty: l.total }))} />
                  <Button size="sm" variant="outline" onClick={async () => { for (const r of reqs) await db.from("rider_stock_requests").update({ status: "rejected" }).eq("id", r.id); load(); }}>Tolak</Button>
                  {hasEdit && <Button size="sm" variant="outline" onClick={async () => { await saveAll(reqs); setEdit({}); load(); }}>Simpan</Button>}
                  <Button size="sm" disabled={busy === rid} onClick={() => fulfillAll(reqs)}><Truck className="mr-1 h-4 w-4" />Kirim Stok</Button>
                </div>
              </div>
            </div>
          );
        })}
        {tab === "done" && !done.length && <p className="text-sm text-muted-foreground">Tidak ada order.</p>}
        {tab === "done" && (() => {
          const dk = (d: string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
          const m = new Map<string, any[]>();
          done.forEach((r) => { const k = r.rider_id + "|" + dk(r.created_at); m.set(k, [...(m.get(k) || []), r]); });
          return Array.from(m.values()).map((arr) => {
            const reqs = [...arr].sort((a, b) => a.created_at.localeCompare(b.created_at));
            const sent = reqs.filter((r) => r.status === "transferred");
            // sisa stok tercatat sebagai item dengan requested_qty 0 (ditambahkan Hub) atau selisih approved - requested pada order pertama
            const lines = new Map<string, { name: string; product: any; sisa: number; per: Record<string, number> }>();
            reqs.forEach((r, idx) => r.items.forEach((i: any) => {
              const l = lines.get(i.product_id) || { name: i.product?.name, product: i.product, sisa: 0, per: {} };
              const appr = itemQty(i); const reqd = Number(i.requested_qty || 0);
              if (idx === 0 && r.status === "transferred" && i.approved_qty != null && appr > reqd) { l.sisa += appr - reqd; l.per[r.id] = reqd; }
              else l.per[r.id] = appr;
              lines.set(i.product_id, l);
            }));
            const L = Array.from(lines.values()).map((l) => ({ ...l, total: l.sisa + reqs.reduce((s, r) => s + (r.status === "transferred" ? (l.per[r.id] || 0) : 0), 0) }))
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            const hpp = L.reduce((s, l) => s + l.total * Number(l.product?.cost_price || 0), 0);
            return (
              <div key={reqs[0].id} className="space-y-2 rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-semibold">{reqs[0].rider?.full_name}</p><p className="text-xs text-muted-foreground">{new Date(reqs[0].created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short", year: "numeric" })} • {reqs.length} order</p></div>
                  <div className="flex flex-wrap gap-1">{reqs.map((r, i) => <Badge key={r.id} variant={STATUS[r.status]?.v}>Order {i + 1}: {STATUS[r.status]?.label}</Badge>)}</div>
                </div>
                {reqs.filter((r) => r.notes).map((r) => <p key={r.id} className="text-xs">Catatan order {reqs.indexOf(r) + 1}: {r.notes}</p>)}
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-sm [&_tbody_td]:border-b">
                    <thead className="table-head-raised">
                      <tr className="text-xs">
                        <th className="p-2 text-left">Menu</th>
                        <th className="p-2 text-center">Sisa Stok</th>
                        {reqs.map((r, i) => <th key={r.id} className="p-2 text-center">Order {i + 1}<span className="block font-normal">{tm(r.created_at)} WIB</span></th>)}
                        <th className="p-2 text-center">Total Kirim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {L.map((l) => (
                        <tr key={l.name}>
                          <td className="p-2">{l.name}</td>
                          <td className="p-2 text-center">{l.sisa || "-"}</td>
                          {reqs.map((r) => <td key={r.id} className={"p-2 text-center " + (r.status !== "transferred" ? "line-through text-muted-foreground" : "")}>{l.per[r.id] ?? "-"}</td>)}
                          <td className="p-2 text-center font-bold">{l.total}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-bold">
                        <td className="p-2">Total</td>
                        <td className="p-2 text-center">{L.reduce((s, l) => s + l.sisa, 0)}</td>
                        {reqs.map((r) => <td key={r.id} className="p-2 text-center">{L.reduce((s, l) => s + (l.per[r.id] || 0), 0)}</td>)}
                        <td className="p-2 text-center">{L.reduce((s, l) => s + l.total, 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                  <b>Total HPP {rp(hpp)}</b>
                  {sent.length > 0 && <CupStickerButton rider={reqs[0].rider?.full_name || "Rider"} items={L.filter((l) => l.total > 0).map((l) => ({ name: l.product?.name || l.name, short_name: l.product?.short_name, price: l.product?.price, shelf_life_days: l.product?.shelf_life_days, qty: l.total }))} />}
                </div>
              </div>
            );
          });
        })()}
        {tab === "manual" && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Nama rider / label (opsional)" value={mRider} onChange={(e) => setMRider(e.target.value)} />
              <Input placeholder="Cari menu…" value={mSearch} onChange={(e) => setMSearch(e.target.value)} />
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {products.filter((p) => p.name.toLowerCase().includes(mSearch.toLowerCase())).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category} • {rp(Number(p.price))} • H+{p.shelf_life_days || 3}</p></div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMq((s) => ({ ...s, [p.id]: Math.max(0, (s[p.id] || 0) - 1) }))}><Minus className="h-4 w-4" /></Button>
                    <Input type="number" min={0} className="h-8 w-14 text-center" value={mq[p.id] || 0} onChange={(e) => setMq((s) => ({ ...s, [p.id]: Math.max(0, Number(e.target.value)) }))} />
                    <Button size="icon" className="h-8 w-8" onClick={() => setMq((s) => ({ ...s, [p.id]: (s[p.id] || 0) + 1 }))}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t pt-2">
              <Button size="sm" variant="outline" onClick={() => setMq({})}>Reset</Button>
              <CupStickerButton rider={mRider || "Zeger"} items={products.filter((p) => (mq[p.id] || 0) > 0).map((p) => ({ name: p.name, short_name: p.short_name, price: p.price, shelf_life_days: p.shelf_life_days, qty: mq[p.id] }))} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
