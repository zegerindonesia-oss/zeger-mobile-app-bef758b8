import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, FlaskConical } from 'lucide-react';

const db = supabase as any;
const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const num = (n: number) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

interface Mat { id: string; name: string; unit: string; cost_per_unit: number; material_type?: string; yield_quantity?: number }

export const WipTab = ({ materials, branchId, reload }: { materials: Mat[]; branchId: string; reload: () => void }) => {
  const wips = materials.filter((m) => m.material_type === 'wip');
  const raws = materials.filter((m) => m.material_type !== 'wip');
  const [wipId, setWipId] = useState('');
  const [comps, setComps] = useState<any[]>([]);
  const [matId, setMatId] = useState('');
  const [qty, setQty] = useState('');
  const [batches, setBatches] = useState('1');
  const [busy, setBusy] = useState(false);
  const matMap = useMemo(() => Object.fromEntries(materials.map((m) => [m.id, m])), [materials]);
  const wip = matMap[wipId];

  const load = useCallback(async () => {
    if (!wipId) return setComps([]);
    const { data } = await db.from('wip_components').select('*').eq('wip_id', wipId);
    setComps(data || []);
  }, [wipId]);
  useEffect(() => { load(); }, [load]);

  const batchCost = comps.reduce((s, c) => s + Number(c.quantity) * (matMap[c.material_id]?.cost_per_unit || 0), 0);
  const unitCost = wip ? batchCost / (Number(wip.yield_quantity) || 1) : 0;

  const syncCost = async (list: any[]) => {
    if (!wip) return;
    const cost = list.reduce((s, c) => s + Number(c.quantity) * (matMap[c.material_id]?.cost_per_unit || 0), 0) / (Number(wip.yield_quantity) || 1);
    await db.from('raw_materials').update({ cost_per_unit: cost }).eq('id', wip.id);
    reload();
  };

  const add = async () => {
    if (!wipId || !matId || !Number(qty)) return toast.error('Pilih bahan dan takaran');
    const { error } = await db.from('wip_components').upsert({ wip_id: wipId, material_id: matId, quantity: Number(qty) }, { onConflict: 'wip_id,material_id' });
    if (error) return toast.error(error.message);
    setMatId(''); setQty('');
    const { data } = await db.from('wip_components').select('*').eq('wip_id', wipId);
    setComps(data || []); syncCost(data || []);
  };

  const remove = async (id: string) => {
    await db.from('wip_components').delete().eq('id', id);
    const next = comps.filter((c) => c.id !== id);
    setComps(next); syncCost(next);
  };

  const produce = async () => {
    if (!branchId) return toast.error('Pilih cabang dulu');
    setBusy(true);
    const { data, error } = await db.rpc('produce_wip', { _branch_id: branchId, _wip_id: wipId, _batches: Number(batches) });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Stok ${wip?.name} bertambah ${num(data)} ${wip?.unit}`);
    reload();
  };

  if (!wips.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada bahan WIP. Tambahkan di tab "Bahan Baku" dengan tipe "WIP (Setengah Jadi)", mis. Espresso Shot, Simple Syrup.</CardContent></Card>;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="h-4 w-4" />Komposisi WIP per Batch</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={wipId} onValueChange={setWipId}>
            <SelectTrigger><SelectValue placeholder="Pilih bahan WIP" /></SelectTrigger>
            <SelectContent>{wips.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} (hasil {num(m.yield_quantity || 1)} {m.unit})</SelectItem>)}</SelectContent>
          </Select>
          {wip && <>
            <div className="flex gap-2">
              <Select value={matId} onValueChange={setMatId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Bahan penyusun" /></SelectTrigger>
                <SelectContent>{raws.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
              </Select>
              <Input className="w-28" type="number" placeholder="Takaran" value={qty} onChange={(e) => setQty(e.target.value)} />
              <Button onClick={add}><Plus className="h-4 w-4" /></Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead className="text-right">Takaran</TableHead><TableHead className="text-right">Biaya</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {comps.map((c) => { const m = matMap[c.material_id]; return (
                  <TableRow key={c.id}>
                    <TableCell>{m?.name || '-'}</TableCell>
                    <TableCell className="text-right">{num(c.quantity)} {m?.unit}</TableCell>
                    <TableCell className="text-right">{rp(Number(c.quantity) * (m?.cost_per_unit || 0))}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>); })}
                {!comps.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Belum ada komposisi.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <div className="text-sm space-y-1 rounded-lg bg-muted p-3">
              <div className="flex justify-between"><span>Biaya per batch</span><b>{rp(batchCost)}</b></div>
              <div className="flex justify-between"><span>Hasil per batch</span><b>{num(wip.yield_quantity || 1)} {wip.unit}</b></div>
              <div className="flex justify-between"><span>HPP per {wip.unit}</span><b>{rp(unitCost)}</b></div>
            </div>
          </>}
        </CardContent>
      </Card>
      {wip && (
        <Card>
          <CardHeader><CardTitle className="text-base">Produksi WIP</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Stok bahan penyusun berkurang, stok {wip.name} di cabang bertambah. Semua tercatat di Riwayat.</p>
            <div className="flex gap-2 items-center">
              <Input className="w-28" type="number" min="0" value={batches} onChange={(e) => setBatches(e.target.value)} />
              <span className="text-sm">batch = {num((Number(wip.yield_quantity) || 1) * (Number(batches) || 0))} {wip.unit}</span>
            </div>
            <Button onClick={produce} disabled={busy || !comps.length}>Proses Produksi</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
