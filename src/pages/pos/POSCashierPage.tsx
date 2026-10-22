import { useState } from 'react';
import { Wallet, FileBarChart } from 'lucide-react';
import { POSPageShell } from '@/components/pos/POSPageShell';
import { POSCashPage } from '@/components/pos/POSCashPage';
import { POSShiftPage } from '@/components/pos/POSShiftPage';
import { useAuth } from '@/hooks/useAuth';
import { getActiveCashier } from '@/lib/pos-cashier';
import { cn } from '@/lib/utils';

type Tab = 'kas' | 'shift';

/** Pengaturan Kasir: kas masuk/keluar, laporan X dan tutup shift dalam satu halaman. */
const POSCashierPage = () => {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState<Tab>((new URLSearchParams(window.location.search).get('tab') as Tab) || 'kas');
  const tabs = [
    { id: 'kas' as Tab, label: 'Kas Masuk / Keluar', icon: Wallet },
    { id: 'shift' as Tab, label: 'Laporan X & Tutup Shift', icon: FileBarChart },
  ];
  return (
    <POSPageShell title="Pengaturan Kasir">
      {({ branchId, branchName }) => (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('shrink-0 flex items-center gap-2 rounded-xl px-4 h-11 text-sm font-semibold transition', tab === t.id ? 'bg-primary text-primary-foreground shadow' : 'pos-raised-control')}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
          {tab === 'kas' && <POSCashPage branchId={branchId} />}
          {tab === 'shift' && <POSShiftPage branchId={branchId} branchName={branchName} kasirName={getActiveCashier(branchId)?.name || userProfile?.full_name || 'Kasir'} />}
        </div>
      )}
    </POSPageShell>
  );
};
export default POSCashierPage;
