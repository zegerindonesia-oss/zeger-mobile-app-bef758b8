import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface ModulePermission {
  module: string;
  permissions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve?: boolean;
  };
  resourceFilter?: {
    type: 'all' | 'branch' | 'rider_specific';
    riderIds?: string[];
  };
}

interface UserPermissionMatrixProps {
  role: string;
  onPermissionsChange: (permissions: ModulePermission[]) => void;
  riders?: Array<{ id: string; name: string; code: string }>;
}

interface ModuleConfig {
  name: string;
  permissions: string[];
  subModules?: string[];
  hasResourceFilter?: boolean;
}

const MODULES: Record<string, ModuleConfig> = {
  dashboard: { 
    name: "Dashboard", 
    permissions: ["view"] 
  },
  sales_pos: { 
    name: "Sales & POS", 
    permissions: ["view", "create", "edit", "approve"],
    subModules: ["pos", "transactions", "transaction_details", "customers"],
    hasResourceFilter: true
  },
  inventory: { 
    name: "Inventory", 
    permissions: ["view", "create", "edit", "delete"],
    subModules: ["production", "stock_management", "stock_transfer", "branch_transfer"]
  },
  finance: { 
    name: "Finance", 
    permissions: ["view", "create", "edit", "approve"],
    subModules: ["profit_loss", "cash_flow", "balance_sheet", "operational_expenses"]
  },
  reports: { 
    name: "Reports", 
    permissions: ["view"],
    subModules: ["sales_report", "inventory_report", "financial_report"],
    hasResourceFilter: true
  },
  admin: { 
    name: "Admin", 
    permissions: ["view", "create", "edit", "delete"],
    subModules: ["user_management", "branches", "riders"]
  },
  settings: { 
    name: "Settings", 
    permissions: ["view", "edit"]
  },
  help: { 
    name: "Help & Support", 
    permissions: ["view"]
  }
};

export function UserPermissionMatrix({ role, onPermissionsChange, riders = [] }: UserPermissionMatrixProps) {
  const [permissions, setPermissions] = useState<ModulePermission[]>(
    Object.entries(MODULES).map(([key, module]) => ({
      module: key,
      permissions: {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
      },
      resourceFilter: module.hasResourceFilter ? { type: 'all' } : undefined
    }))
  );

  const updatePermission = (moduleKey: string, permissionType: string, value: boolean) => {
    const updated = permissions.map(p => 
      p.module === moduleKey 
        ? { ...p, permissions: { ...p.permissions, [permissionType]: value } }
        : p
    );
    setPermissions(updated);
    onPermissionsChange(updated);
  };

  const updateResourceFilter = (moduleKey: string, filterType: 'all' | 'branch' | 'rider_specific', riderIds?: string[]) => {
    const updated = permissions.map(p => 
      p.module === moduleKey 
        ? { 
            ...p, 
            resourceFilter: { 
              type: filterType, 
              riderIds: filterType === 'rider_specific' ? riderIds : undefined 
            }
          }
        : p
    );
    setPermissions(updated);
    onPermissionsChange(updated);
  };

  const getDefaultPermissions = (role: string) => {
    const roleDefaults: { [key: string]: string[] } = {
      'bh_staff': ['dashboard', 'inventory', 'sales_pos', 'reports'],
      'bh_kasir': ['dashboard', 'sales_pos'],
      'bh_report': ['dashboard', 'reports', 'sales_pos'],
      'sb_branch_manager': ['dashboard', 'inventory', 'sales_pos', 'reports', 'admin', 'finance'],
      'sb_kasir': ['dashboard', 'sales_pos'],
      'sb_rider': ['dashboard', 'sales_pos'],
      'sb_report': ['dashboard', 'reports', 'sales_pos']
    };
    return roleDefaults[role] || [];
  };

  const applyRoleDefaults = () => {
    const defaultModules = getDefaultPermissions(role);
    const updated = permissions.map(p => ({
      ...p,
      permissions: {
        ...p.permissions,
        view: defaultModules.includes(p.module),
        create: defaultModules.includes(p.module) && ['inventory', 'sales_pos', 'admin', 'finance'].includes(p.module),
        edit: defaultModules.includes(p.module) && ['inventory', 'sales_pos', 'admin', 'settings'].includes(p.module),
        delete: defaultModules.includes(p.module) && ['inventory', 'admin'].includes(p.module),
        approve: defaultModules.includes(p.module) && ['sales_pos', 'finance'].includes(p.module),
      }
    }));
    setPermissions(updated);
    onPermissionsChange(updated);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Permission Settings</CardTitle>
          <button 
            type="button"
            onClick={applyRoleDefaults}
            className="text-sm text-primary hover:underline"
          >
            Apply Role Defaults
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(MODULES).map(([moduleKey, module]) => {
          const modulePermission = permissions.find(p => p.module === moduleKey);
          
          return (
            <div key={moduleKey} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{module.name}</h4>
                <Badge variant="outline">{moduleKey}</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {module.permissions.map((permission) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${moduleKey}-${permission}`}
                      checked={modulePermission?.permissions[permission as keyof typeof modulePermission.permissions] || false}
                      onCheckedChange={(checked) => 
                        updatePermission(moduleKey, permission, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`${moduleKey}-${permission}`}
                      className="text-sm capitalize"
                    >
                      {permission}
                    </Label>
                  </div>
                ))}
              </div>

              {module.subModules && (
                <div className="mt-3 pl-4 border-l-2 border-muted">
                  <Label className="text-xs text-muted-foreground">Sub-modules:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {module.subModules.map((subModule) => (
                      <Badge key={subModule} variant="secondary" className="text-xs">
                        {subModule.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {module.hasResourceFilter && modulePermission?.permissions.view && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium">Access Level</Label>
                  <Select 
                    value={modulePermission.resourceFilter?.type || 'all'}
                    onValueChange={(value) => 
                      updateResourceFilter(moduleKey, value as 'all' | 'branch' | 'rider_specific')
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Data</SelectItem>
                      <SelectItem value="branch">Branch Only</SelectItem>
                      <SelectItem value="rider_specific">Specific Riders Only</SelectItem>
                    </SelectContent>
                  </Select>

                  {modulePermission.resourceFilter?.type === 'rider_specific' && (
                    <div className="mt-3">
                      <Label className="text-sm">Select Riders</Label>
                      <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                        {riders.map((rider) => (
                          <div key={rider.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`rider-${rider.id}`}
                              checked={modulePermission.resourceFilter?.riderIds?.includes(rider.id) || false}
                              onCheckedChange={(checked) => {
                                const currentIds = modulePermission.resourceFilter?.riderIds || [];
                                const newIds = checked 
                                  ? [...currentIds, rider.id]
                                  : currentIds.filter(id => id !== rider.id);
                                updateResourceFilter(moduleKey, 'rider_specific', newIds);
                              }}
                            />
                            <Label htmlFor={`rider-${rider.id}`} className="text-sm">
                              {rider.code} - {rider.name}
                            </Label>
                          </div>
                        ))}
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