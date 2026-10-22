import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Row = { profile_id: string; full_name: string; role: string; has_pin: boolean };

/** Back Office: set a 4-6 digit POS PIN for each staff member of a branch. */
export const CashierPinManager = ({ branchId }: { branchId: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [pins, setPins] = useState<Record<string, string>>({});
  const load = () => (supabase as any).rpc('list_branch_cashiers', { _branch_id: branchId }).then(({ data }: any) => setRows(data || []));
  useEffect(() => { load(); }, [branchId]);
  const save = async (id: string) => {
    const { error } = await (supabase as any).rpc('set_cashier_pin', { _profile_id: id, _pin: pins[id] || '' });
    if (error) return toast.error(error.message);
    toast.success('PIN kasir disimpan');
    setPins((p) => ({ ...p, [id]: '' }));
    load();
  };
  if (!rows.length) return <p className="text-sm text-muted-foreground">Belum ada staf di cabang ini. Tambahkan dulu di menu Pengguna.</p>;
  return (
    <div className="divide-y border rounded-xl">
      {rows.map((r) => (
        <div key={r.profile_id} className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[10rem]">
            <div className="font-semibold text-sm">{r.full_name}</div>
            <div className="text-xs text-muted-foreground">{r.role} · {r.has_pin ? 'PIN sudah diatur' : 'Belum ada PIN'}</div>
          </div>
          <Input className="w-32" inputMode="numeric" type="password" maxLength={6} placeholder="PIN 4-6 digit"
            value={pins[r.profile_id] || ''} onChange={(e) => setPins((p) => ({ ...p, [r.profile_id]: e.target.value.replace(/\D/g, '') }))} />
          <Button size="sm" onClick={() => save(r.profile_id)} disabled={(pins[r.profile_id] || '').length < 4}>{r.has_pin ? 'Ganti PIN' : 'Simpan PIN'}</Button>
        </div>
      ))}
    </div>
  );
};
