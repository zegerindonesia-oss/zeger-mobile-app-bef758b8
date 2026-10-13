import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileBarChart, Mail, MessageCircle, FileDown } from 'lucide-react';
import { buildShiftReport, printShiftReport, renderShiftReport, rp, jkt, type ShiftReportPrint, type PrintSettings, type PaperWidth } from '@/lib/pos-printing';

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
  const paper = (settings.printers.find((p) => p.role === 'receipt')?.paper || '80') as PaperWidth;
  const previewHtml = useMemo(() => r ? renderShiftReport({ ...r, printed_at: new Date().toISOString() }, paper === 'label' ? '80' : paper, settings) : '', [r, paper, settings]);
  const WA_KEY = 'pos_owner_report_wa';
  const [wa, setWa] = useState(() => localStorage.getItem(WA_KEY) || '');
  const EMAIL_KEY = 'pos_owner_report_emails';
  const [emails, setEmails] = useState(() => localStorage.getItem(EMAIL_KEY) || '');
  const reportText = (rep: ShiftReportPrint) => {
    const body = [
      `${kind}-Report ${branchName}`, `Kasir: ${kasirName}`, `Shift ${rep.shift_type} · buka ${jkt(rep.opened_at)}${rep.closed_at ? ` · tutup ${jkt(rep.closed_at)}` : ''}`, '',
      `Penjualan Kotor: ${rp(rep.gross)}`, `Diskon: -${rp(rep.discount)}`, `Service + Pajak: ${rp(rep.service + rep.tax)}`, `Penjualan Bersih: ${rp(rep.net)}`,
      `Transaksi / Void: ${rep.tx_count} / ${rep.void_count}`, '', 'Metode Bayar:', ...rep.payments.map((p) => `- ${p.method.toUpperCase()} (${p.count}): ${rp(p.amount)}`), '',
      'Per Kategori:', ...rep.categories.map((c) => `- ${c.category} (${c.qty}): ${rp(c.amount)}`), '',
      `Modal Awal: ${rp(rep.opening_cash)}`, `Kas Masuk/Keluar: ${rp(rep.cash_in)} / -${rp(rep.cash_out)}`, `Uang Seharusnya: ${rp(rep.expected_cash)}`,
      ...(rep.closing_cash != null ? [`Fisik Dihitung: ${rp(rep.closing_cash)}`, `Selisih: ${rp(rep.difference || 0)}`] : []),
    ].join('\n');
    return body;
  };
  const textOf = (rep: ShiftReportPrint) => reportText(rep);
  const sendEmailReal = (rep: ShiftReportPrint) => {
    const to = emails.split(/[,;\s]+/).filter(Boolean).join(',');
    if (!to) return toast.error('Isi email owner dulu');
    localStorage.setItem(EMAIL_KEY, emails);
    const body = textOf(rep);
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`Laporan ${kind} ${branchName} - ${jkt(rep.opened_at)}`)}&body=${encodeURIComponent(body)}`;
  };
  const sendWa = (rep: ShiftReportPrint) => {
    const n = wa.replace(/\D/g, '').replace(/^0/, '62');
    if (n.length < 9) return toast.error('Isi nomor WhatsApp owner dulu');
    localStorage.setItem(WA_KEY, wa);
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(textOf(rep))}`, '_blank');
  };
  const savePdf = () => {
    const w = window.open('', '_blank');
    if (!w) return toast.error('Izinkan pop-up untuk menyimpan PDF');
    w.document.write(previewHtml); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
    toast.info('Pilih "Simpan sebagai PDF" di jendela cetak');
  };
  useEffect(() => {
    if (!open || !shift) return;
    setR(null);
    buildShiftReport(shift, { kind, branch_name: branchName, kasir_name: kasirName }).then(setR);
  }, [open, shift, kind, branchName, kasirName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" /> {kind}-Report {kind === 'X' ? '(Sementara)' : '(Tutup Shift)'}
          </DialogTitle>
        </DialogHeader>
        {!r ? <div className="py-8 text-center text-sm text-muted-foreground">Menghitung...</div> : (
          <div className="rounded-2xl bg-muted p-4 flex justify-center">
            <div className="receipt-paper shadow-xl" style={{ width: paper === '58' ? 230 : 310 }}>
              <iframe title="Preview laporan" srcDoc={previewHtml.replace(/body\{margin:0;width:[^;]+;/, 'body{margin:0;width:100%;')} className="w-full border-0 block" style={{ height: 620 }} />
            </div>
          </div>
        )}
        {r && (
          <div className="rounded-xl border p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Email owner (pisahkan dengan koma)</div>
            <Input placeholder="owner@email.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
            <div className="text-xs font-semibold text-muted-foreground">WhatsApp owner</div>
            <Input placeholder="0812xxxxxxx" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} />
          </div>
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" disabled={!r} onClick={() => r && sendWa(r)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline" disabled={!r} onClick={() => r && sendEmailReal(r)}><Mail className="h-4 w-4" /> Email</Button>
          <Button variant="outline" disabled={!r} onClick={savePdf}><FileDown className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button disabled={!r} onClick={() => r && printShiftReport(settings, { ...r, printed_at: new Date().toISOString() })}>
            <Printer className="h-4 w-4" /> Cetak {kind}-Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
