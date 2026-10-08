import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';

const db = supabase as any;
const S = { prod: 'Produk', mat: 'Bahan Baku', wip: 'Komposisi WIP', rec: 'Resep Menu' };
const H = {
  prod: ['Brand', 'Kategori Besar', 'Sub Kategori', 'Kode Menu', 'Nama Menu', 'Harga Jual', 'Deskripsi', 'Aktif (TRUE/FALSE)'],
  mat: ['Kode Bahan', 'Nama Bahan', 'Tipe (MENTAH/WIP)', 'Kategori', 'Satuan', 'Harga per Satuan', 'Stok Minimum', 'Hasil per Batch (WIP)'],
  wip: ['Nama Bahan WIP', 'Nama Bahan Penyusun', 'Takaran per Batch'],
  rec: ['Kode Menu', 'Nama Menu', 'Nama Bahan (Mentah/WIP)', 'Takaran per Porsi'],
};
const key = (s: any) => String(s ?? '').trim().toLowerCase();

const sheet = (wb: XLSX.WorkBook, name: string, head: string[], rows: any[][]) => {
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws['!cols'] = head.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, ws, name);
};

export const MasterExcelTab = ({ materials, reload }: { materials: any[]; reload: () => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const template = () => {
    const wb = XLSX.utils.book_new();
    sheet(wb, S.prod, H.prod, [['Zeger Coffee', 'Minuman', 'Espresso Based', 'KS-001', 'Aren Latte', 18000, 'Latte gula aren', 'TRUE']]);
    sheet(wb, S.mat, H.mat, [
      ['BK-01', 'Biji Kopi Arabica', 'MENTAH', 'Kopi', 'gr', 250, 1000, ''],
      ['AIR-01', 'Air Mineral', 'MENTAH', 'Umum', 'ml', 0.5, 0, ''],
      ['SU-01', 'Fresh Milk', 'MENTAH', 'Susu', 'ml', 20, 2000, ''],
      ['WIP-01', 'Espresso Shot', 'WIP', 'WIP', 'ml', 0, 0, 60],
    ]);
    sheet(wb, S.wip, H.wip, [['Espresso Shot', 'Biji Kopi Arabica', 15], ['Espresso Shot', 'Air Mineral', 60]]);
    sheet(wb, S.rec, H.rec, [['KS-001', 'Aren Latte', 'Espresso Shot', 30], ['KS-001', 'Aren Latte', 'Fresh Milk', 150]]);
    XLSX.writeFile(wb, 'Template_Master_Menu_BOM.xlsx');
  };

  const exportAll = async () => {
    const [p, w, r] = await Promise.all([
      db.from('products').select('*').order('name'),
      db.from('wip_components').select('*'),
      db.from('product_recipes').select('*'),
    ]);
    const mm = Object.fromEntries(materials.map((m) => [m.id, m]));
    const pm = Object.fromEntries((p.data || []).map((x: any) => [x.id, x]));
    const wb = XLSX.utils.book_new();
    sheet(wb, S.prod, H.prod, (p.data || []).map((x: any) => [x.brand || '', x.category || '', x.sub_category || '', x.code, x.name, x.price, x.description || '', x.is_active ? 'TRUE' : 'FALSE']));
    sheet(wb, S.mat, H.mat, materials.map((m) => [m.code || '', m.name, m.material_type === 'wip' ? 'WIP' : 'MENTAH', m.category, m.unit, m.cost_per_unit, m.min_stock, m.material_type === 'wip' ? m.yield_quantity : '']));
    sheet(wb, S.wip, H.wip, (w.data || []).filter((c: any) => mm[c.wip_id] && mm[c.material_id]).map((c: any) => [mm[c.wip_id].name, mm[c.material_id].name, c.quantity]));
    sheet(wb, S.rec, H.rec, (r.data || []).filter((c: any) => pm[c.product_id] && mm[c.material_id]).map((c: any) => [pm[c.product_id].code, pm[c.product_id].name, mm[c.material_id].name, c.quantity]));
    XLSX.writeFile(wb, 'Export_Master_Menu_BOM.xlsx');
  };

  const importFile = async (file: File) => {
    setBusy(true);
    const out: string[] = [];
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows = (name: string) => wb.Sheets[name] ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as any[][]).slice(1).filter((r) => r.some((c) => String(c).trim())) : [];

      // 1. Bahan baku
      const { data: mats0 } = await db.from('raw_materials').select('*');
      const mByName: Record<string, any> = Object.fromEntries((mats0 || []).map((m: any) => [key(m.name), m]));
      let mOk = 0;
      for (const r of rows(S.mat)) {
        const name = String(r[1]).trim(); if (!name) continue;
        const row = { code: String(r[0]).trim() || null, name, material_type: key(r[2]) === 'wip' ? 'wip' : 'raw', category: String(r[3]).trim() || 'Umum', unit: String(r[4]).trim() || 'gr', cost_per_unit: Number(r[5]) || 0, min_stock: Number(r[6]) || 0, yield_quantity: Number(r[7]) || 1, is_active: true };
        const ex = mByName[key(name)];
        const res = ex ? await db.from('raw_materials').update(row).eq('id', ex.id).select().single() : await db.from('raw_materials').insert(row).select().single();
        if (res.error) out.push(`Bahan "${name}": ${res.error.message}`); else { mByName[key(name)] = res.data; mOk++; }
      }
      // 2. Produk
      const { data: prods0 } = await db.from('products').select('id,code,name');
      const pByCode: Record<string, any> = Object.fromEntries((prods0 || []).map((p: any) => [key(p.code), p]));
      const pByName: Record<string, any> = Object.fromEntries((prods0 || []).map((p: any) => [key(p.name), p]));
      let pOk = 0;
      for (const r of rows(S.prod)) {
        const code = String(r[3]).trim(); const name = String(r[4]).trim();
        if (!code || !name) { out.push(`Produk tanpa kode/nama dilewati`); continue; }
        const row = { brand: String(r[0]).trim() || null, category: String(r[1]).trim() || null, sub_category: String(r[2]).trim() || null, code, name, price: Number(r[5]) || 0, description: String(r[6]).trim() || null, is_active: key(r[7]) !== 'false' };
        const ex = pByCode[key(code)];
        const res = ex ? await db.from('products').update(row).eq('id', ex.id).select('id,code,name').single() : await db.from('products').insert(row).select('id,code,name').single();
        if (res.error) out.push(`Produk "${name}": ${res.error.message}`); else { pByCode[key(code)] = res.data; pByName[key(name)] = res.data; pOk++; }
      }
      // 3. Komposisi WIP
      let wOk = 0; const touchedWip = new Set<string>();
      for (const r of rows(S.wip)) {
        const w = mByName[key(r[0])]; const m = mByName[key(r[1])];
        if (!w || w.material_type !== 'wip') { out.push(`WIP "${r[0]}" tidak ditemukan / bukan WIP`); continue; }
        if (!m) { out.push(`Bahan "${r[1]}" tidak ditemukan`); continue; }
        const { error } = await db.from('wip_components').upsert({ wip_id: w.id, material_id: m.id, quantity: Number(r[2]) || 0 }, { onConflict: 'wip_id,material_id' });
        if (error) out.push(`Komposisi ${r[0]}: ${error.message}`); else { wOk++; touchedWip.add(w.id); }
      }
      // HPP WIP otomatis
      for (const wid of touchedWip) {
        const { data: cs } = await db.from('wip_components').select('*').eq('wip_id', wid);
        const byId = Object.fromEntries(Object.values(mByName).map((m: any) => [m.id, m]));
        const cost = (cs || []).reduce((s: number, c: any) => s + Number(c.quantity) * Number(byId[c.material_id]?.cost_per_unit || 0), 0) / (Number(byId[wid]?.yield_quantity) || 1);
        await db.from('raw_materials').update({ cost_per_unit: cost }).eq('id', wid);
      }
      // 4. Resep menu
      let rOk = 0;
      for (const r of rows(S.rec)) {
        const p = pByCode[key(r[0])] || pByName[key(r[1])]; const m = mByName[key(r[2])];
        if (!p) { out.push(`Menu "${r[1] || r[0]}" tidak ditemukan`); continue; }
        if (!m) { out.push(`Bahan "${r[2]}" tidak ditemukan`); continue; }
        const { error } = await db.from('product_recipes').upsert({ product_id: p.id, material_id: m.id, quantity: Number(r[3]) || 0 }, { onConflict: 'product_id,material_id' });
        if (error) out.push(`Resep ${r[1]}: ${error.message}`); else rOk++;
      }
      toast.success(`Import selesai: ${pOk} produk, ${mOk} bahan, ${wOk} komposisi WIP, ${rOk} baris resep`);
      reload();
    } catch (e: any) {
      out.push(e.message || String(e));
      toast.error('Gagal membaca file Excel');
    }
    setLog(out); setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Import / Export Excel: Produk, Bahan, WIP & Resep</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Satu file Excel berisi 4 sheet: <b>Produk</b> (Brand → Kategori Besar → Sub Kategori → Menu), <b>Bahan Baku</b> (Mentah / WIP), <b>Komposisi WIP</b>, dan <b>Resep Menu</b>. Data yang sudah ada dicocokkan lewat Kode Menu dan Nama Bahan, lalu diperbarui.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={template}><Download className="h-4 w-4 mr-1" />Download Template</Button>
          <Button variant="outline" onClick={exportAll}><Download className="h-4 w-4 mr-1" />Export Data Saat Ini</Button>
          <Button onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="h-4 w-4 mr-1" />{busy ? 'Mengimpor…' : 'Import Excel'}</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </div>
        {log.length > 0 && (
          <div className="rounded-lg border border-destructive/40 p-3 text-sm max-h-60 overflow-auto">
            <p className="font-medium mb-1">{log.length} baris perlu dicek:</p>
            {log.map((l, i) => <p key={i} className="text-muted-foreground">• {l}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
