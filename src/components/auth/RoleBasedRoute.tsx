import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

export const RoleBasedRoute = ({ 
  children, 
  allowedRoles = [], 
  redirectTo = '/auth' 
}: RoleBasedRouteProps) => {
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    // Redirect unauthenticated users immediately
    if (!loading && !user) {
      window.location.replace('/auth');
      return;
    }

    // Wait for both user and profile to be loaded before checking roles
    if (!loading && user && userProfile && allowedRoles.length > 0) {
      if (!allowedRoles.includes(userProfile.role)) {
        // Redirect based on user role
        const roleRedirects = {
          'rider': '/mobile-seller',
          'sb_rider': '/mobile-seller',
          'bh_rider': '/mobile-seller',
          'customer': '/customer-app',
          'ho_admin': '/',
          'branch_manager': '/',
          'sb_branch_manager': '/',
          'finance': '/',
          'bh_report': '/bh-report-dashboard'
        };
        
        const targetUrl = roleRedirects[userProfile.role as keyof typeof roleRedirects] || '/';
        if (window.location.pathname !== targetUrl) {
          window.location.replace(targetUrl);
        }
      }
    }
  }, [user, userProfile, loading, allowedRoles, redirectTo]);

  // Show loading while authentication state is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Memuat...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if no user (will redirect via useEffect)
  if (!user) {
    return null;
  }

  // Don't render if user profile is still loading
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Memuat profil pengguna...</p>
        </div>
      </div>
    );
  }

  // Check role permissions
  if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
    return null;
  }

  return <>{children}</>;
};