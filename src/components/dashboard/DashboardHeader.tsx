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
  return <div className="glass-card p-6 rounded-3xl animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side - Role & Welcome */}
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${currentConfig.color}`}>
            <CurrentIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Selamat datang kembali!
            </h1>
            <p className="text-muted-foreground">
              Branch Hub Zeger Kemiri - {userProfile?.full_name || 'User'}
            </p>
          </div>
        </div>

        {/* Center - Role Switcher */}
        

        {/* Right Side - User Actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative glass-card w-10 h-10 rounded-xl hover:scale-105 transition-transform">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-primary">
              3
            </Badge>
          </Button>
          
          <Button variant="ghost" size="icon" className="glass-card w-10 h-10 rounded-xl hover:scale-105 transition-transform">
            <Settings className="w-5 h-5" />
          </Button>

          <Avatar className="w-10 h-10 ring-2 ring-primary/20">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>;
};