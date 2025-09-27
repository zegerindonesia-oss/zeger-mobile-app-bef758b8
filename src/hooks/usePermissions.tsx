import { createContext, useContext, useState, useEffect, ReactNode, FC } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Permission {
  id: string;
  user_id: string;
  module_name: string;
  permission_type: string;
  is_granted: boolean;
  resource_filter?: any;
}

interface PermissionContextType {
  permissions: Permission[];
  hasPermission: (module: string, permission: string) => boolean;
  hasModuleAccess: (module: string) => boolean;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  hasPermission: () => false,
  hasModuleAccess: () => false,
  loading: true,
  refreshPermissions: async () => {},
});

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
}

export const PermissionProvider: FC<PermissionProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const fetchPermissions = async () => {
    if (!userProfile?.id) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('is_granted', true);

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [userProfile?.id]);

  const hasPermission = (module: string, permission: string): boolean => {
    // Super admin has all permissions
    if (userProfile?.role === 'ho_admin') return true;
    
    // Check if user has specific permission for this module
    return permissions.some(p => 
      (p.module_name === module || p.module_name.startsWith(`${module}.`)) && 
      p.permission_type === permission &&
      p.is_granted
    );
  };

  const hasModuleAccess = (module: string): boolean => {
    // Super admin has access to everything
    if (userProfile?.role === 'ho_admin') return true;
    
    // Check if user has any permission for this module or its sub-modules
    return permissions.some(p => 
      (p.module_name === module || p.module_name.startsWith(`${module}.`)) &&
      p.is_granted
    );
  };

  const refreshPermissions = async () => {
    await fetchPermissions();
  };

  const contextValue: PermissionContextType = {
    permissions,
    hasPermission,
    hasModuleAccess,
    loading,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

// Permission Guard Component
interface PermissionGuardProps {
  module: string;
  permission?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGuard: FC<PermissionGuardProps> = ({
  module,
  permission = 'view',
  fallback = null,
  children
}) => {
  const { hasPermission, hasModuleAccess, loading } = usePermissions();

  if (loading) {
    return <div className="animate-pulse bg-muted h-4 w-24 rounded"></div>;
  }

  const hasAccess = permission ? hasPermission(module, permission) : hasModuleAccess(module);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};