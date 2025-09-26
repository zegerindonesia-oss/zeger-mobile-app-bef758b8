import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Home, 
  DollarSign, 
  Package, 
  BarChart3, 
  Users, 
  Settings, 
  HelpCircle,
  Shield,
  Eye,
  Edit,
  Plus,
  Trash2,
  CheckCircle,
  Filter
} from "lucide-react";

interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
}

interface ModulePermission {
  module: string;
  enabled: boolean;
  permissions: Permission;
  resourceFilter?: {
    type: 'all' | 'branch' | 'rider_specific';
    selectedRiders?: string[];
  };
  subModules?: { [key: string]: ModulePermission };
}

interface ModuleConfig {
  icon: any;
  permissions: string[];
  hasResourceFilter: boolean;
  subModules?: { [key: string]: { permissions: string[] } } | undefined;
}

interface PermissionMatrixProps {
  userRole: string;
  onChange: (permissions: ModulePermission[]) => void;
  riders?: Array<{ id: string; name: string }>;
}

const PERMISSION_ICONS = {
  view: Eye,
  create: Plus,
  edit: Edit,
  delete: Trash2,
  approve: CheckCircle
};

const MODULES: { [key: string]: ModuleConfig } = {
  Dashboard: {
    icon: Home,
    permissions: ['view'],
    hasResourceFilter: false
  },
  Sales: {
    icon: DollarSign,
    permissions: ['view', 'create', 'edit', 'delete'],
    hasResourceFilter: true,
    subModules: {
      'POS': { permissions: ['view', 'create'] },
      'Transactions': { permissions: ['view', 'edit'] },
      'Customers': { permissions: ['view', 'create', 'edit'] }
    }
  },
  Inventory: {
    icon: Package,
    permissions: ['view', 'create', 'edit', 'delete', 'approve'],
    hasResourceFilter: true,
    subModules: {
      'Stock Management': { permissions: ['view', 'create', 'edit'] },
      'Stock Transfer': { permissions: ['view', 'create', 'approve'] },
      'Production': { permissions: ['view', 'create', 'edit'] }
    }
  },
  Finance: {
    icon: DollarSign,
    permissions: ['view', 'create', 'edit', 'approve'],
    hasResourceFilter: false,
    subModules: {
      'Profit & Loss': { permissions: ['view'] },
      'Cash Flow': { permissions: ['view'] },
      'Expenses': { permissions: ['view', 'create', 'edit'] }
    }
  },
  Reports: {
    icon: BarChart3,
    permissions: ['view', 'create'],
    hasResourceFilter: true,
    subModules: undefined
  },
  Admin: {
    icon: Users,
    permissions: ['view', 'create', 'edit', 'delete'],
    hasResourceFilter: false,
    subModules: {
      'User Management': { permissions: ['view', 'create', 'edit', 'delete'] },
      'Branch Management': { permissions: ['view', 'create', 'edit'] },
      'Role Management': { permissions: ['view', 'edit'] }
    }
  },
  Settings: {
    icon: Settings,
    permissions: ['view', 'edit'],
    hasResourceFilter: false,
    subModules: undefined
  }
};

