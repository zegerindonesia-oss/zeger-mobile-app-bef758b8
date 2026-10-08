import { Search, Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { UserRole, Profile, Branch } from "@/lib/types";

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
    const roleMap: { [key: string]: string } = {
      // Legacy roles
      'ho_admin': 'HO Admin',
      'ho_owner': 'HO Owner',
      'ho_staff': 'HO Staff',
      'branch_manager': 'Branch Hub Manager',
      'bh_staff': 'Branch Hub Staff',
      'bh_kasir': 'Branch Hub Kasir',
      'bh_rider': 'Branch Hub Rider',
      'bh_report': 'Branch Hub Report',
      'sb_branch_manager': 'Small Branch Manager',
      'sb_kasir': 'Small Branch Kasir',
      'sb_rider': 'Small Branch Rider',
      'sb_report': 'Small Branch Report',
      'rider': 'Legacy Rider',
      'finance': 'Finance Staff',
      'customer': 'Customer',
      // New hierarchical roles
      '1_HO_Admin': 'HO Admin',
      '1_HO_Owner': 'HO Owner', 
      '1_HO_Staff': 'HO Staff',
      '2_Hub_Branch_Manager': 'Hub Branch Manager',
      '2_Hub_Staff': 'Hub Staff',
      '2_Hub_Kasir': 'Hub Kasir',
      '2_Hub_Rider': 'Hub Rider',
      '3_SB_Branch_Manager': 'Small Branch Manager',
      '3_SB_Staff': 'Small Branch Staff',
      '3_SB_Kasir': 'Small Branch Kasir',
      '3_SB_Rider': 'Small Branch Rider'
    };
    return roleMap[profile.role] || profile.role;
  };

  return (
    <header className="sticky top-0 z-40 nav-glass px-3 py-2.5 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        {/* Left side */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-semibold text-gray-900 truncate">
              {['ho_admin', 'ho_owner', '1_HO_Admin', '1_HO_Owner'].includes(profile.role) ? 'Dashboard' : 
               branch ? `${branch.name} Dashboard` : 'Dashboard'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 sm:mt-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                {getGreeting()}, {profile.full_name}
              </p>
              <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
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