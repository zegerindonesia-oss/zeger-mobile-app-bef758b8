import { Building2, Users, Bike, Bell, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
interface DashboardHeaderProps {
  activeRole: 'ho' | 'branch' | 'rider';
  onRoleChange: (role: 'ho' | 'branch' | 'rider') => void;
}
const roleConfig = {
  ho: {
    icon: Building2,
    label: "Kantor Pusat",
    description: "Manajemen Pusat",
    color: "bg-primary text-primary-foreground"
  },
  branch: {
    icon: Users,
    label: "Manajer Cabang",
    description: "Operasional Cabang",
    color: "bg-warning text-warning-foreground"
  },
  rider: {
    icon: Bike,
    label: "Mobile Seller",
    description: "Operasional Lapangan",
    color: "bg-success text-success-foreground"
  }
};
export const DashboardHeader = ({
  activeRole,
  onRoleChange
}: DashboardHeaderProps) => {
  const { userProfile } = useAuth();
  const currentConfig = roleConfig[activeRole];
  const CurrentIcon = currentConfig.icon;
  return (
    <div className="glass-card-intense p-6 rounded-3xl animate-slide-up border border-glass-border">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side - Role & Welcome */}
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl glass-card ${currentConfig.color} shadow-glow`}>
            <CurrentIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">
              Selamat datang kembali!
            </h1>
            <p className="text-muted-foreground font-medium">
              Branch Hub Zeger Kemiri - {userProfile?.full_name || 'User'}
            </p>
          </div>
        </div>

        {/* Right Side - User Actions */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative glass-card w-12 h-12 rounded-2xl hover:scale-105 hover:shadow-glow transition-all duration-300 border-0"
          >
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-gradient-primary border-0 text-white">
              3
            </Badge>
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="glass-card w-12 h-12 rounded-2xl hover:scale-105 hover:shadow-glow transition-all duration-300 border-0"
          >
            <Settings className="w-5 h-5" />
          </Button>

          <div className="relative">
            <Avatar className="w-12 h-12 ring-2 ring-primary/30 shadow-glow">
              <AvatarFallback className="bg-gradient-primary text-white border-0">
                <User className="w-6 h-6" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-white shadow-sm"></div>
          </div>
        </div>
      </div>
    </div>
  );
};