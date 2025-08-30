import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, Store, Truck, ShoppingCart, Smartphone, Users, Package, TrendingUp } from "lucide-react";
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
  return (
    <div className="min-h-screen wave-gradient-bg">
      <div className="content-overlay min-h-screen">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Modern Header */}
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-primary glass-card">
                <Coffee className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold gradient-text">Zeger Coffee ERP</h1>
            </div>
            <p className="text-lg text-muted-foreground font-medium">
              Sistem Manajemen Terpadu Coffee Shop & Mobile Seller
            </p>
          </div>

          {/* Dashboard Header with Role Switcher */}
          <DashboardHeader activeRole={activeRole} onRoleChange={setActiveRole} />
          
          {/* Modern Dashboard Layout - Similar to Reference Image */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-8 space-y-6">
              {/* Hero Stats Card - Like the Balance Card in Reference */}
              <div className="glass-card-intense p-8 rounded-3xl bg-gradient-primary text-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-white/80 text-sm font-medium">Total Balance</p>
                      <p className="text-3xl font-bold">Rp 2.480.000.000</p>
                      <p className="text-white/80 text-sm">•••• •••• •••• 6252</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/80 text-sm">Valid Thru</p>
                      <p className="text-white font-medium">12/25</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-white/90 font-medium">Zeger Coffee</p>
                    <div className="text-2xl font-bold">95</div>
                  </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full"></div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full"></div>
              </div>

              {/* Stats Grid - Oval Cards */}
              <StatsOverview role={activeRole} />
              
              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Chart - Oval Shape */}
                <div className="glass-card-intense rounded-3xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">History</h3>
                  <SalesChart />
                </div>
                
                {/* Efficiency Chart - Oval Shape */}
                <div className="glass-card-intense rounded-3xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Efficiency</h3>
                  <div className="flex items-center justify-center h-48">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full border-8 border-primary/20 relative">
                        <div className="absolute inset-2 rounded-full border-4 border-primary flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">$1,700</div>
                            <div className="text-xs text-muted-foreground">84.5%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column - Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Exchange Rates Card */}
              <div className="glass-card rounded-3xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Exchange rates</h3>
                  <div className="text-sm text-muted-foreground">USD → IDR</div>
                </div>
                <div className="h-20 flex items-center justify-center">
                  <div className="w-full h-8 bg-gradient-to-r from-primary/20 to-accent-orange/20 rounded-full flex items-center">
                    <div className="h-full w-3/4 bg-gradient-primary rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Profile Card */}
              <div className="glass-card rounded-3xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Coffee className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Jonas Kanwald</h3>
                    <p className="text-sm text-muted-foreground">Manager</p>
                  </div>
                </div>
                
                {/* Action Buttons - Oval */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                  <button className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1 hover:scale-105 transition-transform">
                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                      <Users className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-xs">Top Up</span>
                  </button>
                  <button className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1 hover:scale-105 transition-transform">
                    <div className="w-6 h-6 bg-success/20 rounded-full flex items-center justify-center">
                      <Package className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-xs">Pay</span>
                  </button>
                  <button className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1 hover:scale-105 transition-transform">
                    <div className="w-6 h-6 bg-warning/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-3 h-3 text-warning" />
                    </div>
                    <span className="text-xs">Send</span>
                  </button>
                  <button className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1 hover:scale-105 transition-transform">
                    <div className="w-6 h-6 bg-destructive/20 rounded-full flex items-center justify-center">
                      <Smartphone className="w-3 h-3 text-destructive" />
                    </div>
                    <span className="text-xs">Request</span>
                  </button>
                </div>
              </div>

              {/* Recent Transactions - Oval List */}
              <div className="glass-card rounded-3xl p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Transaction</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Coffee className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Tom Holland</p>
                        <p className="text-xs text-muted-foreground">Payment received</p>
                      </div>
                    </div>
                    <p className="font-semibold text-success">+$250</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Chris Jericho</p>
                        <p className="text-xs text-muted-foreground">Payment sent</p>
                      </div>
                    </div>
                    <p className="font-semibold text-destructive">-$100</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">John Cena</p>
                        <p className="text-xs text-muted-foreground">Payment received</p>
                      </div>
                    </div>
                    <p className="font-semibold text-success">+$250</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Chris Evans</p>
                        <p className="text-xs text-muted-foreground">Payment received</p>
                      </div>
                    </div>
                    <p className="font-semibold text-success">+$250</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions Floating Button */}
              <EnhancedQuickActions role={activeRole} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Index;