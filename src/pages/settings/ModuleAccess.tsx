import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, ShieldCheck } from 'lucide-react';

const db = supabase as any;
export const ACCESS_MODULES = [
  { id: 'pos', label: 'Terminal Kasir POS' },
  { id: 'procurement', label: 'PO & Invoice Pembelian' },
  { id: 'bom', label: 'Bahan Baku, Resep & BOM' },
  { id: 'inventory', label: 'Stok & Opname' },
  { id: 'finance', label: 'Keuangan & Cash Flow' },
  { id: 'menu', label: 'Manajemen Menu & Harga' },
  { id: 'reports', label: 'Laporan' },
  { id: 'rider', label: 'Rider & Distribusi' },
];

export default function ModuleAccess() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<any>(null);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id,user_id,full_name,role,branch_id').eq('is_active', true).order('full_name').then(({ data }) => setUsers(data || []));
  }, []);

  const pick = async (u: any) => {
    setSel(u);
    const { data } = await db.from('user_module_permissions').select('module_name').eq('user_id', u.id).eq('is_granted', true);
    setGranted(new Set((data || []).map((r: any) => r.module_name)));
  };

  const save = async () => {
    if (!sel) return;
    setSaving(true);
    const ids = ACCESS_MODULES.map((m) => m.id);
    const { error: e1 } = await db.from('user_module_permissions').delete().eq('user_id', sel.id).in('module_name', ids);
    const rows = [...granted].map((m) => ({ user_id: sel.id, module_name: m, permission_type: 'view', is_granted: true }));
    const { error: e2 } = rows.length ? await db.from('user_module_permissions').insert(rows) : { error: null };
    setSaving(false);
    if (e1 || e2) return toast.error((e1 || e2).message);
    toast.success(`Hak akses ${sel.full_name} disimpan`);
  };

  const list = useMemo(() => users.filter((u) => `${u.full_name} ${u.role}`.toLowerCase().includes(q.toLowerCase())), [users, q]);

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />Hak Akses Modul</h1>
        <p className="text-sm text-muted-foreground">Centang modul yang boleh dibuka setiap pengguna. Kasir cukup POS; manajer store bisa diberi Invoice, Bahan Baku, dst.</p>
      </div>
      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        <Card>
          <CardContent className="p-3 space-y-2">
            <Input placeholder="Cari pengguna..." value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-[60vh] overflow-auto space-y-1">
              {list.map((u) => (
                <button key={u.id} onClick={() => pick(u)} className={`w-full text-left rounded-lg px-3 py-2 hover:bg-muted ${sel?.id === u.id ? 'bg-muted' : ''}`}>
                  <div className="font-medium text-sm">{u.full_name}</div>
                  <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{sel ? sel.full_name : 'Pilih pengguna'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sel && (
              <>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ACCESS_MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer">
                      <Checkbox checked={granted.has(m.id)} onCheckedChange={(v) => {
                        const n = new Set(granted); v ? n.add(m.id) : n.delete(m.id); setGranted(n);
                      }} />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />Simpan Hak Akses</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
