import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Layers, X } from "lucide-react";

type Scope = "all" | "brand" | "category" | "sub_category" | "product";
interface Opt { name: string; price: number }
interface Group {
  id?: string; name: string; required: boolean; multi: boolean; options: Opt[];
  default_option: string | null; scope_type: Scope; scope_values: string[]; sort_order: number; is_active: boolean;
}
interface Prod { id: string; code: string; name: string; brand: string | null; category: string | null; sub_category: string | null }

const SCOPES: { v: Scope; l: string }[] = [
  { v: "all", l: "Semua Menu" }, { v: "brand", l: "Per Brand" }, { v: "category", l: "Per Kategori Besar" },
  { v: "sub_category", l: "Per Sub Kategori" }, { v: "product", l: "Menu Tertentu" },
];
const PRESETS: Omit<Group, "sort_order">[] = [
  { name: "Size Cup", required: true, multi: false, default_option: "Regular", scope_type: "all", scope_values: [], is_active: true, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 5000 }] },
  { name: "Size Botol", required: true, multi: false, default_option: "200 ml", scope_type: "all", scope_values: [], is_active: true, options: [{ name: "200 ml", price: 0 }, { name: "1 Liter", price: 60000 }] },
  { name: "Ice Level", required: false, multi: false, default_option: "Normal Ice", scope_type: "all", scope_values: [], is_active: true, options: [{ name: "Normal Ice", price: 0 }, { name: "Less Ice", price: 0 }, { name: "No Ice", price: 0 }] },
  { name: "Sugar Level", required: true, multi: false, default_option: "Normal Sugar", scope_type: "all", scope_values: [], is_active: true, options: [{ name: "Normal Sugar", price: 0 }, { name: "Less Sugar", price: 0 }, { name: "No Sugar", price: 0 }] },
  { name: "Topping", required: false, multi: true, default_option: null, scope_type: "all", scope_values: [], is_active: true, options: [{ name: "Extra Shot", price: 4000 }, { name: "Boba", price: 4000 }] },
];
const empty: Group = { name: "", required: false, multi: false, options: [{ name: "", price: 0 }], default_option: null, scope_type: "all", scope_values: [], sort_order: 0, is_active: true };
const rp = (n: number) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export default function VariantManagement() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [form, setForm] = useState<Group | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [g, p] = await Promise.all([
      supabase.from("menu_modifier_groups" as any).select("*").order("sort_order").order("name"),
      supabase.from("products").select("id, code, name, brand, category, sub_category").eq("is_active", true).order("name"),
    ]);
    if (g.error) toast.error("Gagal memuat varian: " + g.error.message);
    setGroups((g.data || []) as any);
    setProducts((p.data || []) as any);
  };
  useEffect(() => { load(); }, []);

  const values = useMemo(() => {
    const uniq = (k: keyof Prod) => Array.from(new Set(products.map((p) => p[k]).filter(Boolean))).sort() as string[];
    return { brand: uniq("brand"), category: uniq("category"), sub_category: uniq("sub_category") };
  }, [products]);

  const countFor = (g: Group) => {
    const v = g.scope_values.map((x) => x.toLowerCase());
    return products.filter((p) => {
      if (g.scope_type === "all") return true;
      if (g.scope_type === "product") return g.scope_values.includes(p.id);
      return v.includes(String(p[g.scope_type] || "").toLowerCase());
    }).length;
  };

  const save = async () => {
    if (!form) return;
    const options = form.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 }));
    if (!form.name.trim()) return toast.error("Nama grup wajib diisi");
    if (!options.length) return toast.error("Minimal satu pilihan");
    if (form.scope_type !== "all" && !form.scope_values.length) return toast.error("Pilih target penerapan");
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), options, scope_values: form.scope_type === "all" ? [] : form.scope_values,
      default_option: form.default_option && options.some((o) => o.name === form.default_option) ? form.default_option : null };
    delete (payload as any).id;
    const q = form.id
      ? supabase.from("menu_modifier_groups" as any).update(payload).eq("id", form.id)
      : supabase.from("menu_modifier_groups" as any).insert({ ...payload, sort_order: groups.length });
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message.includes("duplicate") ? "Nama grup sudah dipakai" : error.message);
    toast.success("Varian tersimpan");
    setForm(null); load();
  };

  const remove = async (g: Group) => {
    if (!confirm(`Hapus grup varian "${g.name}"?`)) return;
    const { error } = await supabase.from("menu_modifier_groups" as any).delete().eq("id", g.id!);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleActive = async (g: Group) => {
    await supabase.from("menu_modifier_groups" as any).update({ is_active: !g.is_active }).eq("id", g.id!);
    load();
  };

  const setOpt = (i: number, patch: Partial<Opt>) => form && setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const toggleVal = (v: string) => form && setForm({ ...form, scope_values: form.scope_values.includes(v) ? form.scope_values.filter((x) => x !== v) : [...form.scope_values, v] });
  const choices: { v: string; l: string }[] = !form || form.scope_type === "all" ? [] :
    form.scope_type === "product" ? products.map((p) => ({ v: p.id, l: `${p.name} (${p.code})` })) :
    values[form.scope_type].map((x) => ({ v: x, l: x }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6 text-primary" /> Varian Menu</h1>
          <p className="text-sm text-muted-foreground">Atur Size, Ice Level, Sugar Level, Topping sekali, lalu terapkan ke semua menu, brand, kategori, atau menu tertentu.</p>
        </div>
        <Button onClick={() => setForm({ ...empty, options: [{ name: "", price: 0 }] })}><Plus className="h-4 w-4 mr-1" /> Grup Varian</Button>
      </div>

      {groups.length === 0 && (
        <Card><CardContent className="py-6 space-y-3">
          <p className="text-sm text-muted-foreground">Belum ada varian. Mulai cepat dari contoh di bawah, lalu ubah sesuai menu Anda:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <Button key={p.name} variant="outline" size="sm" onClick={() => setForm({ ...p, sort_order: 0 })}>+ {p.name}</Button>)}
          </div>
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id} className={g.is_active ? "" : "opacity-60"}>
            <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{g.name}</CardTitle>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary">{g.multi ? "Pilih banyak" : "Pilih satu"}</Badge>
                  {g.required && <Badge>Wajib</Badge>}
                  <Badge variant="outline">{SCOPES.find((s) => s.v === g.scope_type)?.l} · {countFor(g)} menu</Badge>
                </div>
              </div>
              <Switch checked={g.is_active} onCheckedChange={() => toggleActive(g)} />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {g.options.map((o) => (
                  <span key={o.name} className="text-xs rounded-full border px-2 py-0.5">
                    {o.name}{g.default_option === o.name ? " ✓" : ""}{Number(o.price) ? ` +${rp(o.price)}` : ""}
                  </span>
                ))}
              </div>
              {g.scope_type !== "all" && g.scope_type !== "product" && <p className="text-xs text-muted-foreground">Untuk: {g.scope_values.join(", ")}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setForm({ ...g, options: g.options.length ? g.options : [{ name: "", price: 0 }] })}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(g)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card><CardContent className="py-4 text-sm text-muted-foreground space-y-1">
        <p><b className="text-foreground">Urutan kerja yang disarankan:</b> 1) buat grup varian di sini, 2) download template Excel di Produk / Menu — sudah ada sheet "Referensi Varian", 3) isi kolom "Grup Varian" hanya untuk menu yang berbeda dari aturan otomatis.</p>
        <p>Kalau kolom "Grup Varian" di sebuah menu diisi, menu itu memakai grup tersebut saja (mengabaikan aturan otomatis).</p>
      </CardContent></Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Edit" : "Tambah"} Grup Varian</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div><Label>Nama grup</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Size Cup" /></div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} /> Wajib dipilih</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.multi} onCheckedChange={(v) => setForm({ ...form, multi: v })} /> Boleh pilih banyak</label>
              </div>
              <div className="space-y-2">
                <Label>Pilihan & tambahan harga</Label>
                {form.options.map((o, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="flex-1" value={o.name} placeholder="Large / 1 Liter / Less Sugar" onChange={(e) => setOpt(i, { name: e.target.value })} />
                    <Input className="w-28" type="number" value={o.price} onChange={(e) => setOpt(i, { price: Number(e.target.value) })} />
                    {!form.multi && (
                      <Button type="button" size="sm" variant={form.default_option === o.name && o.name ? "default" : "outline"} onClick={() => setForm({ ...form, default_option: o.name })}>Default</Button>
                    )}
                    <Button type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, { name: "", price: 0 }] })}><Plus className="h-3.5 w-3.5 mr-1" />Pilihan</Button>
              </div>
              <div className="space-y-2">
                <Label>Terapkan ke</Label>
                <Select value={form.scope_type} onValueChange={(v) => setForm({ ...form, scope_type: v as Scope, scope_values: [] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
                {form.scope_type !== "all" && (
                  <div className="max-h-48 overflow-y-auto rounded-md border p-2 flex flex-wrap gap-1.5">
                    {choices.length === 0 && <p className="text-xs text-muted-foreground">Belum ada data. Isi dulu brand/kategori di Produk / Menu.</p>}
                    {choices.map((c) => (
                      <button key={c.v} type="button" onClick={() => toggleVal(c.v)}
                        className={`text-xs rounded-full border px-2.5 py-1 ${form.scope_values.includes(c.v) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                        {c.l}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Berlaku untuk {countFor({ ...form })} menu.</p>
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
