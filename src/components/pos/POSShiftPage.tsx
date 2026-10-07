import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Lock, RefreshCw } from 'lucide-react';
import { usePOSShift } from '@/hooks/usePOSShift';
import { buildShiftReport, printShiftReport, loadPrintSettings, rp, jkt, type ShiftReportPrint } from '@/lib/pos-printing';

const Row = ({ l, v, b, cls }: { l: string; v: string; b?: boolean; cls?: string }) => (
  <div className={`flex justify-between py-1 text-sm ${b ? 'font-bold' : ''} ${cls || ''}`}><span>{l}</span><span className="pos-number">{v}</span></div>
);
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border bg-background p-4"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{title}</div>{children}</div>
);
const METHOD: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer Bank', debit: 'Kartu Debit', credit: 'Kartu Kredit', gofood: 'GoFood', grabfood: 'GrabFood', shopeefood: 'ShopeeFood' };

/** Full-page shift recap (X-Report) and close shift (Z-Report) with product breakdown. */
export const POSShiftPage = ({ branchId, branchName, kasirName }: { branchId: string | null; branchName: string; kasirName: string }) => {
  const { activeShift, closeShift } = usePOSShift();
  const [r, setR] = useState<ShiftReportPrint | null>(null);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => { if (activeShift) { setR(null); buildShiftReport(activeShift, { kind: 'X', branch_name: branchName, kasir_name: kasirName }).then(setR); } };
  useEffect(load, [activeShift?.id]); // eslint-disable-line

  const print = async (rep: ShiftReportPrint) => printShiftReport(await loadPrintSettings(branchId), { ...rep, printed_at: new Date().toISOString() });

  const close = async () => {
    if (counted === '') return toast.error('Isi jumlah uang fisik di laci');
    if (!window.confirm('Tutup shift sekarang? Data shift akan dikunci.')) return;
    setBusy(true);
    try {
      const closed = await closeShift(Number(counted), notes);
      const z = await buildShiftReport(closed, { kind: 'Z', branch_name: branchName, kasir_name: kasirName });
      toast.success('Shift ditutup — mencetak Z-Report');
      await print(z);
      setR(z);
    } catch (e: any) { toast.error(e.message || 'Gagal menutup shift'); }
    setBusy(false);
  };

  if (!activeShift && !r) return <div className="py-10 text-center text-muted-foreground">Tidak ada shift aktif.</div>;
  if (!r) return <div className="py-10 text-center text-muted-foreground">Menghitung rekap...</div>;
  const diff = counted === '' ? null : Number(counted) - r.expected_cash;
  const isZ = r.kind === 'Z';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{isZ ? 'Z-Report · Shift Ditutup' : 'Laporan Shift Berjalan'}</h2>
          <p className="text-xs text-muted-foreground">Shift {r.shift_type} · buka {jkt(r.opened_at)}{r.closed_at ? ` · tutup ${jkt(r.closed_at)}` : ''} · {kasirName}</p>
        </div>
        <div className="flex gap-2">
          {!isZ && <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>}
          <Button variant="outline" onClick={() => print(r)}><Printer className="h-4 w-4 mr-1" /> Cetak {r.kind}-Report</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Card title="Resume Penjualan">
          <Row l="Penjualan Kotor" v={rp(r.gross)} />
          <Row l="Diskon" v={`-${rp(r.discount)}`} cls="text-destructive" />
          <Row l="Service Charge" v={rp(r.service)} />
          <Row l="Pajak" v={rp(r.tax)} />
          <div className="border-t my-1" />
          <Row l="Penjualan Bersih" v={rp(r.net)} b />
          <Row l="Jumlah Transaksi" v={String(r.tx_count)} />
          <Row l="Rata-rata / Transaksi" v={rp(r.tx_count ? r.net / r.tx_count : 0)} />
          <Row l="Void" v={String(r.void_count)} />
        </Card>
        <Card title="Metode Pembayaran">
          {r.payments.length ? r.payments.map((p) => <Row key={p.method} l={`${METHOD[p.method] || p.method.toUpperCase()} (${p.count})`} v={rp(p.amount)} />) : <div className="text-sm">-</div>}
          <div className="border-t my-1" />
          <Row l="Total" v={rp(r.payments.reduce((s, p) => s + p.amount, 0))} b />
        </Card>
        <Card title="Kas Laci">
          <Row l="Modal Awal" v={rp(r.opening_cash)} />
          <Row l="Penjualan Tunai" v={rp(r.payments.find((p) => p.method === 'cash')?.amount || 0)} />
          <Row l="Kas Masuk" v={rp(r.cash_in)} />
          <Row l="Kas Keluar" v={`-${rp(r.cash_out)}`} />
          <div className="border-t my-1" />
          <Row l="Uang Seharusnya" v={rp(r.expected_cash)} b />
          {isZ && r.closing_cash != null && <>
            <Row l="Fisik Dihitung" v={rp(r.closing_cash)} />
            <Row l="Selisih" v={`${(r.difference || 0) >= 0 ? '+' : ''}${rp(r.difference || 0)}`} b cls={(r.difference || 0) < 0 ? 'text-destructive' : 'text-success'} />
          </>}
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-3">
        <Card title="Per Kategori">
          {r.categories.length ? r.categories.map((c) => <Row key={c.category} l={`${c.category} (${c.qty})`} v={rp(c.amount)} />) : <div className="text-sm">-</div>}
        </Card>
        <Card title="Rincian Produk Terjual">
          <div className="max-h-80 overflow-y-auto custom-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="text-left py-1">Produk</th><th className="text-right">Qty</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {(r.products || []).map((p) => (
                  <tr key={p.name} className="border-t"><td className="py-1.5">{p.name}</td><td className="text-right font-semibold">{p.qty}</td><td className="text-right pos-number">{rp(p.amount)}</td></tr>
                ))}
              </tbody>
            </table>
            {!(r.products || []).length && <div className="text-sm">-</div>}
          </div>
        </Card>
      </div>

      {!isZ && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-background p-4 space-y-3">
          <div className="font-bold flex items-center gap-2"><Lock className="h-4 w-4 text-destructive" /> Tutup Shift</div>
          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <Input type="number" inputMode="numeric" placeholder="Uang fisik di laci (Rp)" value={counted} onChange={(e) => setCounted(e.target.value)} className="h-12 text-lg font-bold" />
            <Input placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12" />
            <div className={`text-sm font-bold ${diff == null ? 'text-muted-foreground' : diff < 0 ? 'text-destructive' : 'text-success'}`}>
              {diff == null ? 'Selisih: -' : `Selisih: ${diff >= 0 ? '+' : ''}${rp(diff)}`}
            </div>
          </div>
          <Button variant="destructive" className="h-12 w-full sm:w-64" disabled={busy} onClick={close}>{busy ? 'Memproses...' : 'Tutup Shift & Cetak Z-Report'}</Button>
        </div>
      )}
    </div>
  );
};
