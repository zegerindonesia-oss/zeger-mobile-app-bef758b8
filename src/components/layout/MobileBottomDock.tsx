import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  Package,
  ShoppingCart,
  FileText,
  Menu as MenuIcon,
  BarChart3,
  Wallet,
  DollarSign,
  History,
  ShoppingBag,
  Clock,
  MapPin,
  Trash2,
  Users,
  User,
  LogOut,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

type DockItemKey = "dashboard" | "stock" | "selling" | "reports" | "menu";

interface ListItem {
  label: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
}

const reportItems: ListItem[] = [
  { label: "Analytics", tab: "analytics", icon: BarChart3 },
  { label: "Pendapatan", tab: "income", icon: DollarSign },
  { label: "Setoran Tunai", tab: "cash-deposit", icon: Wallet },
  { label: "Riwayat Transaksi", tab: "history", icon: History },
  { label: "Order Online", tab: "orders-online", icon: ShoppingBag },
];

const menuItems: ListItem[] = [
  { label: "Attendance", tab: "attendance", icon: Clock },
  { label: "Checkpoints", tab: "checkpoints", icon: MapPin },
  { label: "Waste Report", tab: "waste", icon: Trash2 },
  { label: "Customers", tab: "customers", icon: Users },
  { label: "Profile", tab: "profile", icon: User },
];

export const MobileBottomDock = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [openSheet, setOpenSheet] = useState<"reports" | "menu" | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get("tab") || "dashboard";

  const go = (tab: string) => {
    navigate(`/mobile-seller?tab=${tab}`);
    setOpenSheet(null);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const isReportTab = reportItems.some((i) => i.tab === currentTab);
  const isMenuTab = menuItems.some((i) => i.tab === currentTab);

  const DockButton = ({
    active,
    onClick,
    icon: Icon,
    label,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors",
        active ? "text-red-600" : "text-gray-500 hover:text-gray-700"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );

  const ListSheet = ({
    title,
    items,
    open,
    onOpenChange,
    showLogout,
  }: {
    title: string;
    items: ListItem[];
    open: boolean;
    onOpenChange: (v: boolean) => void;
    showLogout?: boolean;
  }) => (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[75vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => go(item.tab)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors",
                  active
                    ? "border-red-500 bg-red-50 text-red-600"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
          {showLogout && (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-center text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-6 w-6" />
              <span className="text-xs font-medium leading-tight">Keluar</span>
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md px-1 pt-1 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative mx-auto flex max-w-md items-end justify-between">
          <DockButton
            active={currentTab === "dashboard"}
            onClick={() => go("dashboard")}
            icon={Home}
            label="Home"
          />
          <DockButton
            active={currentTab === "stock"}
            onClick={() => go("stock")}
            icon={Package}
            label="Stok"
          />

          {/* Center cart - elevated */}
          <div className="flex flex-1 justify-center">
            <button
              onClick={() => go("selling")}
              aria-label="Penjualan"
              className={cn(
                "-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition-transform",
                currentTab === "selling"
                  ? "bg-red-700 scale-105"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              <ShoppingCart className="h-7 w-7 text-white" />
            </button>
          </div>

          <DockButton
            active={isReportTab || openSheet === "reports"}
            onClick={() => setOpenSheet(openSheet === "reports" ? null : "reports")}
            icon={FileText}
            label="Laporan"
          />
          <DockButton
            active={isMenuTab || openSheet === "menu"}
            onClick={() => setOpenSheet(openSheet === "menu" ? null : "menu")}
            icon={MenuIcon}
            label="Menu"
          />
        </div>
      </nav>

      <ListSheet
        title="Laporan"
        items={reportItems}
        open={openSheet === "reports"}
        onOpenChange={(v) => setOpenSheet(v ? "reports" : null)}
      />
      <ListSheet
        title="Menu Lainnya"
        items={menuItems}
        open={openSheet === "menu"}
        onOpenChange={(v) => setOpenSheet(v ? "menu" : null)}
        showLogout
      />
    </>
  );
};

export default MobileBottomDock;