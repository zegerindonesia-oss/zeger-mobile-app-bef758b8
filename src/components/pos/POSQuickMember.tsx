import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Delete, Loader2, UserCheck, UserPlus } from 'lucide-react';
import type { LoyaltyMember } from '@/components/loyalty/MemberScanDialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (m: LoyaltyMember) => void;
}

/** Fast phone-number capture: big numpad, instant lookup, auto-register new members. */
export function POSQuickMember({ open, onOpenChange, onSelect }: Props) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [found, setFound] = useState<LoyaltyMember | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setPhone(''); setName(''); setFound(null); } }, [open]);

  useEffect(() => {
    const d = phone.replace(/\D/g, '');
    setFound(null);
    if (d.length < 10) return;
    const t = setTimeout(async () => {
      setChecking(true);
      const n = d.startsWith('0') ? '62' + d.slice(1) : d;
      const { data } = await (supabase as any).rpc('lookup_member', { _code: n });
      let m = Array.isArray(data) ? data[0] : data;
      if (!m) { const r = await (supabase as any).rpc('lookup_member', { _code: d }); m = Array.isArray(r.data) ? r.data[0] : r.data; }
      setFound(m || null);
      setChecking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [phone]);

  const press = (k: string) => setPhone((p) => (k === 'del' ? p.slice(0, -1) : k === 'clr' ? '' : p.length < 14 ? p + k : p));

  const submit = async () => {
    if (found) { onSelect(found); onOpenChange(false); toast.success(`Member: ${found.name}`); return; }
    if (phone.replace(/\D/g, '').length < 9) return toast.error('Nomor HP belum lengkap');
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('pos_quick_member', { _phone: phone, _name: name || null });
    setSaving(false);
    if (error) return toast.error('Gagal daftar member: ' + error.message);
    const m = Array.isArray(data) ? data[0] : data;
    onSelect(m);
    onOpenChange(false);
    toast.success(m.is_new ? 'Member baru terdaftar 🎉' : `Member: ${m.name}`);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nomor HP Pelanggan</DialogTitle></DialogHeader>
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-center text-3xl font-bold tracking-wider min-h-[60px] font-mono">
          {phone || <span className="text-muted-foreground text-lg font-normal">08xx xxxx xxxx</span>}
        </div>
        <div className="min-h-[44px] text-sm">
          {checking && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Mengecek…</div>}
          {!checking && found && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 text-primary p-2 font-semibold">
              <UserCheck className="h-4 w-4" /> {found.name} · {found.points ?? 0} poin
            </div>
          )}
          {!checking && !found && phone.replace(/\D/g, '').length >= 10 && (
            <Input autoFocus={false} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama (opsional) — member baru" />
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <Button key={k} type="button" variant="outline" className="h-14 text-2xl font-semibold" onClick={() => press(k)}>
              {k === 'del' ? <Delete className="h-6 w-6" /> : k === 'clr' ? <span className="text-base">C</span> : k}
            </Button>
          ))}
        </div>
        <Button className="h-12 text-base" onClick={submit} disabled={saving || checking}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : found ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {found ? 'Pakai Member' : 'Daftar & Pakai Member'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
