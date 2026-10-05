import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileBarChart } from 'lucide-react';
import { buildShiftReport, printShiftReport, rp, jkt, type ShiftReportPrint, type PrintSettings } from '@/lib/pos-printing';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shift: any | null;
  kind: 'X' | 'Z';
  branchName: string;
  kasirName: string;
  settings: PrintSettings;
}

const Row = ({ l, v, b }: { l: string; v: string; b?: boolean }) => (
  <div className={`flex justify-between text-sm ${b ? 'font-bold' : ''}`}><span>{l}</span><span>{v}</span></div>
);

export const POSShiftReport = ({ open, onOpenChange, shift, kind, branchName, kasirName, settings }: Props) => {
  const [r, setR] = useState<ShiftReportPrint | null>(null);
  useEffect(() => {
    if (!open || !shift) return;
    setR(null);
    buildShiftReport(shift, { kind, branch_name: branchName, kasir_name: kasirName }).then(setR);
  }, [open, shift, kind, branchName, kasirName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" /> {kind}-Report {kind === 'X' ? '(Sementara)' : '(Tutup Shift)'}
          </DialogTitle>
        </DialogHeader>
        {!r ? <div className="py-8 text-center text-sm text-muted-foreground">Menghitung...</div> : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Shift {r.shift_type} · buka {jkt(r.opened_at)}{r.closed_at ? ` · tutup ${jkt(r.closed_at)}` : ''}</div>
            <div className="rounded-xl border p-3 space-y-1">
              <Row l="Penjualan Kotor" v={rp(r.gross)} />
              <Row l="Diskon" v={`-${rp(r.discount)}`} />
              <Row l="Service + Pajak" v={rp(r.service + r.tax)} />
              <Row l="Penjualan Bersih" v={rp(r.net)} b />
              <Row l="Transaksi / Void" v={`${r.tx_count} / ${r.void_count}`} />
            </div>
            <div className="rounded-xl border p-3 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Metode Bayar</div>
              {r.payments.length ? r.payments.map((p) => <Row key={p.method} l={`${p.method.toUpperCase()} (${p.count})`} v={rp(p.amount)} />) : <div className="text-sm">-</div>}
            </div>
            <div className="rounded-xl border p-3 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Per Kategori</div>
              {r.categories.length ? r.categories.map((c) => <Row key={c.category} l={`${c.category} (${c.qty})`} v={rp(c.amount)} />) : <div className="text-sm">-</div>}
            </div>
            <div className="rounded-xl border p-3 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Kas Laci</div>
              <Row l="Modal Awal" v={rp(r.opening_cash)} />
              <Row l="Kas Masuk / Keluar" v={`${rp(r.cash_in)} / -${rp(r.cash_out)}`} />
              <Row l="Uang Seharusnya" v={rp(r.expected_cash)} b />
              {kind === 'Z' && r.closing_cash != null && (
                <>
                  <Row l="Fisik Dihitung" v={rp(r.closing_cash)} />
                  <div className={`flex justify-between text-sm font-bold ${(r.difference || 0) < 0 ? 'text-destructive' : 'text-success'}`}>
                    <span>Selisih</span><span>{(r.difference || 0) >= 0 ? '+' : ''}{rp(r.difference || 0)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button disabled={!r} onClick={() => r && printShiftReport(settings, { ...r, printed_at: new Date().toISOString() })}>
            <Printer className="h-4 w-4" /> Cetak {kind}-Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
