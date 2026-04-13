import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { ProductBulkUpload } from "@/components/master/ProductBulkUpload";

interface Product {
  id: string;
  name: string;
  code: string;
  category: string | null;
  price: number;
  cost_price: number | null;
  ck_price: number | null;
  description: string | null;
  image_url: string | null;
  custom_options: any;
  is_active: boolean | null;
  created_at: string | null;
}

const emptyForm = {
  name: "",
  code: "",
  category: "",
  price: 0,
  cost_price: 0,
  ck_price: 0,
  description: "",
  image_url: "",
  custom_options: "",
  is_active: true,
};

const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      toast.error("Gagal memuat produk: " + error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const generateCode = (name: string) => {
    const prefix = name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase())
      .join("")
      .slice(0, 4);
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${prefix}-${rand}`;
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      code: product.code,
      category: product.category || "",
      price: product.price,
      cost_price: product.cost_price || 0,
      ck_price: product.ck_price || 0,
      description: product.description || "",
      image_url: product.image_url || "",
      custom_options: product.custom_options ? JSON.stringify(product.custom_options, null, 2) : "",
      is_active: product.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error("Nama dan Code wajib diisi");
      return;
    }
    setSaving(true);

    let customOpts = null;
    if (form.custom_options.trim()) {
      try {
        customOpts = JSON.parse(form.custom_options);
      } catch {
        toast.error("Custom Options bukan JSON yang valid");
        setSaving(false);
        return;
      }
    }

    const payload = {
      name: form.name,
      code: form.code,
      category: form.category || null,
      price: form.price,
      cost_price: form.cost_price || null,
      ck_price: form.ck_price || null,
      description: form.description || null,
      image_url: form.image_url || null,
      custom_options: customOpts,
      is_active: form.is_active,
    };

    if (editingProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) {
        toast.error("Gagal update produk: " + error.message);
      } else {
        toast.success("Produk berhasil diupdate");
        setDialogOpen(false);
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        toast.error("Gagal tambah produk: " + error.message);
      } else {
        toast.success("Produk berhasil ditambahkan");
        setDialogOpen(false);
        fetchProducts();
      }
    }
    setSaving(false);
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (error) {
      toast.error("Gagal update status: " + error.message);
    } else {
      toast.success(`Produk ${!product.is_active ? "diaktifkan" : "dinonaktifkan"}`);
      fetchProducts();
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Hapus produk "${product.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error("Gagal hapus produk: " + error.message);
    } else {
      toast.success("Produk berhasil dihapus");
      fetchProducts();
    }
  };

  const formatRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Data Master - Produk
          </h1>
          <p className="text-muted-foreground text-sm">Kelola semua produk dari sini</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Produk
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama atau kode..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Product Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Produk ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Harga Jual</TableHead>
                    <TableHead className="text-right">HPP</TableHead>
                    <TableHead className="text-right">HPP CK</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.category || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatRp(p.price)}</TableCell>
                      <TableCell className="text-right">{p.cost_price ? formatRp(p.cost_price) : "-"}</TableCell>
                      <TableCell className="text-right">{p.ck_price ? formatRp(p.ck_price) : "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={p.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleActive(p)}
                        >
                          {p.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Tidak ada produk ditemukan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama Produk *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      ...(editingProduct ? {} : { code: generateCode(name) }),
                    }));
                  }}
                  placeholder="Nama produk"
                />
              </div>
              <div className="space-y-2">
                <Label>Kode Produk *</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="Kode produk" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Contoh: Coffee, Snack, Can Series"
                list="category-list"
              />
              <datalist id="category-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Harga Jual (Rp)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>HPP / Cost Price (Rp)</Label>
                <Input type="number" value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>HPP CK (Rp)</Label>
                <Input type="number" value={form.ck_price} onChange={(e) => setForm((f) => ({ ...f, ck_price: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Deskripsi produk" />
            </div>

            <div className="space-y-2">
              <Label>URL Foto Produk</Label>
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              {form.image_url && (
                <img src={form.image_url} alt="Preview" className="w-20 h-20 rounded-lg object-cover mt-1" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Custom Options (JSON, opsional)</Label>
              <Textarea
                value={form.custom_options}
                onChange={(e) => setForm((f) => ({ ...f, custom_options: e.target.value }))}
                placeholder='{"sugar": ["normal", "less"], "ice": ["normal", "less", "no ice"]}'
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>Produk Aktif</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : editingProduct ? "Update" : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManagement;
