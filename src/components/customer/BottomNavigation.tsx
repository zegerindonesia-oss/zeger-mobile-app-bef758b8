import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Gift, Package, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  activeView: string;
  activeOrdersCount: number;
  onNavigate: (view: string) => void;
}

export function BottomNavigation({ activeView, activeOrdersCount, onNavigate }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.05)] rounded-t-2xl z-50">
      <div className="flex justify-around items-center py-2 max-w-md mx-auto">
        {/* Home */}
        <button
          className={cn(
            "flex flex-col items-center text-center py-2 px-3",
            activeView === 'home' ? 'text-red-500' : 'text-gray-500'
          )}
          onClick={() => onNavigate('home')}
        >
          <Home className={cn("h-6 w-6", activeView === 'home' && "fill-red-500")} />
          <p className={cn("text-xs mt-1", activeView === 'home' && "font-semibold")}>Home</p>
        </button>

        {/* Menu */}
        <button
          className={cn(
            "flex flex-col items-center text-center py-2 px-3",
            activeView === 'menu' ? 'text-red-500' : 'text-gray-500'
          )}
          onClick={() => onNavigate('menu')}
        >
          <Gift className={cn("h-6 w-6", activeView === 'menu' && "fill-red-500")} />
          <p className={cn("text-xs mt-1", activeView === 'menu' && "font-semibold")}>Menu</p>
        </button>

        {/* Pesanan */}
        <button
          className={cn(
            "flex flex-col items-center text-center py-2 px-3 relative",
            activeView === 'orders' ? 'text-red-500' : 'text-gray-500'
          )}
          onClick={() => onNavigate('orders')}
        >
          <Package className={cn("h-6 w-6", activeView === 'orders' && "fill-red-500")} />
          <p className={cn("text-xs mt-1", activeView === 'orders' && "font-semibold")}>Pesanan</p>
          {activeOrdersCount > 0 && (
            <Badge className="absolute top-0 right-6 h-5 w-5 flex items-center justify-center p-0 bg-red-500 border-2 border-white text-xs">
              {activeOrdersCount}
            </Badge>
          )}
        </button>

        {/* Profile */}
        <button
          className={cn(
            "flex flex-col items-center text-center py-2 px-3",
            activeView === 'profile' ? 'text-red-500' : 'text-gray-500'
          )}
          onClick={() => onNavigate('profile')}
        >
          <User className={cn("h-6 w-6", activeView === 'profile' && "fill-red-500")} />
          <p className={cn("text-xs mt-1", activeView === 'profile' && "font-semibold")}>Profile</p>
        </button>
      </div>
    </nav>
  );
}
