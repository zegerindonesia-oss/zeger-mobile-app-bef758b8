import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface OpenProps {
  open: boolean;
  onOpen: (shiftType: string, openingCash: number) => Promise<void>;
}

export const OpenShiftModal = ({ open, onOpen }: OpenProps) => {
  const [shiftType, setShiftType] = useState('pagi');
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onOpen(shiftType, openingCash);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  const quick = [100000, 200000, 300000, 500000];
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Buka Kasir</h1>
          <p className="text-sm text-muted-foreground">Hitung uang di laci, lalu masukkan modal kas awal untuk mulai berjualan.</p>
        </div>
        <div>
          <Label>Shift</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {['pagi', 'siang', 'malam'].map((t) => (
              <Button key={t} type="button" variant={shiftType === t ? 'default' : 'outline'} onClick={() => setShiftType(t)} className="capitalize">{t}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Modal Kas Awal</Label>
          <Input inputMode="numeric" className="h-14 text-2xl font-bold text-center mt-1" value={openingCash ? openingCash.toLocaleString('id-ID') : ''}
            onChange={(e) => setOpeningCash(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="Rp0" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {quick.map((q) => (
              <Button key={q} type="button" variant="secondary" onClick={() => setOpeningCash(q)}>{fmt(q)}</Button>
            ))}
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="w-full h-14 text-lg">
          {loading ? 'Membuka...' : `Buka Kasir · ${fmt(openingCash)}`}
        </Button>
      </div>
    </div>
  );
};

interface CloseProps {
  open: boolean;
  expectedCash: number;
  onClose: () => void;
  onConfirm: (closingCash: number, notes: string) => Promise<void>;
}

export const CloseShiftModal = ({ open, expectedCash, onClose, onConfirm }: CloseProps) => {
  const [closingCash, setClosingCash] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
  const diff = closingCash - expectedCash;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onConfirm(closingCash, notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tutup Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted p-3 rounded">
            <div className="flex justify-between text-sm">
              <span>Expected Kas:</span>
              <span className="font-semibold">{fmt(expectedCash)}</span>
            </div>
          </div>
          <div>
            <Label>Kas Fisik di Laci (Rp)</Label>
            <Input type="number" value={closingCash || ''} onChange={(e) => setClosingCash(Number(e.target.value) || 0)} />
          </div>
          {closingCash > 0 && (
            <div className={`p-3 rounded ${diff === 0 ? 'bg-primary/10' : diff > 0 ? 'bg-secondary' : 'bg-destructive/10'}`}>
              <div className="flex justify-between font-semibold">
                <span>Selisih:</span>
                <span>{diff > 0 ? '+' : ''}{fmt(diff)}</span>
              </div>
              <div className="text-xs mt-1">{diff === 0 ? 'Pas!' : diff > 0 ? 'Lebih' : 'Kurang'}</div>
            </div>
          )}
          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Menutup...' : 'Tutup Shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CashProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (type: 'in' | 'out', amount: number, reason: string) => Promise<void>;
}

export const CashMovementModal = ({ open, onClose, onSubmit }: CashProps) => {
  const [type, setType] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || !reason) return;
    setLoading(true);
    try {
      await onSubmit(type, amount, reason);
      setAmount(0);
      setReason('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kas Masuk / Keluar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipe</Label>
            <Select value={type} onValueChange={(v: 'in' | 'out') => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Kas Masuk</SelectItem>
                <SelectItem value="out">Kas Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nominal</Label>
            <Input type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Beli es, ambil uang, dll" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading || !amount || !reason}>
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
