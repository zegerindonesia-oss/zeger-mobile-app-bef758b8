import { useState, useEffect, ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { ModernSidebar } from "./ModernSidebar";
import { ModernHeader } from "./ModernHeader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  role: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer';
  branch_id?: string;
  full_name: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  branch_type: string;
}

interface ModernLayoutProps {
  children?: ReactNode;
}

export const ModernLayout = ({ children }: ModernLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(profileData);

      // Fetch branch info if user is branch manager
      if (profileData?.branch_id) {
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('*')
          .eq('id', profileData.branch_id)
          .single();

        if (!branchError) {
          setBranch(branchData);
        }
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      <div className="fixed left-0 top-0 h-full z-50">
        <ModernSidebar 
          userRole={profile.role} 
          isOpen={sidebarOpen} 
          onToggle={toggleSidebar} 
        />
      </div>
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <ModernHeader 
          profile={profile}
          branch={branch}
          onMenuClick={toggleSidebar}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};