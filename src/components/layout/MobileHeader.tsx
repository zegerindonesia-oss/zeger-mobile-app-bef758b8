import { Button } from "@/components/ui/button";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { 
  Menu,
  Bell,
  Search,
  User
} from "lucide-react";

interface Profile {
  id: string;
  role: string;
  branch_id: string | null;
  full_name: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  branch_type: string;
}

interface MobileHeaderProps {
  onToggleSidebar: () => void;
  profile: Profile | null;
  branch: Branch | null;
  pendingOrdersCount?: number;
}

export const MobileHeader = ({ onToggleSidebar, profile, branch, pendingOrdersCount = 0 }: MobileHeaderProps) => {
  const handleProfileClick = () => {
    window.location.href = '/mobile-seller?tab=profile';
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-40">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="hidden lg:flex items-center gap-3">
            <ZegerLogo className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Zeger Mobile</h1>
              {branch && (
                <p className="text-xs text-gray-500">{branch.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Center - Search (hidden on mobile) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari produk, pelanggan..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {profile?.role || 'Rider'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full"
              onClick={handleProfileClick}
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};