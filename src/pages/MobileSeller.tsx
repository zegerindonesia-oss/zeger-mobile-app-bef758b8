import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import MobileSellerEnhanced from "@/components/mobile/MobileSellerEnhanced";
import { ZegerLogo } from "@/components/ui/zeger-logo";

export default function MobileSeller() {
  const { user, userProfile, loading } = useAuth();

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
      <div className="bg-white/95 backdrop-blur-md">
        <MobileSellerEnhanced />
      </div>
    </div>
  );
}