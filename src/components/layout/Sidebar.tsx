import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Factory,
  ShoppingBag,
  Package,
  Building2,
  Wallet,
  Calculator,
  PieChart,
  Database,
  FileText,
  Coffee,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Calendar,
  Truck,
  Store,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SidebarProps {
  userRole?: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  children?: MenuItem[];
  roles?: string[];
}

// Removed the static menuItems array as it's now dynamic

export const Sidebar = ({ userRole = "customer", isOpen, onToggle }: SidebarProps) => {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["dashboard"]);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Berhasil logout");
      window.location.href = "/auth";
    } catch (error: any) {
      toast.error(error.message || "Gagal logout");
    }
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const getMenuItems = (): MenuItem[] => [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["ho_admin", "branch_manager", "finance"],
      children: [
        { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
        { id: "analytics", label: "Analytics", icon: PieChart, path: "/analytics" },
      ]
    },
    {
      id: "sales",
      label: "Sales",
      icon: ShoppingCart,
      roles: ["ho_admin", "branch_manager"],
      children: [
        { id: "pos", label: "Point of Sale", icon: ShoppingCart, path: "/pos" },
        { id: "orders", label: "Orders", icon: FileText, path: "/orders" },
        { id: "customers", label: "Customers", icon: Database, path: "/customers" },
      ]
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Package,
      roles: ["ho_admin", "branch_manager"],
      children: [
        { id: "stock", label: "Stock Management", icon: Package, path: "/inventory" },
        { id: "stock-transfer", label: "Kirim Stok ke Rider", icon: Truck, path: "/stock-transfer" },
        { id: "stock-movements", label: "Stock Movements", icon: FileText, path: "/stock-movements" },
        { id: "stock-returns", label: "Returns", icon: FileText, path: "/returns" },
      ]
    },
    {
      id: "finance",
      label: "Finance",
      icon: Wallet,
      roles: ["ho_admin", "branch_manager", "finance"],
      children: [
        { id: "profit-loss", label: "Laba Rugi", icon: FileText, path: "/finance/profit-loss" },
        { id: "cash-flow", label: "Arus Kas", icon: PieChart, path: "/finance/cash-flow" },
        { id: "balance-sheet", label: "Neraca", icon: FileText, path: "/finance/balance-sheet" },
        { id: "operational-expenses", label: "Beban Operasional", icon: FileText, path: "/finance/operational-expenses" },
        { id: "transactions", label: "Transactions", icon: FileText, path: "/reports/transactions" },
        { id: "daily-reports", label: "Daily Reports", icon: FileText, path: "/daily-reports" },
      ]
    },
    {
      id: "accounting",
      label: "Accounting",
      icon: Calculator,
      roles: ["ho_admin"],
      children: [
        { id: "chart-of-accounts", label: "Chart of Accounts", icon: FileText, path: "/chart-accounts" },
        { id: "journal", label: "Journal Entries", icon: FileText, path: "/journal" },
      ]
    },
    {
      id: "report",
      label: "Report",
      icon: FileText,
      roles: ["ho_admin", "branch_manager", "finance"],
      children: [
        { id: "sales-report", label: "Sales Report", icon: FileText, path: "/reports/sales" },
        { id: "inventory-report", label: "Inventory Report", icon: FileText, path: "/reports/inventory" },
        { id: "financial-report", label: "Financial Report", icon: FileText, path: "/reports/financial" },
      ]
    },
    {
      id: "admin",
      label: "Admin",
      icon: Settings,
      roles: ["ho_admin", "branch_manager"],
      children: [
        { id: "user-management", label: "User Management", icon: Users, path: userRole === 'ho_admin' ? "/admin/users" : "/branch/users" },
        { id: "branches", label: "Kelola Cabang", icon: Building2, path: "/branches", roles: ["ho_admin"] },
        { id: "riders", label: "Kelola Rider", icon: Truck, path: "/riders" }
      ]
    }
  ];

  const filteredMenuItems = getMenuItems().filter(item => 
    !item.roles || item.roles.includes(userRole)
  );

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    // Filter children based on roles if they have role restrictions
    const filteredChildren = item.children?.filter(child => 
      !child.roles || child.roles.includes(userRole)
    );
    const isExpanded = expandedMenus.includes(item.id);
    const isActive = location.pathname === item.path;
    const hasChildren = filteredChildren && filteredChildren.length > 0;

    return (
      <div key={item.id}>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={`w-full justify-start gap-2 px-3 py-2 h-auto text-left ${
            depth > 0 ? 'ml-6' : ''
          } ${isActive ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-foreground/80 hover:text-foreground'}`}
          onClick={() => {
            if (hasChildren) {
              toggleMenu(item.id);
            } else if (item.path) {
              navigate(item.path);
              if (window.innerWidth < 1024) {
                onToggle();
              }
            }
          }}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-sm">{item.label}</span>
          {hasChildren && (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {filteredChildren?.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Coffee className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Zeger ERP</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onToggle}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Menu Items */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {filteredMenuItems.map(item => renderMenuItem(item))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Separator className="mb-4" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 z-50 h-full w-80 bg-background border-r lg:relative lg:translate-x-0 transform transition-transform duration-200 ease-in-out">
        {sidebarContent}
      </div>
    </>
  );
};