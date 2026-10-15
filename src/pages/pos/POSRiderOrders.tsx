import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { HubRiderRequestQueue } from "@/components/stock/RiderStockRequests";
import { POSSidebar } from "@/components/pos/POSSidebar";

export default function POSRiderOrders() {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { document.title = "Pesanan Rider | POS Flow F&B"; }, []);
  if (!userProfile) return null;
  return (
    <div className="h-[100dvh] flex bg-background overflow-hidden">
      <div className="hidden md:flex">
        <POSSidebar
          collapsed
          role={userProfile.role}
          userName={userProfile.full_name || "Kasir"}
          branchName=""
          onCashMovement={() => navigate("/pos/settings?tab=kas")}
          onCloseShift={() => navigate("/pos/settings?tab=shift")}
          onXReport={() => navigate("/pos/settings?tab=shift")}
          onLogout={signOut}
          onRiderOrders={() => navigate("/pos/rider-orders")}
        />
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur">
          <Button variant="outline" size="sm" onClick={() => navigate("/pos")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Kasir
          </Button>
          <Truck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Pesanan Rider</h1>
            <p className="text-xs text-muted-foreground">Order stok dari rider ke Central Kitchen</p>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4">
          <HubRiderRequestQueue branchId={userProfile.branch_id || undefined} />
        </main>
      </div>
    </div>
  );
}
