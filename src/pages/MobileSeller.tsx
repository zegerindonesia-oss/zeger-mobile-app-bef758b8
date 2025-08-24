import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MobileSellerEnhanced from "@/components/mobile/MobileSellerEnhanced";
import MobileRiderDashboard from "@/components/mobile/MobileRiderDashboard";
import MobileRiderAnalyticsEnhanced from "@/components/mobile/MobileRiderAnalyticsEnhanced";
import MobileStockManagement from "@/components/mobile/MobileStockManagement";
import MobileAttendance from "@/components/mobile/MobileAttendance";
import MobileCheckpoints from "@/components/mobile/MobileCheckpoints";
import MobileHistory from "@/components/mobile/MobileHistory";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { LayoutDashboard, ShoppingCart, Calendar, History, Settings, BarChart3, Package, Clock, MapPin } from "lucide-react";

export default function MobileSeller() {
  const { user, userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!loading && (!user || !userProfile || userProfile.role !== 'rider')) {
      window.location.href = '/auth';
    }
  }, [user, userProfile, loading]);

  // Support programmatic tab navigation from inner components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') setActiveTab(detail);
    };
    window.addEventListener('navigate-tab', handler as EventListener);
    return () => window.removeEventListener('navigate-tab', handler as EventListener);
  }, []);

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
            <MobileSellerEnhanced />
          </TabsContent>
          
          <TabsContent value="stock" className="m-0 h-full">
            <MobileStockManagement />
          </TabsContent>
          
          <TabsContent value="analytics" className="m-0 h-full">
            <MobileRiderAnalyticsEnhanced />
          </TabsContent>
          
          <TabsContent value="attendance" className="m-0 h-full">
            <MobileAttendance />
          </TabsContent>
          
          <TabsContent value="checkpoints" className="m-0 h-full">
            <MobileCheckpoints />
          </TabsContent>
          
          <TabsContent value="history" className="m-0 h-full">
            <MobileHistory />
          </TabsContent>
        </div>

        <div className="bg-white border-t">
          <TabsList className="grid w-full grid-cols-7 h-16 bg-transparent">
            <TabsTrigger value="dashboard" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <LayoutDashboard className="h-3 w-3" />
              <span className="text-[10px]">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="selling" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <ShoppingCart className="h-3 w-3" />
              <span className="text-[10px]">Jual</span>
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <Package className="h-3 w-3" />
              <span className="text-[10px]">Shift</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <BarChart3 className="h-3 w-3" />
              <span className="text-[10px]">Analitik</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <Clock className="h-3 w-3" />
              <span className="text-[10px]">Absen</span>
            </TabsTrigger>
            <TabsTrigger value="checkpoints" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <MapPin className="h-3 w-3" />
              <span className="text-[10px]">Check</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col gap-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              <History className="h-3 w-3" />
              <span className="text-[10px]">Riwayat</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}