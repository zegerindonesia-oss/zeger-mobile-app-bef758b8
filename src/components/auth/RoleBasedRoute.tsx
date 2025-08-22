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
    if (!loading && !user) {
      window.location.href = '/auth';
      return;
    }

    if (!loading && userProfile && allowedRoles.length > 0) {
      if (!allowedRoles.includes(userProfile.role)) {
        // Redirect based on user role
        const roleRedirects = {
          'rider': '/mobile-seller',
          'customer': '/customer-app',
          'ho_admin': '/',
          'branch_manager': '/',
          'finance': '/'
        };
        
        const targetUrl = roleRedirects[userProfile.role as keyof typeof roleRedirects] || '/';
        if (window.location.pathname !== targetUrl) {
          window.location.href = targetUrl;
        }
      }
    }
  }, [user, userProfile, loading, allowedRoles, redirectTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
    return null;
  }

  return <>{children}</>;
};