import { MapPin, Clock, CheckCircle, AlertCircle, Bike, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface RiderTrackingProps {
  role: 'ho' | 'branch' | 'rider';
}

const riderData = {
  ho: [
    {
      id: 1,
      name: "Budi Santoso",
      branch: "Jakarta Pusat",
      status: "active",
      location: "Jl. Sudirman No. 15",
      ordersToday: 12,
      revenue: "Rp 650,000",
      lastUpdate: "2 min ago"
    },
    {
      id: 2,
      name: "Sari Dewi",
      branch: "Jakarta Pusat",
      status: "active",
      location: "Jl. Thamrin No. 8",
      ordersToday: 8,
      revenue: "Rp 420,000",
      lastUpdate: "5 min ago"
    },
    {
      id: 3,
      name: "Andi Wijaya",
      branch: "Bandung",
      status: "break",
      location: "Branch Office",
      ordersToday: 15,
      revenue: "Rp 780,000",
      lastUpdate: "15 min ago"
    },
    {
      id: 4,
      name: "Eko Prasetyo",
      branch: "Surabaya",
      status: "offline",
      location: "Unknown",
      ordersToday: 0,
      revenue: "Rp 0",
      lastUpdate: "2 hours ago"
    }
  ],
  branch: [
    {
      id: 1,
      name: "Budi Santoso",
      branch: "This Branch",
      status: "active",
      location: "Jl. Sudirman No. 15",
      ordersToday: 12,
      revenue: "Rp 650,000",
      lastUpdate: "2 min ago"
    },
    {
      id: 2,
      name: "Sari Dewi",
      branch: "This Branch",
      status: "active",
      location: "Jl. Thamrin No. 8",
      ordersToday: 8,
      revenue: "Rp 420,000",
      lastUpdate: "5 min ago"
    },
    {
      id: 3,
      name: "Eko Prasetyo",
      branch: "This Branch",
      status: "break",
      location: "Branch Office",
      ordersToday: 15,
      revenue: "Rp 780,000",
      lastUpdate: "15 min ago"
    }
  ]
};

export const RiderTracking = ({ role }: RiderTrackingProps) => {
  const riders = riderData[role] || [];
  const navigate = useNavigate();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-success text-success-foreground',
          icon: CheckCircle,
          label: 'Active'
        };
      case 'break':
        return {
          color: 'bg-warning text-warning-foreground',
          icon: Clock,
          label: 'Break'
        };
      case 'offline':
        return {
          color: 'bg-muted text-muted-foreground',
          icon: AlertCircle,
          label: 'Offline'
        };
      default:
        return {
          color: 'bg-muted text-muted-foreground',
          icon: AlertCircle,
          label: 'Unknown'
        };
    }
  };

  return (
    <div className="dashboard-card animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Pelacakan Rider</h3>
        <div className="flex items-center gap-2">
          <div className="status-online"></div>
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>
      
      <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
        {riders.map((rider, index) => {
          const statusConfig = getStatusConfig(rider.status);
          const StatusIcon = statusConfig.icon;
          
          return (
            <div
              key={rider.id}
              className="p-3 glass rounded-xl hover:bg-white/5 transition-colors duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {rider.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm text-foreground truncate">
                      {rider.name}
                    </p>
                    <Badge className={`text-xs ${statusConfig.color}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{rider.location}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          Pesanan: <span className="font-medium text-foreground">{rider.ordersToday}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Pendapatan: <span className="font-medium text-foreground">{rider.revenue}</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        Diperbarui {rider.lastUpdate}
                      </span>
                      {rider.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs glass hover:scale-105 transition-transform"
                        >
                          <Navigation className="w-3 h-3 mr-1" />
                          Track
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {role === 'branch' && (
        <div className="mt-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full glass hover:scale-105 transition-transform"
              onClick={() => navigate('/admin-dashboard')}
            >
              <Bike className="w-4 h-4 mr-2" />
              Tambah Rider Baru
            </Button>
        </div>
      )}
    </div>
  );
};