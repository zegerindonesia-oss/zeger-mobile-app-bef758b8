import { useState, useEffect, ReactNode } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { 
  Home,
  DollarSign,
  FileText,
  LogOut,
  Menu,
  X,
  BarChart3,
  PieChart,
  TrendingUp,
  Trash2
} from "lucide-react";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface BranchHubReportLayoutProps {
  children?: ReactNode;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/bh-report-dashboard"
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: FileText,
    path: "/bh-report-transactions"
  },
  {
    id: "transaction-details",
    label: "Detail Transaction",
    icon: BarChart3,
    path: "/bh-report-transaction-details"
  },
  {
    id: "rider-performance",
    label: "Performa Rider",
    icon: TrendingUp,
    path: "/bh-report-rider-performance"
  },
  {
    id: "waste-management",
    label: "Waste Management",
    icon: Trash2,
    path: "/bh-report-waste-management"
  },
  {
    id: "profit-loss",
    label: "Laba Rugi",
    icon: FileText,
    path: "/bh-report-profit-loss"
  },
  {
    id: "cash-flow",
    label: "Arus Kas",
    icon: PieChart,
    path: "/bh-report-cash-flow"
  }
];

export const BranchHubReportLayout = ({ children }: BranchHubReportLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, userProfile } = useAuth();
  const { assignedRiderName } = useRiderFilter();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      toast.success("Berhasil logout");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Gagal logout: " + error.message);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (!userProfile) {
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
    <div className="min-h-screen gradient-bg flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full bg-primary text-primary-foreground z-50 transition-all duration-300 ease-in-out flex flex-col",
        sidebarOpen ? "w-64" : "w-20",
        !sidebarOpen && "lg:w-20"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-primary-light/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ZegerLogo size="sm" className="w-8 h-8" />
              {sidebarOpen && (
                <div>
                  <h2 className="font-semibold text-sm">Zeger Report</h2>
                  <p className="text-xs text-primary-foreground/70">{assignedRiderName}</p>
                </div>
              )}
            </div>
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-lg hover:bg-primary-light/20 transition-colors"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-3 rounded-full transition-all duration-200 group",
                    isActive 
                      ? "bg-white/20 text-white shadow-lg" 
                      : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium text-sm flex-1">{item.label}</span>
                  )}
                  {!sidebarOpen && (
                    <div className="absolute left-16 bg-primary-dark text-white px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-primary-light/20">
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-full transition-all duration-200 w-full text-left group",
              "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && (
              <span className="font-medium text-sm">Logout</span>
            )}
            {!sidebarOpen && (
              <div className="absolute left-16 bg-primary-dark text-white px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Logout
              </div>
            )}
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Branch Hub Report</h1>
                <p className="text-sm text-gray-500">{assignedRiderName}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Card className="px-3 py-2">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-sm font-medium">{userProfile.full_name}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};