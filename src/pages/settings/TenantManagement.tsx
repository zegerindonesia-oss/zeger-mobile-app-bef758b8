import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Search, Settings2, CalendarPlus, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PLANS, getPlan, formatPrice } from '@/lib/flow-plans';

const MODULES = [
  { id: 'pos', t: 'POS Kasir', lock: true }, { id: 'table', t: 'Manajemen Meja' }, { id: 'kds', t: 'Kitchen Display' },
  { id: 'queue', t: 'Layar Antrean TV' }, { id: 'bom', t: 'Bahan Baku & Resep' }, { id: 'loyalty', t: 'CRM & Loyalty' },
  { id: 'rider', t: 'Mobile Selling Rider' }, { id: 'customer_app', t: 'Aplikasi Customer' }, { id: 'voice', t: 'Voice AI Kasir' },
  { id: 'invoice', t: 'Invoice & Pembelian' }, { id: 'finance', t: 'Laporan Keuangan' },
];
const STATUS: Record<string, { l: string; v: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { l: 'Trial', v: 'secondary' }, active: { l: 'Aktif', v: 'default' },
  past_due: { l: 'Telat Bayar', v: 'destructive' }, suspended: { l: 'Ditangguhkan', v: 'destructive' },
};

interface Tenant {
  id: string; slug: string; name: string; business_type: string; plan: string; subscription_status: string;
  trial_ends_at: string | null; current_period_end: string | null; modules: string[]; config: any;
  is_platform_owner: boolean; created_at: string;
}

const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }) : '—';
const daysLeft = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

export default function TenantManagement() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [counts, setCounts] = useState<Record<string, { b: number; p: number }>>({});
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = 'Superadmin SaaS | FlowF&B'; load(); }, []);

  const load = async () => {
    const { data, error } = await (supabase.from as any)('tenants').select('*').order('created_at', { ascending: false });
    if (error) return toast.error(error.message);
    setItems(data || []);
    const [b, p] = await Promise.all([
      (supabase.from as any)('branches').select('tenant_id'),
      (supabase.from as any)('products').select('tenant_id'),
    ]);
    const c: Record<string, { b: number; p: number }> = {};
    (b.data || []).forEach((r: any) => { c[r.tenant_id] = c[r.tenant_id] || { b: 0, p: 0 }; c[r.tenant_id].b++; });
    (p.data || []).forEach((r: any) => { c[r.tenant_id] = c[r.tenant_id] || { b: 0, p: 0 }; c[r.tenant_id].p++; });
    setCounts(c);
  };

  const filtered = useMemo(() => items.filter((t) => `${t.name} ${t.slug} ${t.config?.phone || ''}`.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const stats = useMemo(() => ({
    total: items.length, trial: items.filter((t) => t.subscription_status === 'trial').length,
    active: items.filter((t) => t.subscription_status === 'active').length,
    expiring: items.filter((t) => t.subscription_status === 'trial' && (daysLeft(t.trial_ends_at) ?? 99) <= 3).length,
  }), [items]);

  const save = async (patch: Partial<Tenant>, msg = 'Tersimpan') => {
    if (!edit) return;
    setSaving(true);
    const { error } = await (supabase.from as any)('tenants').update(patch).eq('id', edit.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(msg);
    setEdit({ ...edit, ...patch });
    load();
  };

  const extendTrial = (days: number) => {
    const base = edit?.trial_ends_at && new Date(edit.trial_ends_at) > new Date() ? new Date(edit.trial_ends_at) : new Date();
    base.setDate(base.getDate() + days);
    save({ trial_ends_at: base.toISOString(), subscription_status: 'trial' }, `Trial diperpanjang ${days} hari`);
  };
  const activate = (months: number) => {
    const d = new Date(); d.setMonth(d.getMonth() + months);
    save({ subscription_status: 'active', current_period_end: d.toISOString() }, `Langganan aktif ${months} bulan`);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center"><Building2 className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Superadmin SaaS</h1>
          <p className="text-sm text-muted-foreground">Kelola perusahaan pengguna FlowF&B, paket, dan modul.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ l: 'Total Perusahaan', v: stats.total, i: Building2 }, { l: 'Trial', v: stats.trial, i: Clock },
          { l: 'Berlangganan', v: stats.active, i: Users }, { l: 'Trial ≤ 3 hari', v: stats.expiring, i: CalendarPlus }].map(({ l, v, i: I }) => (
          <Card key={l}><CardContent className="p-4 flex items-center gap-3">
            <I className="h-5 w-5 text-primary" /><div><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama / no. WA…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>{['Perusahaan', 'Paket', 'Status', 'Trial / Periode', 'Outlet', 'Menu', 'Modul', ''].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const s = STATUS[t.subscription_status] || { l: t.subscription_status, v: 'outline' as const };
              const left = daysLeft(t.trial_ends_at);
              return (
                <tr key={t.id} className="border-t">
                  <td className="p-3">
                    <div className="font-semibold flex items-center gap-2">{t.name}{t.is_platform_owner && <Badge variant="outline">Pilot</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{t.config?.phone || t.slug} · daftar {fmt(t.created_at)}</div>
                  </td>
                  <td className="p-3">{getPlan(t.plan).name}</td>
                  <td className="p-3"><Badge variant={s.v}>{s.l}</Badge></td>
                  <td className="p-3">{t.subscription_status === 'trial'
                    ? <span className={left !== null && left <= 3 ? 'text-destructive font-semibold' : ''}>{left !== null && left > 0 ? `Sisa ${left} hari` : 'Habis'}</span>
                    : fmt(t.current_period_end)}</td>
                  <td className="p-3">{counts[t.id]?.b || 0}</td>
                  <td className="p-3">{counts[t.id]?.p || 0}</td>
                  <td className="p-3">{t.modules?.length || 0}/{MODULES.length}</td>
                  <td className="p-3"><Button size="sm" variant="outline" onClick={() => setEdit(t)}><Settings2 className="h-4 w-4 mr-1" />Kelola</Button></td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Belum ada perusahaan.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {edit && (<>
            <DialogHeader><DialogTitle>{edit.name}</DialogTitle></DialogHeader>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold mb-1">Paket</div>
                <Select value={getPlan(edit.plan).id} onValueChange={(v) => save({ plan: v, modules: getPlan(v).modules }, `Paket ${getPlan(v).name} — modul disesuaikan`)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLANS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatPrice(p.price)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1">Status</div>
                <Select value={edit.subscription_status} onValueChange={(v) => save({ subscription_status: v })} disabled={edit.is_platform_owner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {!edit.is_platform_owner && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => extendTrial(7)}>+7 hari trial</Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => extendTrial(14)}>+14 hari trial</Button>
                <Button size="sm" disabled={saving} onClick={() => activate(1)}>Aktifkan 1 bulan</Button>
                <Button size="sm" disabled={saving} onClick={() => activate(12)}>Aktifkan 1 tahun</Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">Trial berakhir: {fmt(edit.trial_ends_at)} · Periode berakhir: {fmt(edit.current_period_end)}</div>
            <div>
              <div className="text-sm font-semibold mb-2">Modul aktif</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {MODULES.map((m) => {
                  const on = edit.modules?.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      {m.t}
                      <Switch checked={!!on} disabled={m.lock || saving}
                        onCheckedChange={(v) => save({ modules: v ? [...(edit.modules || []), m.id] : edit.modules.filter((x) => x !== m.id) })} />
                    </label>
                  );
                })}
              </div>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
