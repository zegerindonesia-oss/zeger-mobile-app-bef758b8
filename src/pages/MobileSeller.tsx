import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MobileLayout } from '@/components/layout/MobileLayout';
import MobileSellerEnhanced from "@/components/mobile/MobileSellerEnhanced";
import MobileRiderDashboard from "@/components/mobile/MobileRiderDashboard";
import MobileRiderAnalyticsEnhanced from "@/components/mobile/MobileRiderAnalyticsEnhanced";
import MobileStockManagement from "@/components/mobile/MobileStockManagement";
import MobileAttendance from "@/components/mobile/MobileAttendance";
import MobileCheckpoints from "@/components/mobile/MobileCheckpoints";
import MobileHistory from "@/components/mobile/MobileHistory";
import { CustomerManagement } from "@/components/customer/CustomerManagement";
import { MobileProfile } from "@/components/mobile/MobileProfile";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { Users } from "lucide-react";

export default function MobileSeller() {
  const { user, userProfile, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  useEffect(() => {
    if (!loading && (!user || !userProfile || !['rider', 'sb_rider', 'bh_rider'].includes(userProfile.role))) {
      window.location.href = '/auth';
    }
  }, [user, userProfile, loading]);

  // Listen for tab navigation events
  useEffect(() => {
    const handleNavigateTab = (event: CustomEvent) => {
      setSearchParams({ tab: event.detail });
    };

    window.addEventListener('navigate-tab', handleNavigateTab as EventListener);
    return () => window.removeEventListener('navigate-tab', handleNavigateTab as EventListener);
  }, [setSearchParams]);

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

  if (!user || !userProfile || !['rider', 'sb_rider', 'bh_rider'].includes(userProfile.role)) {
    return null; // Will redirect to auth
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <MobileRiderDashboard />;
      case 'selling':
        return <MobileSellerEnhanced />;
      case 'stock':
        return <MobileStockManagement />;
      case 'analytics':
        return <MobileRiderAnalyticsEnhanced />;
      case 'attendance':
        return <MobileAttendance />;
      case 'checkpoints':
        return <MobileCheckpoints />;
      case 'history':
        return <MobileHistory />;
      case 'customers':
        return (
          <div className="p-4 h-full bg-gradient-to-br from-white via-red-50/30 to-white">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold">Kelola Pelanggan</h2>
            </div>
            <CustomerManagement />
          </div>
        );
      case 'profile':
        return <MobileProfile />;
      default:
        return <MobileRiderDashboard />;
    }
  };

  return (
    <MobileLayout>
      {renderContent()}
    </MobileLayout>
  );
}