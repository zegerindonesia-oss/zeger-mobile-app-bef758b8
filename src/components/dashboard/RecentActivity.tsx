import { Clock, CheckCircle, AlertCircle, TrendingUp, User, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface RecentActivityProps {
  role: 'ho' | 'branch' | 'rider';
}

const activityData = {
  ho: [
    {
      id: 1,
      type: "sale",
      title: "Cabang Jakarta Pusat menyelesaikan 45 pesanan",
      description: "Total pendapatan: Rp 2.250.000",
      time: "2 menit yang lalu",
      status: "success",
      icon: CheckCircle,
      avatar: "JP"
    },
    {
      id: 2,
      type: "alert",
      title: "Cabang Surabaya - Peringatan stok rendah",
      description: "Kopi Espresso hampir habis (5 item tersisa)",
      time: "15 menit yang lalu",
      status: "warning",
      icon: AlertCircle,
      avatar: "SB"
    },
    {
      id: 3,
      type: "rider",
      title: "Rider baru Andi bergabung di Cabang Bandung",
      description: "Berhasil menyelesaikan onboarding",
      time: "1 jam yang lalu",
      status: "success",
      icon: User,
      avatar: "AN"
    },
    {
      id: 4,
      type: "report",
      title: "Laporan harian dari Cabang Medan",
      description: "Pendapatan: Rp 1.850.000 | Pesanan: 32",
      time: "2 jam yang lalu",
      status: "info",
      icon: TrendingUp,
      avatar: "MD"
    }
  ],
  branch: [
    {
      id: 1,
      type: "rider",
      title: "Rider Budi started shift",
      description: "GPS location confirmed at 08:00",
      time: "5 minutes ago",
      status: "success",
      icon: MapPin,
      avatar: "BD"
    },
    {
      id: 2,
      type: "sale",
      title: "Rider Sari completed 12 orders",
      description: "Total sales: Rp 650,000",
      time: "20 minutes ago",
      status: "success",
      icon: CheckCircle,
      avatar: "SR"
    },
    {
      id: 3,
      type: "alert",
      title: "Stock request from Rider Eko",
      description: "Needs restock: Nasi Padang x10",
      time: "45 minutes ago",
      status: "warning",
      icon: AlertCircle,
      avatar: "EK"
    }
  ],
  rider: [
    {
      id: 1,
      type: "sale",
      title: "Order completed #ORD-2024-001",
      description: "2x Nasi Gudeg, 1x Es Teh - Rp 45,000",
      time: "3 minutes ago",
      status: "success",
      icon: CheckCircle,
      avatar: "OR"
    },
    {
      id: 2,
      type: "sale",
      title: "Order completed #ORD-2024-002", 
      description: "1x Gado-gado, 1x Juice - Rp 30,000",
      time: "12 minutes ago",
      status: "success",
      icon: CheckCircle,
      avatar: "OR"
    },
    {
      id: 3,
      type: "alert",
      title: "Low stock warning",
      description: "Nasi Padang: 3 items left",
      time: "25 minutes ago",
      status: "warning",
      icon: AlertCircle,
      avatar: "ST"
    }
  ]
};

export const RecentActivity = ({ role }: RecentActivityProps) => {
  const activities = activityData[role];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-success/10 text-success border-success/20';
      case 'warning': return 'bg-warning/10 text-warning border-warning/20';
      case 'error': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <div className="dashboard-card animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">Aktivitas Terkini</h3>
        <Badge variant="outline" className="text-xs">
          Pembaruan Langsung
        </Badge>
      </div>
      
      <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-xl glass hover:bg-white/5 transition-colors duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Avatar className="w-10 h-10 flex-shrink-0">
                <AvatarFallback className={`text-xs font-medium ${getStatusColor(activity.status)}`}>
                  {activity.avatar}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground line-clamp-1">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {activity.description}
                    </p>
                  </div>
                  <div className={`p-1.5 rounded-lg ${getStatusColor(activity.status)}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                </div>
                
                <div className="flex items-center gap-1 mt-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};