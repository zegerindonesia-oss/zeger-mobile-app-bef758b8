import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileBarChart, Mail } from 'lucide-react';
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
  const EMAIL_KEY = 'pos_owner_report_emails';
  const [emails, setEmails] = useState(() => localStorage.getItem(EMAIL_KEY) || '');
  const sendEmail = (rep: ShiftReportPrint) => {
    const to = emails.split(/[,;\s]+/).filter(Boolean).join(',');
    if (!to) return toast.error('Isi email owner dulu');
    localStorage.setItem(EMAIL_KEY, emails);
    const body = [
      `${kind}-Report ${branchName}`, `Kasir: ${kasirName}`, `Shift ${rep.shift_type} · buka ${jkt(rep.opened_at)}${rep.closed_at ? ` · tutup ${jkt(rep.closed_at)}` : ''}`, '',
      `Penjualan Kotor: ${rp(rep.gross)}`, `Diskon: -${rp(rep.discount)}`, `Service + Pajak: ${rp(rep.service + rep.tax)}`, `Penjualan Bersih: ${rp(rep.net)}`,
      `Transaksi / Void: ${rep.tx_count} / ${rep.void_count}`, '', 'Metode Bayar:', ...rep.payments.map((p) => `- ${p.method.toUpperCase()} (${p.count}): ${rp(p.amount)}`), '',
      'Per Kategori:', ...rep.categories.map((c) => `- ${c.category} (${c.qty}): ${rp(c.amount)}`), '',
      `Modal Awal: ${rp(rep.opening_cash)}`, `Kas Masuk/Keluar: ${rp(rep.cash_in)} / -${rp(rep.cash_out)}`, `Uang Seharusnya: ${rp(rep.expected_cash)}`,
      ...(rep.closing_cash != null ? [`Fisik Dihitung: ${rp(rep.closing_cash)}`, `Selisih: ${rp(rep.difference || 0)}`] : []),
    ].join('\n');
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`Laporan ${kind} ${branchName} - ${jkt(rep.opened_at)}`)}&body=${encodeURIComponent(body)}`;
  };
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
        {r && (
          <div className="rounded-xl border p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Email owner (pisahkan dengan koma)</div>
            <Input placeholder="owner@email.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          </div>
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" disabled={!r} onClick={() => r && sendEmail(r)}><Mail className="h-4 w-4" /> Kirim Email</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button disabled={!r} onClick={() => r && printShiftReport(settings, { ...r, printed_at: new Date().toISOString() })}>
            <Printer className="h-4 w-4" /> Cetak {kind}-Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
