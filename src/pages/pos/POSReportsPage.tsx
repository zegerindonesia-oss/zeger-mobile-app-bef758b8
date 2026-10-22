import { POSPageShell } from '@/components/pos/POSPageShell';
import { POSReportsDialog } from '@/components/pos/POSReportsDialog';
import { usePOSShift } from '@/hooks/usePOSShift';

const POSReportsPage = () => {
  const { activeShift } = usePOSShift();
  return (
    <POSPageShell title="Laporan Penjualan">
      {({ branchId, branchName }) => (
        <POSReportsDialog inline open onOpenChange={() => {}} branchId={branchId} shiftId={activeShift?.id || null} branchName={branchName} />
      )}
    </POSPageShell>
  );
};
export default POSReportsPage;
