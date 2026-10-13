import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DEFAULT_LAYOUT, PaperWidth, PrintSettings, ReceiptLayout, SAMPLE_RECEIPT, renderReceipt } from '@/lib/pos-printing';

interface Props { settings: PrintSettings; onChange: (s: PrintSettings) => void; branchName?: string }

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm cursor-pointer">
    <span>{label}</span><Switch checked={checked} onCheckedChange={onChange} />
  </label>
);

/** Struk designer: settings on the left, live thermal-paper preview on the right. */
export const ReceiptDesigner = ({ settings, onChange, branchName }: Props) => {
  const L: ReceiptLayout = { ...DEFAULT_LAYOUT, ...(settings.layout || {}) };
  const set = (p: Partial<ReceiptLayout>) => onChange({ ...settings, layout: { ...L, ...p } });
  const [paper, setPaper] = useState<PaperWidth>((settings.printers.find((p) => p.role === 'receipt')?.paper as PaperWidth) || '80');
  const [scenario, setScenario] = useState<'dine' | 'take'>('dine');

  const sample = scenario === 'dine' ? { ...SAMPLE_RECEIPT, branch_name: branchName || SAMPLE_RECEIPT.branch_name }
    : { ...SAMPLE_RECEIPT, branch_name: branchName || SAMPLE_RECEIPT.branch_name, order_type: 'take_away', table_number: null, customer_name: null,
        items: SAMPLE_RECEIPT.items.slice(0, 2), subtotal: 61000, discount: 0, tax: 0, total: 61000, payment_method_1: 'qris', amount_1: 61000, change_amount: 0 };
  const html = renderReceipt(sample, settings, paper === 'label' ? '80' : paper);
  const width = paper === '58' ? 230 : 310;

  return (
    <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-start">
      <div className="space-y-5 min-w-0">
        <section className="space-y-2">
          <h3 className="font-semibold">Header & Branding</h3>
          <Toggle label="Tampilkan logo" checked={L.showLogo} onChange={(v) => set({ showLogo: v })} />
          {L.showLogo && <Input placeholder="Link logo (PNG/JPG, Google Drive bisa)" value={L.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} />}
          <div className="grid sm:grid-cols-2 gap-2">
            <div><Label>Nama brand</Label><Input placeholder="Kosongkan = nama cabang" value={L.brandName} onChange={(e) => set({ brandName: e.target.value })} /></div>
            <div><Label>No. telepon / WA</Label><Input value={L.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Alamat</Label><Input value={L.address} onChange={(e) => set({ address: e.target.value })} /></div>
            <div><Label>Instagram</Label><Input placeholder="@zeger.id" value={L.instagram} onChange={(e) => set({ instagram: e.target.value })} /></div>
            <div><Label>NPWP (opsional)</Label><Input value={L.taxId} onChange={(e) => set({ taxId: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Teks tambahan atas</Label><Input value={settings.receiptHeader} onChange={(e) => onChange({ ...settings, receiptHeader: e.target.value })} /></div>
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">Info Transaksi</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <Toggle label="Nomor antrean besar" checked={L.showQueue} onChange={(v) => set({ showQueue: v })} />
            <Toggle label="Nama kasir" checked={L.showCashier} onChange={(v) => set({ showCashier: v })} />
            <Toggle label="Tipe pesanan & meja" checked={L.showOrderType} onChange={(v) => set({ showOrderType: v })} />
            <Toggle label="Nama customer" checked={L.showCustomer} onChange={(v) => set({ showCustomer: v })} />
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">Rincian Item & Pembayaran</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <Toggle label="Rincian per item" checked={L.showItemDetails} onChange={(v) => set({ showItemDetails: v })} />
            <Toggle label="Harga satuan (qty × harga)" checked={L.showUnitPrice} onChange={(v) => set({ showUnitPrice: v })} />
            <Toggle label="Catatan & topping" checked={L.showNotes} onChange={(v) => set({ showNotes: v })} />
            <Toggle label="Jumlah total item" checked={L.showItemCount} onChange={(v) => set({ showItemCount: v })} />
            <Toggle label="Diskon" checked={L.showDiscount} onChange={(v) => set({ showDiscount: v })} />
            <Toggle label="Pajak & service" checked={L.showTaxService} onChange={(v) => set({ showTaxService: v })} />
            <Toggle label="Metode bayar & kembalian" checked={L.showPayment} onChange={(v) => set({ showPayment: v })} />
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">Footer</h3>
          <div><Label>Pesan penutup</Label><Input value={settings.receiptFooter} onChange={(e) => onChange({ ...settings, receiptFooter: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div><Label>Nama WiFi</Label><Input value={L.wifiName} onChange={(e) => set({ wifiName: e.target.value })} /></div>
            <div><Label>Password WiFi</Label><Input value={L.wifiPass} onChange={(e) => set({ wifiPass: e.target.value })} /></div>
          </div>
          <Toggle label="QR code di bawah struk" checked={L.showQr} onChange={(v) => set({ showQr: v })} />
          {L.showQr && <div className="grid sm:grid-cols-2 gap-2">
            <Input placeholder="Link (Google Review, member, survei)" value={L.qrUrl} onChange={(e) => set({ qrUrl: e.target.value })} />
            <Input placeholder="Keterangan QR" value={L.qrCaption} onChange={(e) => set({ qrCaption: e.target.value })} />
          </div>}
          <div><Label>Kebijakan komplain (opsional)</Label><Input placeholder="Komplain maks. 1 jam dengan struk" value={L.policy} onChange={(e) => set({ policy: e.target.value })} /></div>
          <Toggle label='Tulisan "Powered by Flow F&B"' checked={L.showPoweredBy} onChange={(v) => set({ showPoweredBy: v })} />
        </section>
      </div>

      <div className="lg:sticky lg:top-4 space-y-3">
        <div className="flex gap-2 justify-center">
          {(['58', '80'] as PaperWidth[]).map((p) => (
            <button key={p} onClick={() => setPaper(p)} className={cn('h-9 px-3 rounded-lg border text-sm font-semibold', paper === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-background')}>{p} mm</button>
          ))}
          {([['dine', 'Dine In'], ['take', 'Take Away']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setScenario(v)} className={cn('h-9 px-3 rounded-lg border text-sm font-semibold', scenario === v ? 'bg-secondary border-primary' : 'bg-background')}>{l}</button>
          ))}
        </div>
        <div className="rounded-2xl bg-muted p-5 flex justify-center">
          <div className="receipt-paper shadow-xl" style={{ width }}>
            <iframe title="Preview struk" srcDoc={html.replace(/body\{margin:0;width:[^;]+;/, 'body{margin:0;width:100%;')} className="w-full border-0 block" style={{ height: 720 }} />
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground">Preview langsung — berubah saat pengaturan diubah</p>
      </div>
    </div>
  );
};
