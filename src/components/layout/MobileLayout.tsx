import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { MobileSidebar } from "./MobileSidebar";
import { MobileHeader } from "./MobileHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ShoppingCart, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SyncButton } from "@/components/common/SyncButton";

interface Profile {
  id: string;
  role: string;
  branch_id: string | null;
  full_name: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  branch_type: string;
}

interface MobileLayoutProps {
  children?: React.ReactNode;
}

export const MobileLayout = ({ children }: MobileLayoutProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (profileData?.branch_id) {
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('*')
          .eq('id', profileData.branch_id)
          .single();

        if (branchError) throw branchError;
        setBranch(branchData);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-white via-red-50/30 to-white overflow-x-hidden">
        <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 flex flex-col max-w-full">
          <MobileHeader 
            onToggleSidebar={toggleSidebar}
            profile={profile}
            branch={branch}
          />
          
          <main className="flex-1 overflow-auto pb-16 mt-16 px-safe">
            <div className="max-w-full overflow-x-hidden">
              {children || <Outlet />}
            </div>
          </main>
          
          {/* Fixed Bottom Action Buttons */}
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {/* Sync Button */}
            <SyncButton variant="outline" size="icon" className="rounded-full w-12 h-12 bg-white border-2 border-blue-200 shadow-lg hover:bg-blue-50" />
            
            {/* Shopping Cart Button */}
            <Button
              size="lg"
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 shadow-lg"
              onClick={() => navigate('/mobile-seller?tab=selling')}
            >
              <ShoppingCart className="h-6 w-6 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};