import { EnhancedUserManagement } from "@/components/user/EnhancedUserManagement";
import { ComprehensiveUserForm } from "@/components/user/ComprehensiveUserForm";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "@/components/common/SyncButton";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { useState } from "react";

const SettingsUserManagement = () => {
  const { userProfile } = useAuth();
  const [isComprehensiveFormOpen, setIsComprehensiveFormOpen] = useState(false);

  if (!userProfile) {
    return <div>Loading...</div>;
  }

  const handleUserCreated = () => {
    // Refresh the user list or handle success
    window.location.reload(); // Simple refresh, could be improved with state management
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Kelola pengguna dan hak akses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsComprehensiveFormOpen(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Tambah User (Advanced)
          </Button>
          <SyncButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <EnhancedUserManagement 
            role={userProfile.role as any} 
            branchId={userProfile.branch_id || undefined} 
          />
        </CardContent>
      </Card>

      <ComprehensiveUserForm
        isOpen={isComprehensiveFormOpen}
        onClose={() => setIsComprehensiveFormOpen(false)}
        onSuccess={handleUserCreated}
        userRole={userProfile.role}
        branchId={userProfile.branch_id || undefined}
      />
    </div>
  );
};

export default SettingsUserManagement;