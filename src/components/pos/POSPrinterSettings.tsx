import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bluetooth, Printer, Plus, Trash2, TestTube2, ChefHat, Receipt, Sticker } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  PrintSettings, PrinterConfig, PrinterRole, loadPrintSettings, savePrintSettings, newPrinter,
  printHtml, renderKitchenTicket, renderReceipt, renderStickers,
  escReceipt, escKitchen, tsplCustomer,
} from '@/lib/pos-printing';
import { btPair, btForget, btSavedName, btSupported, btSend, btCanScan, btScan, btStopScan, btConnectTo, type BtFound } from '@/lib/bt-printer';
import { ReceiptDesigner } from './ReceiptDesigner';
import { StickerPreview } from './StickerPreview';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  branchId: string | null;
  userId?: string;
  onSaved?: (s: PrintSettings) => void;
  /** Render as a full-page section instead of a dialog. */
  inline?: boolean;
  /** Show the receipt designer with live preview instead of the printer list. */
  designer?: boolean;
  branchName?: string;
}

const roleMeta: Record<PrinterRole, { label: string; icon: any }> = {
  receipt: { label: 'Struk Kasir', icon: Receipt },
  kitchen: { label: 'Tiket Dapur / Bar', icon: ChefHat },
  sticker: { label: 'Stiker Cup', icon: Sticker },
};

