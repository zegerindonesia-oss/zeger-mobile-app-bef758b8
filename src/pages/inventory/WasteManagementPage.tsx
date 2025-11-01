import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";
import { WasteManagement } from "@/components/inventory/WasteManagement";

export default function WasteManagementPage() {
  const { userProfile } = useAuth();
  const { assignedRiderId } = useRiderFilter();

  useEffect(() => {
    document.title = "Waste Management | Zeger ERP";
  }, []);

  if (!userProfile) return null;

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Waste Management</h1>
        <p className="text-sm text-muted-foreground">
          Kelola dan monitor product waste harian
        </p>
      </header>
      <WasteManagement 
        userProfile={userProfile} 
        assignedRiderId={assignedRiderId}
      />
    </main>
  );
}
