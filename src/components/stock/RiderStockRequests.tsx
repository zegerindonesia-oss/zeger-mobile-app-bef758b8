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
import { Bell, History, Minus, Plus, Send, Trash2, Truck } from "lucide-react";

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
    db.from("products").select("id,name,category,cost_price").eq("is_active", true).order("name").then(({ data }: any) => setProducts(data || []));
  }, [userProfile?.branch_id]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort() as string[], [products]);
  const [cats, setCats] = useState<string[]>(["Espresso Based", "Milk Based", "Refresher", "Refreshers"]);
  const list = useMemo(() => products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) && (search || cats.includes(p.category))
  ), [products, search, cats]);
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
          <Input placeholder="Cari menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category} • HPP {rp(Number(p.cost_price))}/cup</p>{(qty[p.id] || 0) > 0 && <p className="text-xs font-semibold text-primary">Subtotal HPP {rp((qty[p.id] || 0) * Number(p.cost_price || 0))}</p>}</div>
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

/** Branch Hub / Central Kitchen: antrean order rider */
export function HubRiderRequestQueue({ branchId }: { branchId?: string }) {
  const { userProfile } = useAuth() as any;
  const hub = branchId || userProfile?.branch_id;
  const [tab, setTab] = useState<"open" | "done">("open");
  const { rows, load } = useRequests({ hub_branch_id: hub }, [hub], "name, ck_price, cost_price, price, short_name, shelf_life_days");
  const [edit, setEdit] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const open = rows.filter((r) => ["pending", "adjusted"].includes(r.status));
  const shown = tab === "open" ? open : rows.filter((r) => !["pending", "adjusted"].includes(r.status));

  const saveQty = async (r: any) => {
    for (const i of r.items) if (edit[i.id] != null) await db.from("rider_stock_request_items").update({ approved_qty: edit[i.id] }).eq("id", i.id);
    await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", r.id);
    setEdit({}); load();
  };
  const removeItem = async (r: any, id: string) => {
    await db.from("rider_stock_request_items").update({ approved_qty: 0 }).eq("id", id);
    await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", r.id); load();
  };
  // Sisa stok shift sebelumnya: per request -> { product_id: { qty, name } }
  const [leftover, setLeftover] = useState<Record<string, Record<string, { qty: number; name: string; product: any }>>>({});
  const loadLeftover = async (r: any) => {
    const { data, error } = await db.from("stock_movements")
      .select("product_id, quantity, created_at, products(name, cost_price, price, ck_price, short_name, shelf_life_days)")
      .eq("rider_id", r.rider_id).eq("movement_type", "return")
      .lt("created_at", r.created_at).order("created_at", { ascending: false }).limit(300);
    if (error) { toast.error(error.message); return; }
    if (!data?.length) { toast.info("Tidak ada sisa stok shift sebelumnya"); setLeftover((s) => ({ ...s, [r.id]: {} })); return; }
    const day = (d: string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const lastDay = day(data[0].created_at);
    const map: Record<string, { qty: number; name: string; product: any }> = {};
    for (const m of data) if (day(m.created_at) === lastDay) {
      const cur = map[m.product_id] || { qty: 0, name: m.products?.name, product: m.products };
      cur.qty += Number(m.quantity || 0); map[m.product_id] = cur;
    }
    setLeftover((s) => ({ ...s, [r.id]: map }));
    toast.success(`Sisa stok shift ${lastDay} ditambahkan`);
  };
  const lines = (r: any) => {
    const lo = leftover[r.id] || {};
    const out: { key: string; product_id: string; name: string; product: any; order: number; sisa: number; item?: any }[] = r.items.map((i: any) => ({
      key: i.id, product_id: i.product_id, name: i.product?.name, product: i.product, item: i,
      order: Number(edit[i.id] ?? i.approved_qty ?? i.requested_qty), sisa: lo[i.product_id]?.qty || 0,
    }));
    for (const [pid, v] of Object.entries(lo)) if (!out.some((l) => l.product_id === pid)) out.push({ key: pid, product_id: pid, name: v.name, product: v.product, order: 0, sisa: v.qty });
    return out;
  };

  const fulfill = async (r: any) => {
    setBusy(r.id);
    if (Object.keys(edit).length) await saveQty(r);
    const lo = leftover[r.id];
    if (lo && Object.keys(lo).length) {
      for (const l of lines(r)) {
        if (!l.sisa) continue;
        const total = l.order + l.sisa;
        const res = l.item
          ? await db.from("rider_stock_request_items").update({ approved_qty: total }).eq("id", l.item.id)
          : await db.from("rider_stock_request_items").insert({ request_id: r.id, product_id: l.product_id, requested_qty: 0, approved_qty: total });
        if (res.error) { setBusy(""); toast.error(res.error.message); return; }
      }
      await db.from("rider_stock_requests").update({ status: "adjusted" }).eq("id", r.id);
    }
    const { error } = await db.rpc("fulfill_rider_stock_request", { _request_id: r.id });
    setBusy("");
    if (error) toast.error(error.message); else { toast.success("Stok dikirim ke rider"); load(); }
  };

  if (!hub) return <p className="p-4 text-sm text-muted-foreground">Akun ini belum terhubung ke Branch Hub.</p>;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-5 w-5 text-primary" />Order Stok dari Rider {open.length > 0 && <Badge variant="destructive">{open.length}</Badge>}</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={tab === "open" ? "default" : "outline"} onClick={() => setTab("open")}>Antrean</Button>
          <Button size="sm" variant={tab === "done" ? "default" : "outline"} onClick={() => setTab("done")}>Riwayat</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!shown.length && <p className="text-sm text-muted-foreground">Tidak ada order.</p>}
        {shown.map((r) => {
          const editable = ["pending", "adjusted"].includes(r.status);
          const total = r.items.reduce((s: number, i: any) => s + (edit[i.id] ?? i.approved_qty ?? i.requested_qty) * (Number(i.product?.ck_price) || Number(i.product?.cost_price) || 0), 0);
          return (
            <div key={r.id} className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold">{r.rider?.full_name}</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</p></div>
                <Badge variant={STATUS[r.status]?.v}>{STATUS[r.status]?.label}</Badge>
              </div>
              {r.notes && <p className="text-xs">Catatan rider: {r.notes}</p>}
              {editable && (
                <Button size="sm" variant="outline" className="w-full border-dashed" onClick={() => loadLeftover(r)}>
                  <History className="mr-1 h-4 w-4" />Tambahkan Sisa Stok Shift Sebelumnya
                </Button>
              )}
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-xs font-semibold text-muted-foreground">Menu</span>
                <span className="text-xs font-semibold text-muted-foreground text-center">Sisa</span>
                <span className="text-xs font-semibold text-muted-foreground text-center">Order</span>
                <span className="text-xs font-semibold text-muted-foreground text-center">Total Kirim</span>
                {lines(r).map((l) => (
                  <div key={l.key} className="contents">
                    <span className={l.item?.approved_qty === 0 && !l.sisa ? "line-through text-muted-foreground" : ""}>{l.name} {l.item && <span className="text-xs text-muted-foreground">(minta {l.item.requested_qty})</span>}</span>
                    <span className="text-center">{l.sisa || "-"}</span>
                    {editable && l.item ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} className="h-8 w-16" value={edit[l.item.id] ?? l.item.approved_qty ?? l.item.requested_qty} onChange={(e) => setEdit((s) => ({ ...s, [l.item.id]: Math.max(0, Number(e.target.value)) }))} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeItem(r, l.item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ) : <span className="text-center">{l.order}</span>}
                    <span className="text-center font-bold">{l.order + l.sisa}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span className="text-sm">Total HPP Menu: <b>{rp(orderHpp(r))}</b><span className="block text-xs text-muted-foreground">Nilai transfer (harga CK, internal): {rp(r.status === "transferred" ? r.total_transfer_value : total)}</span></span>
                <CupStickerButton rider={r.rider?.full_name || "Rider"} items={lines(r).map((l) => ({ name: l.product?.name || l.name, short_name: l.product?.short_name, price: l.product?.price, shelf_life_days: l.product?.shelf_life_days, qty: l.order + l.sisa }))} />
                {editable && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={async () => { await db.from("rider_stock_requests").update({ status: "rejected" }).eq("id", r.id); load(); }}>Tolak</Button>
                    {Object.keys(edit).length > 0 && <Button size="sm" variant="outline" onClick={() => saveQty(r)}>Simpan</Button>}
                    <Button size="sm" disabled={busy === r.id} onClick={() => fulfill(r)}><Truck className="mr-1 h-4 w-4" />Kirim Stok</Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
