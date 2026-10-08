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
  ChevronRight,
  MapPin,
  Banknote,
  UserCog,
  Trash2,
  Smartphone,
  LayoutDashboard,
  Award,
  Image,
  Receipt,
  ClipboardList
} from "lucide-react";
import { MapPin as LocationPin } from "lucide-react";
import { FlowMark } from "@/components/flow/FlowLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenantModules } from "@/hooks/useTenantModules";

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  children?: MenuItem[];
  roles?: string[];
  module?: string;
}

interface ModernSidebarProps {
  userRole: string;
  isOpen: boolean;
  onToggle: () => void;
}

// Helper function to check user level and permissions
const getUserLevel = (role: string): number => {
  if (role.startsWith('1_')) return 1; // HO level
  if (role.startsWith('2_')) return 2; // Hub level  
  if (role.startsWith('3_')) return 3; // Small Branch level
  // Legacy role mapping
  if (['ho_admin', 'ho_owner', 'ho_staff'].includes(role)) return 1;
  if (['branch_manager', 'bh_staff', 'bh_kasir', 'bh_rider'].includes(role)) return 2;
  if (['sb_branch_manager', 'sb_kasir', 'sb_rider'].includes(role)) return 3;
  return 99;
};

const getMenuItems = (userRole: string): MenuItem[] => [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/admin",
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager", "finance"]
  },
  {
    id: "analytics",
    label: "Analytics", 
    icon: BarChart3,
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager", "bh_report"],
    children: [
      { id: "central-kitchen", label: "Branch Hub", icon: Coffee, path: "/analytics/central-kitchen", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "ho_admin", "branch_manager"] },
      { id: "transactions", label: "Transactions", icon: FileText, path: "/transactions" },
      { id: "transaction-details", label: "Details Transaction", icon: BarChart3, path: "/transaction-details" },
      { id: "cash-deposit", label: "Cash Deposit", icon: Banknote, path: "/analytics/cash-deposit", module: "rider", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"] },
      { id: "orders-management", label: "Online Orders", icon: ShoppingCart, path: "/orders-management", module: "customer_app", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"] },
      { id: "customers", label: "Customers", icon: Database, path: "/customers", module: "loyalty" },
      { id: "rider-performance", label: "Performa Rider", icon: Users, path: "/rider-performance", module: "rider" },
      { id: "location-analytics", label: "Location Analytics", icon: LocationPin, path: "/location-analytics", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "bh_report"] }
    ]
  },
  {
    id: "invoicing",
    label: "Invoicing",
    icon: Receipt,
    roles: ["1_HO_Admin", "1_HO_Owner", "1_HO_Staff", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "ho_owner", "ho_staff", "branch_manager", "sb_branch_manager", "finance"],
    children: [
      { id: "inv-sales", label: "Invoice Penjualan", icon: Receipt, path: "/invoicing/sales" },
      { id: "inv-sales-orders", label: "Pesanan Penjualan", icon: ClipboardList, path: "/invoicing/sales-orders" },
      { id: "inv-po", label: "PO Pembelian", icon: ShoppingCart, path: "/invoicing/purchase-orders" },
      { id: "inv-purchase", label: "Invoice Pembelian", icon: FileText, path: "/invoicing/purchase-invoices" },
      { id: "inv-customers", label: "Pelanggan B2B", icon: Users, path: "/invoicing/customers" },
      { id: "inv-suppliers", label: "Supplier", icon: Truck, path: "/invoicing/suppliers" }
    ]
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"],
    children: [
      { id: "purchasing", label: "Purchasing", icon: ShoppingCart, path: "/inventory/purchasing", roles: ["3_SB_Branch_Manager", "sb_branch_manager"] },
      { id: "stock", label: "Stock Management", icon: Package, path: "/inventory" },
      { id: "waste-management", label: "Waste Management", icon: Trash2, path: "/inventory/waste-management", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"] },
      { id: "small-branch-stock", label: "Small Branch Stock", icon: Store, path: "/inventory/small-branch-stock", roles: ["3_SB_Branch_Manager", "sb_branch_manager"] },
      { id: "stock-transfer", label: "Kirim Stok ke Rider", icon: Truck, path: "/stock-transfer", module: "rider", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"] },
      { id: "stock-card-rider", label: "Stock Card Rider", icon: FileText, path: "/inventory/stock-card-rider", module: "rider", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"] },
      { id: "branch-transfer", label: "Kirim Stok Ke Small Branch", icon: Store, path: "/inventory/branch-transfer", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "ho_admin", "branch_manager"] }
    ]
  },
  {
    id: "data-master",
    label: "Data Master",
    icon: Database,
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"],
    children: [
      { id: "master-products", label: "Produk / Menu", icon: Coffee, path: "/master/products" },
      { id: "raw-materials", label: "Bahan Baku, WIP & Resep", icon: Package, path: "/inventory/raw-materials", module: "bom", roles: ["1_HO_Admin", "1_HO_Owner", "1_HO_Staff", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "ho_owner", "ho_staff", "branch_manager", "sb_branch_manager"] },
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    module: "finance",
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager", "finance", "bh_report"],
    children: [
      { id: "profit-loss", label: "Laba Rugi", icon: FileText, path: "/finance/profit-loss" },
      { id: "cash-flow", label: "Arus Kas", icon: PieChart, path: "/finance/cash-flow" },
      { id: "balance-sheet", label: "Neraca", icon: FileText, path: "/finance/balance-sheet" },
      { id: "operational-expenses", label: "Beban Operasional", icon: FileText, path: "/finance/operational-expenses", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager", "bh_report"] },
      { id: "rider-income", label: "Pendapatan Rider", icon: Calculator, path: "/finance/rider-income", module: "rider", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager", "finance"] }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "finance"],
    children: [
      { id: "sales-report", label: "Sales Report", icon: FileText, path: "/reports/sales" },
      { id: "inventory-report", label: "Inventory Report", icon: FileText, path: "/reports/inventory" },
      { id: "financial-report", label: "Financial Report", icon: FileText, path: "/reports/financial" }
    ]
  },
  { 
    id: "help", 
    label: "Help & Support", 
    icon: HelpCircle, 
    path: "/help", 
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "ho_admin", "branch_manager"]
  },
  { 
    id: "settings", 
    label: "Settings", 
    icon: Settings, 
    roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"],
    children: [
      { id: "pos-branch-config", label: "Pengaturan POS Cabang", icon: Store, path: "/settings/pos-branches", roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "3_SB_Branch_Manager", "ho_admin", "branch_manager", "sb_branch_manager"] },
      { id: "module-access", label: "Hak Akses Modul", icon: UserCog, path: "/settings/module-access", roles: ["1_HO_Admin", "1_HO_Owner", "ho_admin", "ho_owner"] },
      { id: "saas-tenants", label: "Superadmin SaaS", icon: Building2, path: "/settings/tenants", roles: ["1_HO_Admin", "1_HO_Owner", "ho_admin", "ho_owner"] },
      { 
        id: "app-management", 
        label: "App Management", 
        icon: Smartphone, 
        roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "ho_admin", "branch_manager"],
        module: "customer_app",
        children: [
          {
            id: "app-overview",
            label: "Overview",
            icon: LayoutDashboard,
            path: "/settings/app-management"
          },
          {
            id: "promo-banners",
            label: "Promo & Banners",
            icon: Image,
            path: "/settings/app-management/promo-banners"
          },
          {
            id: "loyalty-settings",
            label: "Loyalty Settings",
            icon: Award,
            path: "/settings/app-management/loyalty"
          },
          {
            id: "crm",
            label: "CRM",
            icon: Users,
            path: "/settings/app-management/crm"
          }
        ]
      },
      { 
        id: "user-management", 
        label: "User Management", 
        icon: Users, 
        path: "/settings/users"
      },
      { 
        id: "rider-management", 
        label: "Rider Management", 
        icon: Truck, 
        path: "/settings/riders",
        module: "rider"
      },
      { 
        id: "branch-management", 
        label: "Branch Management", 
        icon: Building2, 
        path: "/settings/branches",
        roles: ["1_HO_Admin", "1_HO_Owner", "2_Hub_Branch_Manager", "ho_admin", "branch_manager"]
      },
      { 
        id: "rider-reassignment", 
        label: "Rider Reassignment", 
        icon: UserCog, 
        path: "/settings/rider-reassignment",
        module: "rider",
        roles: ["1_HO_Admin", "ho_admin"]
      }
    ]
  }
];

export const ModernSidebar = ({ userRole, isOpen, onToggle }: ModernSidebarProps) => {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["dashboard"]);
  const navigate = useNavigate();
  const { hasModule } = useTenantModules();

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
    (!item.roles || item.roles.includes(userRole)) && hasModule(item.module)
  );

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const Icon = item.icon;
    const filteredChildren = item.children?.filter(child => 
      (!child.roles || child.roles.includes(userRole)) && hasModule(child.module)
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
        "fixed left-2 top-2 bottom-2 bo-sidebar text-primary-foreground z-50 transition-all duration-300 ease-in-out flex flex-col overflow-y-auto",
        isOpen ? "w-64" : "w-[72px]"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-primary-light/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-2xl bg-background grid place-items-center shadow-md flex-shrink-0">
                <FlowMark className="h-7 w-7" />
              </span>
              {isOpen && (
                <div className="leading-tight">
                  <h2 className="font-extrabold text-base tracking-tight">Flow F&amp;B</h2>
                  <p className="text-[10px] tracking-[0.3em] text-primary-foreground/75">ERP BACK OFFICE</p>
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