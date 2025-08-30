import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, Store, Truck, ShoppingCart, Smartphone, Users } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { EnhancedQuickActions } from "@/components/dashboard/EnhancedQuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SalesChart } from "@/components/charts/SalesChart";
import { InventoryStatus } from "@/components/inventory/InventoryStatus";
import { RiderTracking } from "@/components/rider/RiderTracking";
const Index = () => {
  const [activeRole, setActiveRole] = useState<'ho' | 'branch' | 'rider'>('ho');
  const navigate = useNavigate();
  const location = useLocation();
  return <div className="min-h-screen bg-gradient-dashboard">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Coffee className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold text-primary">Zeger Coffee ERP</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Sistem Manajemen Terpadu untuk Coffee Shop & Mobile Seller
          </p>
        </div>

        {/* Quick Access Cards */}
        

        {/* Header */}
        <DashboardHeader activeRole={activeRole} onRoleChange={setActiveRole} />
        
        {/* Stats Overview */}
        <StatsOverview role={activeRole} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sales Chart */}
            <div className="dashboard-card animate-slide-up">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Performa Penjualan</h3>
              <SalesChart />
            </div>
            
            {/* Recent Activity */}
            <RecentActivity role={activeRole} />
          </div>
          
          {/* Sidebar Content */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <EnhancedQuickActions role={activeRole} />
            
            {/* Inventory Status */}
            <InventoryStatus role={activeRole} />
            
            {/* Rider Tracking (for Branch/HO) */}
            {(activeRole === 'ho' || activeRole === 'branch') && <RiderTracking role={activeRole} />}
          </div>
        </div>
      </div>
    </div>;
};
export default Index;