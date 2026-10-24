import { useEffect, useState } from 'react';
import { Armchair, RefreshCw, Store } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePOSTables } from '@/hooks/usePOSTables';
import { supabase } from '@/integrations/supabase/client';
import { TableSetup } from '@/components/pos/POSTableMap';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canChooseTableBranch } from '@/lib/table-management';

const BranchTables = ({ branchId }: { branchId: string }) => {
  const { tables, sections, db, reload, loading, error } = usePOSTables(branchId);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-4 border-y py-4 text-sm">
      <span className="font-semibold">{tables.length} meja aktif</span>
      <span className="text-success">{tables.filter((t) => t.status === 'available').length} kosong</span>
      <span className="text-destructive">{tables.filter((t) => t.status === 'occupied' || t.status === 'billing').length} terisi</span>
      <span className="text-muted-foreground">{sections.length} area</span>
      <Button className="ml-auto" size="icon" variant="ghost" title="Muat ulang" aria-label="Muat ulang meja" onClick={reload} disabled={loading}><RefreshCw /></Button>
    </div>
    {error ? <div role="alert" className="text-destructive text-sm">{error}</div> : <TableSetup branchId={branchId} sections={sections} tables={tables} db={db} reload={reload} />}
  </div>;
};

const TableManagement = () => {
  const { userProfile } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const allBranches = canChooseTableBranch(userProfile?.role || '');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!userProfile) return;
      setLoading(true);
      let query = supabase.from('branches').select('id,name').eq('is_active', true).order('name');
      if (!allBranches) {
        if (!userProfile.branch_id) { setLoading(false); setError('Akun belum memiliki cabang.'); return; }
        query = query.eq('id', userProfile.branch_id);
      } else {
        const { data: tenant, error: tenantError } = await supabase.rpc('current_tenant_id');
        if (tenantError || !tenant) { if (alive) { setError(tenantError?.message || 'Tenant tidak ditemukan'); setLoading(false); } return; }
        query = query.eq('tenant_id', tenant);
      }
      const { data, error: queryError } = await query;
      if (!alive) return;
      setError(queryError?.message || ''); setBranches(data || []);
      setBranchId(data?.find((b) => b.id === userProfile.branch_id)?.id || data?.[0]?.id || '');
      setLoading(false);
    };
    load(); return () => { alive = false; };
  }, [userProfile?.id, userProfile?.branch_id, allBranches]);

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="flex items-center gap-3 text-2xl font-semibold"><Armchair className="text-primary h-6 w-6" />Manajemen Meja & QR</h1>
      <div className="flex items-center gap-2"><Store className="h-4 w-4 text-muted-foreground" /><Select value={branchId} onValueChange={setBranchId} disabled={!allBranches || loading}><SelectTrigger className="w-64 max-w-full" aria-label="Cabang meja"><SelectValue placeholder="Pilih cabang" /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    </header>
    {loading ? <p className="text-muted-foreground">Memuat cabang...</p> : error ? <p role="alert" className="text-destructive">{error}</p> : branchId ? <BranchTables key={branchId} branchId={branchId} /> : <p className="text-muted-foreground">Belum ada cabang aktif.</p>}
  </div>;
};

export default TableManagement;