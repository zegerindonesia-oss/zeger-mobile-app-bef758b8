import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Armchair, Clock, Users, Plus, Trash2, ArrowRightLeft, Combine, Receipt, CalendarClock, DoorOpen, ShoppingBag } from 'lucide-react';
import { usePOSTables, type POSTable, type TableStatus } from '@/hooks/usePOSTables';
import { cn } from '@/lib/utils';

const STATUS: Record<TableStatus, { label: string; cls: string; dot: string }> = {
  available: { label: 'Kosong', cls: 'border-success/40 bg-success/10 text-success', dot: 'bg-success' },
  occupied: { label: 'Terisi', cls: 'border-destructive/40 bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  billing: { label: 'Minta Bill', cls: 'border-warning/50 bg-warning/15 text-warning', dot: 'bg-warning' },
  reserved: { label: 'Reservasi', cls: 'border-primary/40 bg-primary/10 text-primary', dot: 'bg-primary' },
};

const fmt = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
const minutesSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  branchId: string | null;
  canManage: boolean;
  selectedTableId: string | null;
  /** Seat a new party / attach current cart to this table. */
  onSelect: (t: POSTable) => void;
  /** Load the table's open bill into the cart. */
  onRecall: (t: POSTable) => void;
}

export const POSTableMap = ({ open, onOpenChange, branchId, canManage, selectedTableId, onSelect, onRecall }: Props) => {
  const { tables, sections, updateTable, releaseTable, reload, db } = usePOSTables(branchId);
  const [section, setSection] = useState('all');
  const [active, setActive] = useState<POSTable | null>(null);
  const [mode, setMode] = useState<'move' | 'merge' | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(
    () => tables.filter((t) => !t.merged_into && (section === 'all' || t.section_id === section)),
    [tables, section]
  );
  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, billing: 0, reserved: 0 } as Record<TableStatus, number>;
    tables.forEach((t) => !t.merged_into && c[t.status]++);
    return c;
  }, [tables]);

  const mergedChildren = (id: string) => tables.filter((t) => t.merged_into === id);

  const handleTableClick = async (t: POSTable) => {
    if (mode && active) {
      try {
        if (mode === 'move') {
          if (t.status !== 'available') return toast.error('Pilih meja kosong untuk pindah');
          await updateTable(t.id, {
            status: active.status, guest_name: active.guest_name, guest_count: active.guest_count,
            occupied_at: active.occupied_at, current_total: active.current_total, open_bill: active.open_bill,
          });
          for (const c of mergedChildren(active.id)) await updateTable(c.id, { merged_into: t.id });
          await releaseTable(active.id);
          toast.success(`Pindah Meja ${active.table_number} → ${t.table_number}`);
        } else {
          if (t.id === active.id) return;
          if (t.status === 'occupied' || t.status === 'billing') {
            // combine open bills into active table
            const a = active.open_bill?.items || [];
            const b = t.open_bill?.items || [];
            await updateTable(active.id, {
              open_bill: { ...(active.open_bill || {}), items: [...a, ...b] },
              current_total: Number(active.current_total) + Number(t.current_total),
              guest_count: (active.guest_count || 0) + (t.guest_count || 0),
            });
          }
          await updateTable(t.id, {
            merged_into: active.id, status: 'occupied', open_bill: null, current_total: 0,
            occupied_at: t.occupied_at || new Date().toISOString(),
          });
          toast.success(`Meja ${t.table_number} digabung ke ${active.table_number}`);
        }
      } catch (e: any) {
        toast.error(e.message);
      }
      setMode(null);
      setActive(null);
      return;
    }
    setActive(t);
  };

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      setActive(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setActive(null); setMode(null); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Armchair className="h-5 w-5 text-primary" /> Denah Meja</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="map" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="map">Denah</TabsTrigger>
            {canManage && <TabsTrigger value="setup">Atur Meja</TabsTrigger>}
          </TabsList>

          <TabsContent value="map" className="flex-1 min-h-0 flex flex-col gap-3 mt-3">
            <div className="flex flex-wrap items-center gap-2">
              {[{ id: 'all', name: 'Semua Area' }, ...sections].map((s) => (
                <button key={s.id} onClick={() => setSection(s.id)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition', section === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted')}>
                  {s.name}
                </button>
              ))}
              <div className="ml-auto flex flex-wrap gap-3 text-xs">
                {(Object.keys(STATUS) as TableStatus[]).map((k) => (
                  <span key={k} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', STATUS[k].dot)} />{STATUS[k].label} ({counts[k]})</span>
                ))}
              </div>
            </div>

            {mode && active && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm flex items-center justify-between">
                <span>{mode === 'move' ? `Pilih meja kosong tujuan untuk Meja ${active.table_number}` : `Pilih meja yang akan digabung ke Meja ${active.table_number}`}</span>
                <Button size="sm" variant="ghost" onClick={() => { setMode(null); setActive(null); }}>Batal</Button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-16">
                  Belum ada meja. {canManage ? 'Tambahkan di tab "Atur Meja".' : 'Minta manager menambahkan meja.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-1">
                  {visible.map((t) => {
                    const st = STATUS[t.status];
                    const children = mergedChildren(t.id);
                    const mins = minutesSince(t.occupied_at);
                    return (
                      <button key={t.id} onClick={() => handleTableClick(t)}
                        className={cn('relative aspect-square border-2 p-2 flex flex-col items-center justify-center gap-0.5 transition hover:scale-[1.03] shadow-sm',
                          t.shape === 'round' ? 'rounded-full' : 'rounded-2xl', st.cls,
                          selectedTableId === t.id && 'ring-4 ring-primary/40',
                          active?.id === t.id && 'ring-4 ring-foreground/30')}>
                        <span className="text-xl font-bold">{t.table_number}{children.length > 0 && <span className="text-xs">+{children.map((c) => c.table_number).join('+')}</span>}</span>
                        <span className="text-[10px] flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" />{t.guest_count ? `${t.guest_count}/` : ''}{t.capacity}</span>
                        {(t.status === 'occupied' || t.status === 'billing') && (
                          <>
                            <span className="text-[11px] font-semibold">{fmt(t.current_total)}</span>
                            <span className={cn('text-[10px] flex items-center gap-0.5', mins > 90 && 'font-bold')}><Clock className="h-3 w-3" />{mins} mnt</span>
                          </>
                        )}
                        {t.guest_name && <span className="text-[10px] truncate max-w-full">{t.guest_name}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {active && !mode && (
              <div className="border-t pt-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold mr-2">Meja {active.table_number} · {STATUS[active.status].label}</span>
                {(active.status === 'available' || active.status === 'reserved') && (
                  <Button size="sm" onClick={() => { onSelect(active); onOpenChange(false); setActive(null); }}><DoorOpen className="h-4 w-4 mr-1" />Dudukkan / Pakai Meja</Button>
                )}
                {(active.status === 'occupied' || active.status === 'billing') && (
                  <>
                    <Button size="sm" onClick={() => { onRecall(active); onOpenChange(false); setActive(null); }}><ShoppingBag className="h-4 w-4 mr-1" />Buka Bill / Tambah Pesanan</Button>
                    {active.status === 'occupied' && (
                      <Button size="sm" variant="outline" onClick={() => act(() => updateTable(active.id, { status: 'billing' }), 'Meja ditandai minta bill')}><Receipt className="h-4 w-4 mr-1" />Minta Bill</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setMode('move')}><ArrowRightLeft className="h-4 w-4 mr-1" />Pindah</Button>
                    <Button size="sm" variant="outline" onClick={() => setMode('merge')}><Combine className="h-4 w-4 mr-1" />Gabung</Button>
                  </>
                )}
                {active.status === 'available' && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const name = window.prompt('Nama tamu reservasi');
                    if (name) act(() => updateTable(active.id, { status: 'reserved', guest_name: name }), 'Reservasi disimpan');
                  }}><CalendarClock className="h-4 w-4 mr-1" />Reservasi</Button>
                )}
                {active.status !== 'available' && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                    if (!window.confirm(`Kosongkan Meja ${active.table_number}? Bill terbuka akan dihapus.`)) return;
                    act(async () => {
                      for (const c of mergedChildren(active.id)) await releaseTable(c.id);
                      await releaseTable(active.id);
                    }, 'Meja dikosongkan');
                  }}>Kosongkan</Button>
                )}
              </div>
            )}
          </TabsContent>

          {canManage && (
            <TabsContent value="setup" className="flex-1 min-h-0 overflow-y-auto mt-3">
              <TableSetup branchId={branchId} sections={sections} tables={tables} db={db} reload={reload} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const TableSetup = ({ branchId, sections, tables, db, reload }: any) => {
  const [secName, setSecName] = useState('');
  const [num, setNum] = useState('');
  const [cap, setCap] = useState('4');
  const [shape, setShape] = useState('square');
  const [sec, setSec] = useState<string>('none');
  const [bulk, setBulk] = useState('');

  const run = async (p: Promise<any>, msg: string) => {
    const { error } = await p;
    if (error) return toast.error(error.message);
    toast.success(msg);
    reload();
  };

  const addTables = async (numbers: string[]) => {
    const rows = numbers.filter(Boolean).map((n, i) => ({
      branch_id: branchId, table_number: n.trim(), capacity: Number(cap) || 4, shape,
      section_id: sec === 'none' ? null : sec, sort_order: tables.length + i,
    }));
    if (!rows.length) return;
    await run(db.from('pos_tables').insert(rows), `${rows.length} meja ditambahkan`);
    setNum(''); setBulk('');
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h4 className="font-semibold">Area / Lantai</h4>
        <div className="flex gap-2">
          <Input placeholder="mis. Indoor, Outdoor, VIP" value={secName} onChange={(e) => setSecName(e.target.value)} />
          <Button onClick={() => { if (secName.trim()) { run(db.from('pos_table_sections').insert({ branch_id: branchId, name: secName.trim(), sort_order: sections.length }), 'Area ditambahkan'); setSecName(''); } }}><Plus className="h-4 w-4" /></Button>
        </div>
        {sections.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>{s.name} <span className="text-muted-foreground">({tables.filter((t: any) => t.section_id === s.id).length} meja)</span></span>
            <Button size="icon" variant="ghost" onClick={() => run(db.from('pos_table_sections').delete().eq('id', s.id), 'Area dihapus')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}

        <h4 className="font-semibold pt-3">Tambah Meja</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Nomor meja (mis. 01, VIP-1)" value={num} onChange={(e) => setNum(e.target.value)} />
          <Input type="number" placeholder="Kursi" value={cap} onChange={(e) => setCap(e.target.value)} />
          <Select value={sec} onValueChange={setSec}>
            <SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tanpa area</SelectItem>
              {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={shape} onValueChange={setShape}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="square">Kotak</SelectItem>
              <SelectItem value="round">Bulat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" onClick={() => addTables([num])} disabled={!num.trim()}>Tambah Meja</Button>
        <div className="flex gap-2">
          <Input placeholder="Cepat: 1-12 (buat banyak sekaligus)" value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <Button variant="outline" onClick={() => {
            const m = bulk.match(/^(\d+)\s*-\s*(\d+)$/);
            if (!m) return toast.error('Format: 1-12');
            const [a, b] = [Number(m[1]), Number(m[2])];
            const list: string[] = [];
            for (let i = a; i <= b && list.length < 100; i++) list.push(String(i).padStart(2, '0'));
            addTables(list);
          }}>Buat</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold">Daftar Meja ({tables.length})</h4>
        {tables.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span><b>{t.table_number}</b> · {t.capacity} kursi · {sections.find((s: any) => s.id === t.section_id)?.name || 'Tanpa area'}</span>
            <Button size="icon" variant="ghost" disabled={t.status !== 'available'} onClick={() => run(db.from('pos_tables').update({ is_active: false }).eq('id', t.id), 'Meja dinonaktifkan')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
};
