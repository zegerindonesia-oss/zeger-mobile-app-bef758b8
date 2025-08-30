import { useState } from "react";
import { Plus, Scan, FileText, Users, Package, TrendingUp, Smartphone, Coffee, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface EnhancedQuickActionsProps {
  role: 'ho' | 'branch' | 'rider';
}

const actionsByRole = {
  ho: [
    { 
      icon: Users, 
      label: "Kelola Cabang", 
      description: "Buat cabang baru", 
      color: "bg-primary",
      action: "manage_branches",
      route: "/branches"
    },
    { 
      icon: FileText, 
      label: "Lihat Laporan", 
      description: "Analisis keuangan", 
      color: "bg-success",
      action: "view_reports",
      route: "/reports/transactions"
    },
    { 
      icon: TrendingUp, 
      label: "Analytics", 
      description: "Metrik performa", 
      color: "bg-warning",
      action: "analytics",
      route: "/reports/transactions"
    },
    { 
      icon: Package, 
      label: "Inventori", 
      description: "Kelola stok", 
      color: "bg-destructive",
      action: "inventory",
      route: "/inventory"
    }
  ],
  branch: [
    { 
      icon: Users, 
      label: "Tambah Rider", 
      description: "Daftarkan rider baru", 
      color: "bg-primary",
      action: "add_rider",
      route: "/admin/users"
    },
    { 
      icon: Package, 
      label: "Manajemen Stok", 
      description: "Kelola inventori", 
      color: "bg-success",
      action: "stock_management",
      route: "/inventory"
    },
    { 
      icon: FileText, 
      label: "Laporan Rider", 
      description: "Lihat performa", 
      color: "bg-warning",
      action: "rider_reports",
      route: "/riders"
    },
    { 
      icon: Plus, 
      label: "Pesanan Baru", 
      description: "Input manual", 
      color: "bg-destructive",
      action: "new_order",
      route: "/pos"
    }
  ],
  rider: [
    { 
      icon: Scan, 
      label: "Scan Menu", 
      description: "Pesanan QR code", 
      color: "bg-primary",
      action: "scan_menu",
      route: "/mobile-seller"
    },
    { 
      icon: Plus, 
      label: "Pesanan Manual", 
      description: "Tambah pesanan", 
      color: "bg-success",
      action: "manual_order",
      route: "/mobile-seller"
    },
    { 
      icon: Package, 
      label: "Cek Stok", 
      description: "Lihat inventori", 
      color: "bg-warning",
      action: "check_stock",
      route: "/mobile-seller"
    },
    { 
      icon: FileText, 
      label: "Laporan Harian", 
      description: "Kirim laporan", 
      color: "bg-destructive",
      action: "daily_report",
      route: "/mobile-seller"
    }
  ]
};

export const EnhancedQuickActions = ({ role }: EnhancedQuickActionsProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("");
  const navigate = useNavigate();
  const actions = actionsByRole[role];

  const handleActionClick = (action: any) => {
    // Navigate to route if available
    if (action.route) {
      toast.success(`Navigasi ke ${action.label}`);
      navigate(action.route);
    } else {
      // Show dialog for actions without routes
      setSelectedAction(action.action);
      setShowDialog(true);
    }
  };

  const getDialogContent = () => {
    switch (selectedAction) {
      case "scan_menu":
        return (
          <div className="text-center py-6">
            <Scan className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Scan QR Menu</h3>
            <p className="text-muted-foreground mb-4">
              Arahkan kamera ke QR code menu untuk melihat daftar produk
            </p>
            <Button onClick={() => setShowDialog(false)} className="w-full">
              <Coffee className="w-4 h-4 mr-2" />
              Buka Kamera
            </Button>
          </div>
        );
      case "add_rider":
        return (
          <div className="text-center py-6">
            <Users className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Tambah Rider Baru</h3>
            <p className="text-muted-foreground mb-4">
              Fitur ini akan membuka form pendaftaran rider baru
            </p>
            <Button onClick={() => setShowDialog(false)} className="w-full">
              Lanjutkan ke Form
            </Button>
          </div>
        );
      default:
        return (
          <div className="text-center py-6">
            <Package className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Fitur Dalam Pengembangan</h3>
            <p className="text-muted-foreground mb-4">
              Fitur ini sedang dalam tahap pengembangan dan akan segera tersedia
            </p>
            <Button onClick={() => setShowDialog(false)} className="w-full">
              Tutup
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-card animate-slide-up">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Aksi Cepat</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant="ghost"
              className="h-auto p-4 flex flex-col items-center gap-2 glass-card hover:scale-105 transition-all duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleActionClick(action)}
            >
              <div className={`p-3 rounded-xl ${action.color} text-white`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Button>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aksi Cepat</DialogTitle>
          </DialogHeader>
          {getDialogContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
};