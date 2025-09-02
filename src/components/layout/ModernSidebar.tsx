import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { 
  Home,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  FileText,
  HelpCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Truck,
  Building2,
  Factory,
  Calculator,
  PieChart,
  Coffee,
  Store,
  Database,
  Calendar,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  children?: MenuItem[];
  roles?: string[];
}

interface ModernSidebarProps {
  userRole: string;
  isOpen: boolean;
  onToggle: () => void;
}

const getMenuItems = (userRole: string): MenuItem[] => [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/admin",
    roles: ["ho_admin", "branch_manager", "finance"]
  },
  {
    id: "sales",
    label: "Sales & POS",
    icon: ShoppingCart,
    roles: ["ho_admin", "branch_manager"],
    children: [
      { id: "pos", label: "Point of Sale", icon: ShoppingCart, path: "/pos" },
      { id: "transactions", label: "Transactions", icon: FileText, path: "/transactions" },
      { id: "transaction-details", label: "Details Transaction", icon: BarChart3, path: "/transaction-details" },
      { id: "customers", label: "Customers", icon: Database, path: "/customers" }
    ]
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    roles: ["ho_admin", "branch_manager"],
    children: [
      { id: "production", label: "Production", icon: Factory, path: "/inventory/production" },
      { id: "stock", label: "Stock Management", icon: Package, path: "/inventory" },
      { id: "stock-transfer", label: "Kirim Stok ke Rider", icon: Truck, path: "/stock-transfer" },
      { id: "branch-transfer", label: "Kirim Stok Ke Small Branch", icon: Store, path: "/inventory/branch-transfer" }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    roles: ["ho_admin", "branch_manager", "finance"],
    children: [
      { id: "profit-loss", label: "Laba Rugi", icon: FileText, path: "/finance/profit-loss" },
      { id: "cash-flow", label: "Arus Kas", icon: PieChart, path: "/finance/cash-flow" },
      { id: "balance-sheet", label: "Neraca", icon: FileText, path: "/finance/balance-sheet" },
      { id: "operational-expenses", label: "Beban Operasional", icon: FileText, path: "/finance/operational-expenses" }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["ho_admin", "branch_manager", "finance"],
    children: [
      { id: "sales-report", label: "Sales Report", icon: FileText, path: "/reports/sales" },
      { id: "inventory-report", label: "Inventory Report", icon: FileText, path: "/reports/inventory" },
      { id: "financial-report", label: "Financial Report", icon: FileText, path: "/reports/financial" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    icon: Users,
    roles: ["ho_admin", "branch_manager"],
    children: [
      { id: "user-management", label: "User Management", icon: Users, path: userRole === 'ho_admin' ? "/admin/users" : "/admin-users" },
      { id: "branches", label: "Kelola Cabang", icon: Building2, path: "/branches", roles: ["ho_admin"] },
      { id: "riders", label: "Kelola Rider", icon: Truck, path: "/riders" }
    ]
  },
  { id: "help", label: "Help & Support", icon: HelpCircle, path: "/help", roles: ["ho_admin", "branch_manager"] },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings", roles: ["ho_admin", "branch_manager"] }
];

export const ModernSidebar = ({ userRole, isOpen, onToggle }: ModernSidebarProps) => {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["dashboard"]);
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

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const menuItems = getMenuItems(userRole);
  const filteredMenuItems = menuItems.filter(item => 
    !item.roles || item.roles.includes(userRole)
  );

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const Icon = item.icon;
    const filteredChildren = item.children?.filter(child => 
      !child.roles || child.roles.includes(userRole)
    );
    const hasChildren = filteredChildren && filteredChildren.length > 0;
    const isExpanded = expandedMenus.includes(item.id);
    
    return (
      <div key={item.id}>
        <NavLink
          to={item.path || "#"}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleMenu(item.id);
            } else if (!item.path) {
              e.preventDefault();
            }
          }}
           className={({ isActive }) => cn(
             "flex items-center gap-3 px-3 py-3 rounded-full transition-all duration-200 group",
             isChild && "ml-4",
             (isActive && item.path) 
               ? "bg-white/20 text-white shadow-lg" 
               : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
           )}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          {isOpen && (
            <>
              <span className="font-medium text-sm flex-1">{item.label}</span>
              {hasChildren && (
                isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              )}
            </>
          )}
          {!isOpen && (
            <div className="absolute left-16 bg-primary-dark text-white px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
              {item.label}
            </div>
          )}
        </NavLink>
        
        {hasChildren && isExpanded && isOpen && (
          <div className="mt-1 space-y-1">
            {filteredChildren?.map(child => renderMenuItem(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full bg-primary text-primary-foreground z-50 transition-all duration-300 ease-in-out flex flex-col",
        isOpen ? "w-64" : "w-20",
        !isOpen && "lg:w-20"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-primary-light/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ZegerLogo size="sm" className="w-8 h-8" />
              {isOpen && (
                <div>
                  <h2 className="font-semibold text-sm">Zeger</h2>
                  <p className="text-xs text-primary-foreground/70">Coffee & More</p>
                </div>
              )}
            </div>
            <button
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-primary-light/20 transition-colors"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {filteredMenuItems.map(item => renderMenuItem(item))}
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
            {isOpen && (
              <span className="font-medium text-sm">Logout</span>
            )}
            {!isOpen && (
              <div className="absolute left-16 bg-primary-dark text-white px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Logout
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
};