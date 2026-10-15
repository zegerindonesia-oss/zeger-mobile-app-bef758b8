import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { HubRiderRequestQueue } from "@/components/stock/RiderStockRequests";

export default function POSRiderOrders() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { document.title = "Pesanan Rider | POS Flow F&B"; }, []);
  if (!userProfile) return null;
  return (
    <div className="min-h-screen bg-background">
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
  );
}
