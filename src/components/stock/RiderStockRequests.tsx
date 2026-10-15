import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bell, Minus, Plus, Send, Trash2, Truck } from "lucide-react";

const db = supabase as any;
const STATUS: Record<string, { label: string; v: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu Hub", v: "secondary" },
  adjusted: { label: "Disesuaikan Hub", v: "outline" },
  transferred: { label: "Dikirim — konfirmasi terima di Stok", v: "default" },
  cancelled: { label: "Dibatalkan", v: "destructive" },
  rejected: { label: "Ditolak", v: "destructive" },
};
const rp = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");

function useRequests(filter: Record<string, string>, deps: any[]) {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    let q = db.from("rider_stock_requests")
      .select("*, rider:profiles!rider_stock_requests_rider_id_fkey(full_name), items:rider_stock_request_items(*, product:products(name, ck_price, cost_price))")
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
  const { rows, load } = useRequests({ rider_id: userProfile?.id }, [userProfile?.id]);

  useEffect(() => {
    db.from("branches").select("id,name,branch_type").eq("branch_type", "hub").eq("is_active", true).then(({ data }: any) => {
      setHubs(data || []);
      setHubId(userProfile?.branch_id && data?.some((b: any) => b.id === userProfile.branch_id) ? userProfile.branch_id : data?.[0]?.id || "");
    });
    db.from("products").select("id,name,category,ck_price").eq("is_active", true).order("name").then(({ data }: any) => setProducts(data || []));
  }, [userProfile?.branch_id]);

  const list = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const picked = Object.entries(qty).filter(([, q]) => q > 0);
  const set = (id: string, d: number) => setQty((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) + d) }));

  const submit = async () => {
    if (!hubId || !picked.length) return toast.error("Pilih hub dan minimal 1 menu");
    setBusy(true);
    const { data: req, error } = await db.from("rider_stock_requests")
      .insert({ rider_id: userProfile.id, hub_branch_id: hubId, notes: notes || null }).select("id").single();
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
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {list.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => set(p.id, -1)}><Minus className="h-4 w-4" /></Button>
                  <span className="w-6 text-center text-sm font-semibold">{qty[p.id] || 0}</span>
                  <Button size="icon" className="h-8 w-8" onClick={() => set(p.id, 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <Textarea placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button className="w-full" disabled={busy || !picked.length} onClick={submit}><Send className="mr-2 h-4 w-4" />Kirim Order ({picked.reduce((s, [, q]) => s + q, 0)} item)</Button>
        </CardContent>
      </Card>
      <h3 className="font-semibold">Riwayat Order</h3>
      {rows.map((r) => (
        <Card key={r.id}><CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</span><Badge variant={STATUS[r.status]?.v}>{STATUS[r.status]?.label || r.status}</Badge></div>
          {r.items.map((i: any) => (
            <div key={i.id} className="flex justify-between text-sm"><span>{i.product?.name}</span>
              <span>{i.approved_qty != null && i.approved_qty !== i.requested_qty ? <><s className="text-muted-foreground">{i.requested_qty}</s> → {i.approved_qty}</> : i.requested_qty}</span></div>
          ))}
          {r.hub_notes && <p className="text-xs text-muted-foreground">Hub: {r.hub_notes}</p>}
          {r.status === "pending" && <Button size="sm" variant="outline" onClick={async () => { await db.from("rider_stock_requests").update({ status: "cancelled" }).eq("id", r.id); load(); }}>Batalkan</Button>}
        </CardContent></Card>
      ))}
    </div>
  );
}

/** Branch Hub / Central Kitchen: antrean order rider */
export function HubRiderRequestQueue({ branchId }: { branchId?: string }) {
  const { userProfile } = useAuth() as any;
  const hub = branchId || userProfile?.branch_id;
  const [tab, setTab] = useState<"open" | "done">("open");
  const { rows, load } = useRequests({ hub_branch_id: hub }, [hub]);
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
  const fulfill = async (r: any) => {
    setBusy(r.id);
    if (Object.keys(edit).length) await saveQty(r);
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
              {r.items.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={i.approved_qty === 0 ? "line-through text-muted-foreground" : ""}>{i.product?.name} <span className="text-xs text-muted-foreground">(minta {i.requested_qty})</span></span>
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} className="h-8 w-16" value={edit[i.id] ?? i.approved_qty ?? i.requested_qty} onChange={(e) => setEdit((s) => ({ ...s, [i.id]: Math.max(0, Number(e.target.value)) }))} />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeItem(r, i.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : <span>{i.approved_qty ?? i.requested_qty}</span>}
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span className="text-sm">Nilai transfer (harga CK): <b>{rp(r.status === "transferred" ? r.total_transfer_value : total)}</b></span>
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