export function PermissionMatrix({ userRole, onChange, riders = [] }: PermissionMatrixProps) {
  const [permissions, setPermissions] = useState<{ [key: string]: ModulePermission }>({});

  useEffect(() => {
    // Initialize with default permissions based on role
    const defaultPermissions = getDefaultPermissions(userRole);
    setPermissions(defaultPermissions);
    onChange(Object.values(defaultPermissions));
  }, [userRole]);

  const getDefaultPermissions = (role: string): { [key: string]: ModulePermission } => {
    const defaults: { [key: string]: ModulePermission } = {};
    
    Object.entries(MODULES).forEach(([moduleName, moduleConfig]) => {
      const permission: Permission = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false
      };

      // Set default permissions based on role level
      if (role.startsWith('1_') || role === 'ho_admin') {
        // HO level - full access
        permission.view = true;
        permission.create = true;
        permission.edit = true;
        permission.delete = true;
        permission.approve = true;
      } else if (role.startsWith('2_') || role === 'branch_manager') {
        // Hub level - moderate access
        permission.view = true;
        permission.create = true;
        permission.edit = moduleName !== 'Finance';
        permission.delete = moduleName === 'Admin' || moduleName === 'Inventory';
      } else if (role.startsWith('3_')) {
        // Small branch level - limited access
        permission.view = ['Dashboard', 'Sales', 'Reports'].includes(moduleName);
        permission.create = moduleName === 'Sales';
        permission.edit = moduleName === 'Sales';
      }

      const subModules: { [key: string]: ModulePermission } = {};
      if (moduleConfig.subModules) {
        Object.entries(moduleConfig.subModules).forEach(([subName, subConfig]) => {
          subModules[subName] = {
            module: subName,
            enabled: permission.view,
            permissions: { ...permission },
            resourceFilter: moduleConfig.hasResourceFilter ? { type: 'all' } : undefined
          };
        });
      }

      defaults[moduleName] = {
        module: moduleName,
        enabled: permission.view || permission.create || permission.edit,
        permissions: permission,
        resourceFilter: moduleConfig.hasResourceFilter ? { type: 'all' } : undefined,
        subModules: Object.keys(subModules).length > 0 ? subModules : undefined
      };
    });

    return defaults;
  };

  const toggleModule = (moduleName: string) => {
    const newPermissions = { ...permissions };
    const module = newPermissions[moduleName];
    
    module.enabled = !module.enabled;
    
    if (!module.enabled) {
      // Disable all permissions when module is disabled
      module.permissions = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false
      };
      
      // Disable sub-modules too
      if (module.subModules) {
        Object.values(module.subModules).forEach(subModule => {
          subModule.enabled = false;
          subModule.permissions = {
            view: false,
            create: false,
            edit: false,
            delete: false,
            approve: false
          };
        });
      }
    } else {
      // Enable basic view permission when module is enabled
      module.permissions.view = true;
    }
    
    setPermissions(newPermissions);
    onChange(Object.values(newPermissions));
  };

  const updatePermission = (moduleName: string, permissionType: keyof Permission, value: boolean) => {
    const newPermissions = { ...permissions };
    const module = newPermissions[moduleName];
    
    module.permissions[permissionType] = value;
    
    // Auto-enable module if any permission is granted
    if (value && !module.enabled) {
      module.enabled = true;
    }
    
    setPermissions(newPermissions);
    onChange(Object.values(newPermissions));
  };

  const updateSubModulePermission = (moduleName: string, subModuleName: string, permissionType: keyof Permission, value: boolean) => {
    const newPermissions = { ...permissions };
    const subModule = newPermissions[moduleName].subModules?.[subModuleName];
    
    if (subModule) {
      subModule.permissions[permissionType] = value;
      
      if (value && !subModule.enabled) {
        subModule.enabled = true;
      }
    }
    
    setPermissions(newPermissions);
    onChange(Object.values(newPermissions));
  };

  const updateResourceFilter = (moduleName: string, filterType: 'all' | 'branch' | 'rider_specific', selectedRiders?: string[]) => {
    const newPermissions = { ...permissions };
    const module = newPermissions[moduleName];
    
    if (module.resourceFilter) {
      module.resourceFilter.type = filterType;
      module.resourceFilter.selectedRiders = selectedRiders || [];
    }
    
    setPermissions(newPermissions);
    onChange(Object.values(newPermissions));
  };

  const applyRoleDefaults = () => {
    const defaultPermissions = getDefaultPermissions(userRole);
    setPermissions(defaultPermissions);
    onChange(Object.values(defaultPermissions));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix
          </CardTitle>
          <Button variant="outline" size="sm" onClick={applyRoleDefaults}>
            Apply Role Defaults
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {Object.entries(MODULES).map(([moduleName, moduleConfig]) => {
          const modulePermission = permissions[moduleName];
          if (!modulePermission) return null;
          
          const Icon = moduleConfig.icon;
          
          return (
            <div key={moduleName} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{moduleName}</span>
                  <Switch
                    checked={modulePermission.enabled}
                    onCheckedChange={() => toggleModule(moduleName)}
                  />
                </div>
                {modulePermission.enabled && (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>

              {modulePermission.enabled && (
                <div className="space-y-4">
                  {/* Main module permissions */}
                  <div className="grid grid-cols-5 gap-2">
                    {moduleConfig.permissions.map((permType) => {
                      const PermIcon = PERMISSION_ICONS[permType as keyof typeof PERMISSION_ICONS];
                      return (
                        <Label key={permType} className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={modulePermission.permissions[permType as keyof Permission]}
                          onCheckedChange={(value) => updatePermission(moduleName, permType as keyof Permission, value)}
                        />
                          <PermIcon className="h-3 w-3" />
                          <span className="text-xs capitalize">{permType}</span>
                        </Label>
                      );
                    })}
                  </div>

                  {/* Resource filter */}
                  {moduleConfig.hasResourceFilter && modulePermission.resourceFilter && (
                    <div className="border-t pt-3">
                      <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Filter className="h-4 w-4" />
                        Resource Filter
                      </Label>
                      <Select
                        value={modulePermission.resourceFilter.type}
                        onValueChange={(value: 'all' | 'branch' | 'rider_specific') => 
                          updateResourceFilter(moduleName, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Data</SelectItem>
                          <SelectItem value="branch">Branch Only</SelectItem>
                          <SelectItem value="rider_specific">Rider Specific</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Sub-modules */}
                  {moduleConfig.subModules && modulePermission.subModules && (
                    <div className="border-t pt-3">
                      <Label className="text-sm font-medium mb-2 block">Sub-Modules</Label>
                      <div className="space-y-2">
                        {Object.entries(moduleConfig.subModules).map(([subName, subConfig]) => {
                          const subModule = modulePermission.subModules![subName];
                          return (
                            <div key={subName} className="bg-muted/30 rounded p-2">
                              <div className="flex items-center gap-2 mb-2">
                              <Switch
                                checked={subModule.enabled}
                                onCheckedChange={(value) => {
                                  const newPermissions = { ...permissions };
                                  newPermissions[moduleName].subModules![subName].enabled = value;
                                  setPermissions(newPermissions);
                                  onChange(Object.values(newPermissions));
                                }}
                              />
                                <span className="text-sm">{subName}</span>
                              </div>
                              {subModule.enabled && (
                                <div className="grid grid-cols-4 gap-1 ml-6">
                                  {(subConfig as any).permissions.map((permType: string) => {
                                    const PermIcon = PERMISSION_ICONS[permType as keyof typeof PERMISSION_ICONS];
                                    return (
                                      <Label key={permType} className="flex items-center gap-1 cursor-pointer">
                                        <Switch
                                          checked={subModule.permissions[permType as keyof Permission]}
                                          onCheckedChange={(value) => 
                                            updateSubModulePermission(moduleName, subName, permType as keyof Permission, value)
                                          }
                                        />
                                        <PermIcon className="h-3 w-3" />
                                        <span className="text-xs">{permType}</span>
                                      </Label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}