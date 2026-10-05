import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, TestTube2, ChefHat, Receipt, Sticker } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  PrintSettings, PrinterConfig, PrinterRole, loadPrintSettings, savePrintSettings, newPrinter,
  printHtml, renderKitchenTicket, renderReceipt, renderStickers,
} from '@/lib/pos-printing';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  branchId: string | null;
  userId?: string;
  onSaved?: (s: PrintSettings) => void;
}

const roleMeta: Record<PrinterRole, { label: string; icon: any }> = {
  receipt: { label: 'Struk Kasir', icon: Receipt },
  kitchen: { label: 'Tiket Dapur / Bar', icon: ChefHat },
  sticker: { label: 'Stiker Cup', icon: Sticker },
};

export const POSPrinterSettings = ({ open, onOpenChange, branchId, userId, onSaved }: Props) => {
  const [s, setS] = useState<PrintSettings | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; category: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    loadPrintSettings(branchId).then(setS);
    supabase.from('products').select('id,name,category').eq('is_active', true).order('name')
      .then(({ data }) => setProducts((data as any) || []));
  }, [open, branchId]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );

  if (!s) return null;
  const upd = (id: string, patch: Partial<PrinterConfig>) =>
    setS({ ...s, printers: s.printers.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const testPrint = (p: PrinterConfig) => {
    const now = new Date().toISOString();
    const items = [{ product_name: 'Aren Latte', qty: 1, price: 18000, subtotal: 18000, notes: 'Ice, Less Sugar' }];
    if (p.role === 'receipt') printHtml(renderReceipt({ transaction_number: 'TEST-001', branch_name: 'TES PRINTER', kasir_name: 'Kasir', created_at: now, order_type: 'take_away', items, subtotal: 18000, discount: 0, service_charge: 0, tax: 0, total: 18000, payment_method_1: 'cash', amount_1: 20000, change_amount: 2000 }, s, p.paper));
    else if (p.role === 'sticker') printHtml(renderStickers({ station: p.name, ref: 'TEST-001', order_type: 'take_away', created_at: now, customer_name: 'Budi', items }));
    else printHtml(renderKitchenTicket({ station: p.name, ref: 'TEST-001', order_type: 'take_away', created_at: now, items }, p.paper));
  };

  const save = async () => {
    if (!branchId) return toast.error('Cabang tidak ditemukan');
    setSaving(true);
    try {
      await savePrintSettings(branchId, s, userId);
      toast.success('Pengaturan printer tersimpan');
      onSaved?.(s);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> Pengaturan Printer</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Teks atas struk</Label><Input value={s.receiptHeader} placeholder="Alamat / No. WA" onChange={(e) => setS({ ...s, receiptHeader: e.target.value })} /></div>
          <div><Label>Teks bawah struk</Label><Input value={s.receiptFooter} onChange={(e) => setS({ ...s, receiptFooter: e.target.value })} /></div>
        </div>

        <div className="space-y-3">
          {s.printers.map((p) => {
            const Icon = roleMeta[p.role].icon;
            const q = (search[p.id] || '').toLowerCase();
            const showFilter = p.role !== 'receipt';
            return (
              <div key={p.id} className="rounded-xl border p-3 space-y-3 bg-card">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <Input className="h-8 flex-1 min-w-[180px]" value={p.name} onChange={(e) => upd(p.id, { name: e.target.value })} />
                  <Badge variant="secondary">{roleMeta[p.role].label}</Badge>
                  <Select value={p.paper} onValueChange={(v: any) => upd(p.id, { paper: v })}>
                    <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58">58 mm</SelectItem>
                      <SelectItem value="80">80 mm</SelectItem>
                      <SelectItem value="label">Label 50×30</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} max={5} className="h-8 w-16" value={p.copies} title="Jumlah salinan" onChange={(e) => upd(p.id, { copies: Math.max(1, Number(e.target.value) || 1) })} />
                  <Button size="sm" variant="outline" onClick={() => testPrint(p)}><TestTube2 className="h-3 w-3" /> Tes</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setS({ ...s, printers: s.printers.filter((x) => x.id !== p.id) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-5 text-sm">
                  <label className="flex items-center gap-2"><Switch checked={p.enabled} onCheckedChange={(v) => upd(p.id, { enabled: v })} /> Aktif</label>
                  <label className="flex items-center gap-2"><Switch checked={p.autoPrint} onCheckedChange={(v) => upd(p.id, { autoPrint: v })} /> Cetak otomatis</label>
                </div>
                {showFilter && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Centang kategori dan/atau menu tertentu yang keluar di printer ini. Jika tidak ada yang dicentang, semua menu dicetak.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => (
                        <label key={c} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer ${p.categories.includes(c) ? 'bg-primary text-primary-foreground border-primary' : ''}`}>
                          <Checkbox className="h-3.5 w-3.5" checked={p.categories.includes(c)} onCheckedChange={() => upd(p.id, { categories: toggle(p.categories, c) })} />
                          {c}
                        </label>
                      ))}
                    </div>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-primary text-xs font-medium">Pilih menu tertentu ({p.productIds.length} dipilih)</summary>
                      <Input className="h-8 my-2" placeholder="Cari menu..." value={search[p.id] || ''} onChange={(e) => setSearch({ ...search, [p.id]: e.target.value })} />
                      <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                        {products.filter((x) => x.name.toLowerCase().includes(q)).map((x) => (
                          <label key={x.id} className="flex items-center gap-2 text-xs py-0.5">
                            <Checkbox checked={p.productIds.includes(x.id)} onCheckedChange={() => upd(p.id, { productIds: toggle(p.productIds, x.id) })} />
                            <span className="truncate">{x.name}</span>
                            <span className="text-muted-foreground truncate">· {x.category}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setS({ ...s, printers: [...s.printers, newPrinter('receipt', 'Printer Kasir')] })}><Plus className="h-3 w-3" /> Printer Struk</Button>
          <Button size="sm" variant="outline" onClick={() => setS({ ...s, printers: [...s.printers, newPrinter('kitchen', `Printer Dapur ${String.fromCharCode(65 + s.printers.filter((x) => x.role === 'kitchen').length)}`)] })}><Plus className="h-3 w-3" /> Printer Dapur/Bar</Button>
          <Button size="sm" variant="outline" onClick={() => setS({ ...s, printers: [...s.printers, newPrinter('sticker', 'Printer Stiker Cup')] })}><Plus className="h-3 w-3" /> Printer Stiker</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Setiap printer dicetak sebagai pekerjaan terpisah. Untuk cetak tanpa dialog, jalankan Chrome dengan mode kiosk-printing dan atur printer default.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