export const POSPrinterSettings = ({ open, onOpenChange, branchId, userId, onSaved, inline, designer, branchName }: Props) => {
  const [s, setS] = useState<PrintSettings | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; category: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    loadPrintSettings(branchId).then((v: any) => setS({ ...(v || {}), printers: (v?.printers || []).map((p: any) => ({ ...p, role: roleMeta[p?.role as PrinterRole] ? p.role : 'receipt', categories: Array.isArray(p?.categories) ? p.categories : [], products: Array.isArray(p?.products) ? p.products : [] })) })).catch(() => toast.error('Gagal memuat pengaturan printer'));
    supabase.from('products').select('id,name,category').eq('is_active', true).order('name')
      .then(({ data }) => setProducts((data as any) || []));
  }, [open, branchId]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );

  const [, rerender] = useState(0);
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [found, setFound] = useState<BtFound[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  if (!s) return null;
  const upd = (id: string, patch: Partial<PrinterConfig>) =>
    setS({ ...s, printers: s.printers.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const pair = async (p: PrinterConfig) => {
    if (btCanScan()) {
      setScanFor(p.id); setFound([]); setScanning(true);
      try { await btScan((d) => setFound((f) => [...f, d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)))); }
      catch (e: any) { toast.error(e.message || 'Gagal mencari Bluetooth'); }
      finally { setScanning(false); }
      return;
    }
    try { const n = await btPair(p.id); upd(p.id, { connection: 'bluetooth' }); toast.success(`Terhubung ke ${n}`); }
    catch (e: any) { if (e?.name !== 'NotFoundError') toast.error(e.message || 'Gagal menghubungkan'); }
    rerender((x) => x + 1);
  };
  const connectFound = async (d: BtFound) => {
    if (!scanFor) return;
    setConnecting(d.deviceId);
    try { await btConnectTo(scanFor, d); upd(scanFor, { connection: 'bluetooth' }); toast.success(`Terhubung ke ${d.name}`); setScanFor(null); }
    catch (e: any) { toast.error(e.message || 'Gagal menghubungkan'); }
    finally { setConnecting(null); rerender((x) => x + 1); }
  };
  const testPrint = async (p: PrinterConfig) => {
    const now = new Date().toISOString();
    const items = [{ product_name: 'Aren Latte', qty: 1, price: 18000, subtotal: 18000, notes: 'Ice, Less Sugar' }];
    if (p.connection === 'bluetooth' && btSavedName(p.id)) {
      const rec = { transaction_number: 'TEST-001', branch_name: 'TES PRINTER', kasir_name: 'Kasir', created_at: now, order_type: 'take_away', items, subtotal: 18000, discount: 0, service_charge: 0, tax: 0, total: 18000, payment_method_1: 'cash', amount_1: 20000, change_amount: 2000 };
      const k = { station: p.name, ref: 'TEST-001', order_type: 'take_away', created_at: now, customer_name: 'Budi', items };
      try {
        await btSend(p.id, p.role === 'receipt' ? escReceipt(rec, s, p) : p.role === 'sticker' ? tsplCustomer(k, p) : escKitchen(k, p));
        return toast.success('Tes cetak terkirim via Bluetooth');
      } catch (e: any) { return toast.error(e.message); }
    }
    if (p.role === 'receipt') printHtml(renderReceipt({ transaction_number: 'TEST-001', branch_name: 'TES PRINTER', kasir_name: 'Kasir', created_at: now, order_type: 'take_away', items, subtotal: 18000, discount: 0, service_charge: 0, tax: 0, total: 18000, payment_method_1: 'cash', amount_1: 20000, change_amount: 2000 }, s, p.paper));
    else if (p.role === 'sticker') printHtml(renderStickers({ station: p.name, ref: 'TEST-001', order_type: 'take_away', created_at: now, customer_name: 'Budi', items }, p));
    else printHtml(renderKitchenTicket({ station: p.name, ref: 'TEST-001', order_type: 'take_away', created_at: now, items }, p.paper));
  };

  const save = async () => {
    if (!branchId) return toast.error('Cabang tidak ditemukan');
    setSaving(true);
    try {
      await savePrintSettings(branchId, s, userId);
      toast.success('Pengaturan printer tersimpan');
      onSaved?.(s);
      if (!inline) onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  return (
    <Shell inline={inline} open={open} onOpenChange={onOpenChange}>
        {designer && <ReceiptDesigner settings={s} onChange={setS} branchName={branchName} />}
        {designer && <div className="mt-6"><StickerPreview /></div>}
        {!designer && <>


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
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
                  <Select value={p.connection || 'system'} onValueChange={(v: any) => upd(p.id, { connection: v })}>
                    <SelectTrigger className="h-8 w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bluetooth">Bluetooth (cari & sambungkan)</SelectItem>
                      <SelectItem value="system">Printer Android / Windows terpasang</SelectItem>
                    </SelectContent>
                  </Select>
                  {p.connection === 'bluetooth' && <>
                    <Badge variant={btSavedName(p.id) ? 'default' : 'outline'}><Bluetooth className="mr-1 h-3 w-3" />{btSavedName(p.id) || 'Belum terhubung'}</Badge>
                    <Button size="sm" className="btn-glossy-primary" onClick={() => pair(p)} disabled={!btSupported()}><Bluetooth className="h-3 w-3" /> {btSavedName(p.id) ? 'Ganti' : 'Hubungkan'}</Button>
                    {btSavedName(p.id) && <Button size="sm" variant="ghost" onClick={() => { btForget(p.id); rerender((x) => x + 1); }}>Putuskan</Button>}
                    {!btSupported() && <span className="text-xs text-destructive basis-full">Aplikasi ini belum bisa mencari Bluetooth. Buka POS lewat Google Chrome di tablet (flowfnb.flowsstack.com/pos) lalu tekan Hubungkan — atau pilih "Printer Android / Windows terpasang".</span>}
                    {btSupported() && !btSavedName(p.id) && <span className="text-xs text-muted-foreground basis-full">Nyalakan printer & Bluetooth tablet, tekan Hubungkan, pilih nama printer (Xprinter, Hasmart, Kijang, dll), lalu tekan Tes.</span>}
                  </>}
                  {p.role === 'sticker' && <span className="flex items-center gap-1 text-xs">Label
                    <Input type="number" className="h-8 w-14" value={p.labelW || 33} onChange={(e) => upd(p.id, { labelW: Number(e.target.value) || 33 })} />×
                    <Input type="number" className="h-8 w-14" value={p.labelH || 15} onChange={(e) => upd(p.id, { labelH: Number(e.target.value) || 15 })} />mm</span>}
                </div>
                {p.role === 'sticker' && (
                  <div className="grid sm:grid-cols-2 gap-3 rounded-lg border bg-background p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span>Ukuran tulisan stiker</span><b>{p.fontScale ?? 100}%</b></div>
                      <Slider min={80} max={140} step={5} value={[p.fontScale ?? 100]} onValueChange={([v]) => upd(p.id, { fontScale: v })} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span>Jarak antar baris</span><b>{(p.lineSpacing ?? 1.25).toFixed(2)}</b></div>
                      <Slider min={1} max={2} step={0.05} value={[p.lineSpacing ?? 1.25]} onValueChange={([v]) => upd(p.id, { lineSpacing: v })} />
                    </div>
                    <iframe title="Preview stiker" className="sm:col-span-2 mx-auto bg-card shadow rounded border-0" style={{ width: 220, height: 140 }}
                      srcDoc={renderStickers({ station: p.name, ref: 'POS-0015', order_type: 'take_away', created_at: new Date().toISOString(), customer_name: 'Budi', items: [{ product_name: 'Aren Latte Large', qty: 1, notes: 'Less Ice, 50% Sugar' }] }, p)} />
                  </div>
                )}
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
        </>}

        <div className="flex justify-end gap-2 pt-2">
          {!inline && <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>}
          <Button onClick={save} disabled={saving} className="h-11 px-6">{saving ? 'Menyimpan...' : designer ? 'Simpan Desain Struk' : 'Simpan Pengaturan Printer'}</Button>
        </div>
    </Shell>
  );
};

const Shell = ({ inline, open, onOpenChange, children }: { inline?: boolean; open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode }) =>
  inline ? (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> Pengaturan Printer</h2>
      {children}
    </div>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> Pengaturan Printer</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
