import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MobileSellerEnhanced from "@/components/mobile/MobileSellerEnhanced";
import MobileRiderDashboard from "@/components/mobile/MobileRiderDashboard";
import MobileRiderAnalytics from "@/components/mobile/MobileRiderAnalytics";
import MobileStockManagement from "@/components/mobile/MobileStockManagement";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { LayoutDashboard, ShoppingCart, Calendar, History, Settings, BarChart3, Package } from "lucide-react";

export default function MobileSeller() {
  const { user, userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!loading && (!user || !userProfile || userProfile.role !== 'rider')) {
      window.location.href = '/auth';
    }
  }, [user, userProfile, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white flex items-center justify-center">
        <div className="text-center">
          <ZegerLogo className="w-16 h-16 mx-auto mb-4" />
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile || userProfile.role !== 'rider') {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-screen flex flex-col">
        <div className="flex-1 overflow-auto">
          <TabsContent value="dashboard" className="m-0 h-full">
            <MobileRiderDashboard />
          </TabsContent>
          
          <TabsContent value="selling" className="m-0 h-full">
            <div className="bg-white/95 backdrop-blur-md">
              <MobileSellerEnhanced />
            </div>
          </TabsContent>
          
          <TabsContent value="attendance" className="m-0 h-full">
            <MobileStockManagement />
          </TabsContent>
          
          <TabsContent value="analytics" className="m-0 h-full">
            <MobileRiderAnalytics />
          </TabsContent>
          
          <TabsContent value="history" className="m-0 h-full p-4">
            <div className="text-center py-8">
              <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Riwayat Transaksi</h3>
              <p className="text-muted-foreground">Riwayat transaksi dan laporan</p>
            </div>
          </TabsContent>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t">
          <TabsList className="grid w-full grid-cols-5 h-16 bg-transparent">
            <TabsTrigger 
              value="dashboard" 
              className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <LayoutDashboard className="h-3 w-3" />
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="selling"
              className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <ShoppingCart className="h-3 w-3" />
              <span className="text-xs">Penjualan</span>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <BarChart3 className="h-3 w-3" />
              <span className="text-xs">Analytics</span>
            </TabsTrigger>
            <TabsTrigger 
              value="attendance"
              className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <Package className="h-3 w-3" />
              <span className="text-xs">Kelola Shift</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <History className="h-3 w-3" />
              <span className="text-xs">Riwayat</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}