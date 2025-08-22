import { useEffect } from "react";
import { StockTransfer as StockTransferComponent } from "@/components/stock/StockTransfer";
import { useAuth } from "@/hooks/useAuth";

const StockTransfer = () => {
  const { user, userProfile } = useAuth();

  useEffect(() => {
    document.title = "Stock Transfer | Zeger ERP";
  }, []);

  if (!user || !userProfile) return null;

  return (
    <div className="space-y-6">
      <StockTransferComponent 
        role={userProfile.role}
        userId={userProfile.id}
        branchId={userProfile.branch_id}
      />
    </div>
  );
};

export default StockTransfer;
