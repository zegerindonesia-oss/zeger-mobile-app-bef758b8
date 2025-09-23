import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3,
  Clock,
  MapPin,
  History,
  Users,
  X,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems = [
  {
    title: "Dashboard",
    href: "/mobile-seller?tab=dashboard",
    icon: LayoutDashboard,
    key: "dashboard"
  },
  {
    title: "Penjualan",
    href: "/mobile-seller?tab=selling",
    icon: ShoppingCart,
    key: "selling"
  },
  {
    title: "Stock Management",
    href: "/mobile-seller?tab=stock",
    icon: Package,
    key: "stock"
  },
  {
    title: "Analytics",
    href: "/mobile-seller?tab=analytics",
    icon: BarChart3,
    key: "analytics"
  },
  {
    title: "Attendance",
    href: "/mobile-seller?tab=attendance",
    icon: Clock,
    key: "attendance"
  },
  {
    title: "Checkpoints",
    href: "/mobile-seller?tab=checkpoints",
    icon: MapPin,
    key: "checkpoints"
  },
  {
    title: "History",
    href: "/mobile-seller?tab=history",
    icon: History,
    key: "history"
  },
  {
    title: "Customers",
    href: "/mobile-seller?tab=customers",
    icon: Users,
    key: "customers"
  }
];

export const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'dashboard';

  const handleNavigation = (item: typeof navigationItems[0]) => {
    console.log('MobileSidebar navigation clicked:', item.key, item.href);
    navigate(item.href);
    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50",
        "lg:relative lg:translate-x-0 lg:shadow-none lg:border-r lg:border-gray-200",
        isOpen ? "translate-x-0" : "-translate-x-full lg:w-16"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <ZegerLogo className="w-8 h-8 text-primary" />
              {(isOpen || !window.matchMedia('(min-width: 1024px)').matches) && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Zeger Mobile</h2>
                  <p className="text-xs text-gray-500">Rider App</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.key;
                
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavigation(item)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors duration-200",
                      isActive 
                        ? "bg-primary text-white shadow-md" 
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {(isOpen || !window.matchMedia('(min-width: 1024px)').matches) && (
                      <span className="font-medium">{item.title}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {(isOpen || !window.matchMedia('(min-width: 1024px)').matches) && (
                <span>Logout</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};