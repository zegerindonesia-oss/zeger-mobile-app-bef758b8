import { Search, Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";

interface Profile {
  id: string;
  role: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer';
  branch_id?: string;
  full_name: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  branch_type: string;
}

interface ModernHeaderProps {
  profile: Profile;
  branch: Branch | null;
  onMenuClick: () => void;
}

export const ModernHeader = ({ profile, branch, onMenuClick }: ModernHeaderProps) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getRoleDisplay = () => {
    switch (profile.role) {
      case 'ho_admin':
        return 'Head Office Admin';
      case 'branch_manager':
        return 'Branch Manager';
      case 'rider':
        return 'Rider';
      case 'finance':
        return 'Finance';
      default:
        return profile.role;
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {profile.role === 'ho_admin' ? 'Dashboard' : 
               branch ? `${branch.name} Dashboard` : 'Dashboard'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-600">
                {getGreeting()}, {profile.full_name}
              </p>
              <Badge variant="secondary" className="text-xs">
                {getRoleDisplay()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search Products"
              className="pl-10 w-64"
            />
          </div>

          {/* Notifications */}
          <NotificationSystem />

          {/* User Avatar */}
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profile.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
              <p className="text-xs text-gray-600">{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};