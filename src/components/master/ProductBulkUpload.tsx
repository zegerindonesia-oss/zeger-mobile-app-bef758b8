import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

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
}

interface ParsedRow {
  name: string;
  code: string;
  category: string;
  price: number;
  cost_price: number;
  ck_price: number;
  description: string;
  image_url: string;
  custom_options: string;
  is_active: boolean;
  _status?: "ok" | "error" | "duplicate" | "not_found";
  _message?: string;
}

interface ProductBulkUploadProps {
  products: Product[];
  onComplete: () => void;
}

const TEMPLATE_COLUMNS = [
  "name",
  "code",
  "category",
  "price",
  "cost_price",
  "ck_price",
  "description",
  "image_url",
  "custom_options",
  "is_active",
];

const TEMPLATE_HEADERS = [
  "Nama Produk",
  "Kode Produk",
  "Kategori",
  "Harga Jual",
  "HPP (Cost Price)",
  "HPP CK",
  "Deskripsi",
  "URL Foto",
  "Custom Options (JSON)",
  "Aktif (TRUE/FALSE)",
];

export const ProductBulkUpload = ({ products, onComplete }: ProductBulkUploadProps) => {
  const [mode, setMode] = useState<"add" | "update" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = (type: "add" | "update") => {
    const wb = XLSX.utils.book_new();

    if (type === "add") {
      const data = [TEMPLATE_HEADERS, ["Contoh Kopi Susu", "KS-001", "Coffee", 15000, 8000, 6000, "Kopi susu signature", "https://example.com/foto.jpg", "", "TRUE"]];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, "Template Menu Baru");
    } else {
      const data = [
        TEMPLATE_HEADERS,
        ...products.map((p) => [
          p.name,
          p.code,
          p.category || "",
          p.price,
          p.cost_price || 0,
          p.ck_price || 0,
          p.description || "",
          p.image_url || "",
          p.custom_options ? JSON.stringify(p.custom_options) : "",
          p.is_active ? "TRUE" : "FALSE",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, "Data Produk");
    }

    const filename = type === "add" ? "Template_Menu_Baru.xlsx" : "Data_Produk_Update.xlsx";
    XLSX.writeFile(wb, filename);
    toast.success(`Template ${filename} berhasil didownload`);
  };

  const handleFileSelect = (type: "add" | "update") => {
    setMode(type);
    fileRef.current?.click();
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          toast.error("File kosong atau hanya berisi header");
          return;
        }

        const headerRow = rows[0].map((h: any) => String(h).trim());
        const dataRows = rows.slice(1).filter((r) => r.some((c: any) => c !== undefined && c !== ""));

        // Map headers to field names
        const headerMap: Record<string, string> = {};
        TEMPLATE_HEADERS.forEach((h, i) => {
          headerMap[h.toLowerCase()] = TEMPLATE_COLUMNS[i];
        });
        // Also accept raw column names
        TEMPLATE_COLUMNS.forEach((c) => {
          headerMap[c.toLowerCase()] = c;
        });

        const colIndices: Record<string, number> = {};
        headerRow.forEach((h: string, i: number) => {
          const key = headerMap[h.toLowerCase()];
          if (key) colIndices[key] = i;
        });

        const parsed: ParsedRow[] = dataRows.map((row) => {
          const get = (field: string) => {
            const idx = colIndices[field];
            return idx !== undefined ? row[idx] : undefined;
          };

          const name = String(get("name") || "").trim();
          const code = String(get("code") || "").trim();
          const isActiveRaw = String(get("is_active") || "TRUE").toUpperCase();

          const item: ParsedRow = {
            name,
            code,
            category: String(get("category") || "").trim(),
            price: Number(get("price")) || 0,
            cost_price: Number(get("cost_price")) || 0,
            ck_price: Number(get("ck_price")) || 0,
            description: String(get("description") || "").trim(),
            image_url: String(get("image_url") || "").trim(),
            custom_options: String(get("custom_options") || "").trim(),
            is_active: isActiveRaw === "TRUE" || isActiveRaw === "1" || isActiveRaw === "YA",
          };

          // Validate
          if (!name || !code) {
            item._status = "error";
            item._message = "Nama dan Kode wajib diisi";
          } else if (mode === "add") {
            const exists = products.find((p) => p.code.toLowerCase() === code.toLowerCase());
            if (exists) {
              item._status = "duplicate";
              item._message = `Kode "${code}" sudah ada di database`;
            } else {
              item._status = "ok";
            }
          } else {
            const exists = products.find((p) => p.code.toLowerCase() === code.toLowerCase());
            if (!exists) {
              item._status = "not_found";
              item._message = `Kode "${code}" tidak ditemukan di database`;
            } else {
              item._status = "ok";
            }
          }

          // Validate custom_options JSON
          if (item.custom_options && item._status === "ok") {
            try {
              JSON.parse(item.custom_options);
            } catch {
              item._status = "error";
              item._message = "Custom Options bukan JSON valid";
            }
          }

          return item;
        });

        setPreviewData(parsed);
        setDialogOpen(true);
      } catch (err) {
        toast.error("Gagal membaca file. Pastikan format Excel (.xlsx) valid.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  const handleUpload = async () => {
    const validRows = previewData.filter((r) => r._status === "ok");
    if (validRows.length === 0) {
      toast.error("Tidak ada data valid untuk diupload");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    if (mode === "add") {
      const payloads = validRows.map((r) => ({
        name: r.name,
        code: r.code,
        category: r.category || null,
        price: r.price,
        cost_price: r.cost_price || null,
        ck_price: r.ck_price || null,
        description: r.description || null,
        image_url: r.image_url || null,
        custom_options: r.custom_options ? JSON.parse(r.custom_options) : null,
        is_active: r.is_active,
      }));

      // Insert in batches of 50
      for (let i = 0; i < payloads.length; i += 50) {
        const batch = payloads.slice(i, i + 50);
        const { error } = await supabase.from("products").insert(batch);
        if (error) {
          errorCount += batch.length;
          console.error("Batch insert error:", error);
        } else {
          successCount += batch.length;
        }
      }
    } else {
      // Update mode - update one by one by code
      for (const r of validRows) {
        const payload: any = {
          name: r.name,
          category: r.category || null,
          price: r.price,
          cost_price: r.cost_price || null,
          ck_price: r.ck_price || null,
          description: r.description || null,
          image_url: r.image_url || null,
          custom_options: r.custom_options ? JSON.parse(r.custom_options) : null,
          is_active: r.is_active,
        };

        const { error } = await supabase.from("products").update(payload).eq("code", r.code);
        if (error) {
          errorCount++;
          console.error(`Update error for ${r.code}:`, error);
        } else {
          successCount++;
        }
      }
    }

    setUploading(false);
    setDialogOpen(false);
    setPreviewData([]);

    if (errorCount === 0) {
      toast.success(`${successCount} produk berhasil ${mode === "add" ? "ditambahkan" : "diupdate"}`);
    } else {
      toast.warning(`${successCount} berhasil, ${errorCount} gagal`);
    }
    onComplete();
  };

  const okCount = previewData.filter((r) => r._status === "ok").length;
  const errorCount = previewData.filter((r) => r._status !== "ok").length;

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload Massal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Menu Baru */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Upload Menu Baru</h4>
              <p className="text-xs text-muted-foreground">Tambah produk baru secara massal dari file Excel</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate("add")} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download Template
                </Button>
                <Button size="sm" onClick={() => handleFileSelect("add")} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload File
                </Button>
              </div>
            </div>

            {/* Upload Perubahan Menu */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Upload Perubahan Menu</h4>
              <p className="text-xs text-muted-foreground">Edit produk yang sudah ada secara massal (berdasarkan Kode Produk)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate("update")} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download Data
                </Button>
                <Button size="sm" onClick={() => handleFileSelect("update")} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload File
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "Preview Upload Menu Baru" : "Preview Perubahan Menu"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-3 mb-4">
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {okCount} Valid
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> {errorCount} Error
              </Badge>
            )}
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Status</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">HPP</TableHead>
                  <TableHead className="text-right">HPP CK</TableHead>
                  <TableHead>Foto URL</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, i) => (
                  <TableRow key={i} className={row._status !== "ok" ? "bg-destructive/5" : ""}>
                    <TableCell>
                      {row._status === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="text-sm">{row.name}</TableCell>
                    <TableCell className="text-sm">{row.category || "-"}</TableCell>
                    <TableCell className="text-right text-sm">{row.price.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right text-sm">{row.cost_price.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right text-sm">{row.ck_price.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{row.image_url || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "default" : "secondary"} className="text-xs">
                        {row.is_active ? "Ya" : "Tidak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-destructive">{row._message || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpload} disabled={uploading || okCount === 0}>
              {uploading ? "Mengupload..." : `${mode === "add" ? "Tambah" : "Update"} ${okCount} Produk`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
