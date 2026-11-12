import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { HubRiderRequestQueue, RiderBrandSettings } from "@/components/stock/RiderStockRequests";

export default function RiderOrders() {
  const { userProfile } = useAuth();
  useEffect(() => { document.title = "Pesanan Rider | Flow F&B"; }, []);
  if (!userProfile) return null;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pesanan Rider</h1>
        <p className="text-sm text-muted-foreground">Order stok dari rider ke Central Kitchen. Tambahkan sisa stok shift sebelumnya, cetak stiker, lalu kirim stok.</p>
      </div>
      <RiderBrandSettings />
      <HubRiderRequestQueue branchId={userProfile.branch_id || undefined} />
    </div>
  );
}
