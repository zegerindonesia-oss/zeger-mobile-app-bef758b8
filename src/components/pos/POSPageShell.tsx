import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCashier } from '@/lib/pos-cashier';

/** Full-page POS layout: keeps the POS sidebar visible around any cashier page. */
export const POSPageShell = ({ title, children }: { title: string; children: (ctx: { branchId: string | null; branchName: string }) => ReactNode }) => {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branchName, setBranchName] = useState('Cabang');
  const branchId = userProfile?.branch_id || null;
  useEffect(() => { if (branchId) supabase.from('branches').select('name').eq('id', branchId).maybeSingle().then(({ data }) => data && setBranchName(data.name)); }, [branchId]);
  const cashier = getActiveCashier(branchId);
  const props = {
    role: userProfile?.role,
    userName: cashier?.name || userProfile?.full_name || 'Kasir',
    branchName,
    onCashMovement: () => navigate('/pos/cashier?tab=kas'),
    onCloseShift: () => navigate('/pos/cashier?tab=shift'),
    onLogout: signOut,
    onRiderOrders: () => navigate('/pos/rider-orders'),
  };
  return (
    <div className="h-[100dvh] flex pos-canvas pos-touch overflow-hidden">
      <div className="hidden md:flex"><POSSidebar collapsed={collapsed} {...props} /></div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[260px] border-0 [&>button]:hidden"><POSSidebar collapsed={false} {...props} /></SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 flex flex-col gap-3 p-2 md:p-3 overflow-hidden">
        <header className="pos-command-header rounded-2xl min-h-14 md:min-h-16 px-2 md:px-4 py-2 flex items-center gap-3">
          <button onClick={() => (window.innerWidth < 768 ? setMobileOpen(true) : setCollapsed((c) => !c))} className="pos-raised-control h-10 w-10 shrink-0 rounded-xl flex items-center justify-center" title="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 leading-tight">
            <h1 className="text-base md:text-lg font-bold truncate">{title}</h1>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">{branchName}{cashier ? ` · Kasir: ${cashier.name}` : ''}</p>
          </div>
        </header>
        <section className="flex-1 min-h-0 overflow-y-auto pos-panel rounded-2xl p-3 md:p-5">{children({ branchId, branchName })}</section>
      </main>
    </div>
  );
};
