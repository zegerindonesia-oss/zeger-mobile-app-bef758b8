import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

export interface SubModulePermission {
  name: string;
  enabled: boolean;
  permissions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve?: boolean;
    release?: boolean;
  };
}

export interface ModulePermission {
  module: string;
  enabled: boolean;
  permissions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve?: boolean;
    release?: boolean;
  };
  subModules?: SubModulePermission[];
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

interface SubModuleConfig {
  name: string;
  label: string;
  permissions: string[];
}

interface ModuleConfig {
  name: string;
  permissions: string[];
  subModules?: SubModuleConfig[];
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
    subModules: [
      { name: "pos", label: "POS Terminal", permissions: ["view", "create"] },
      { name: "transactions", label: "Transactions", permissions: ["view", "create", "edit"] },
      { name: "transaction_details", label: "Transaction Details", permissions: ["view"] },
      { name: "customers", label: "Customer Management", permissions: ["view", "create", "edit"] }
    ],
    hasResourceFilter: true
  },
  inventory: { 
    name: "Inventory", 
    permissions: ["view", "create", "edit", "delete"],
    subModules: [
      { name: "production", label: "Production", permissions: ["view", "create", "edit"] },
      { name: "stock_management", label: "Stock Management", permissions: ["view", "edit"] },
      { name: "inventory_adjustment", label: "Inventory Adjustment", permissions: ["view", "create", "edit"] },
      { name: "laporan_shift", label: "Laporan Shift", permissions: ["view"] },
      { name: "riwayat_transfer", label: "Riwayat Transfer Stock", permissions: ["view"] },
      { name: "kirim_stok_rider", label: "Kirim Stok Ke Rider", permissions: ["view", "create"] },
      { name: "kirim_stok_sb", label: "Kirim Stok Ke Small Branch", permissions: ["view", "create"] }
    ]
  },
  finance: { 
    name: "Finance", 
    permissions: ["view", "create", "edit", "approve"],
    subModules: [
      { name: "profit_loss", label: "Profit & Loss", permissions: ["view"] },
      { name: "cash_flow", label: "Cash Flow", permissions: ["view"] },
      { name: "balance_sheet", label: "Balance Sheet", permissions: ["view"] },
      { name: "operational_expenses", label: "Operational Expenses", permissions: ["view", "create", "edit"] },
      { name: "rider_expenses", label: "Rider Expenses", permissions: ["view", "approve"] }
    ]
  },
  reports: { 
    name: "Reports", 
    permissions: ["view"],
    subModules: [
      { name: "sales_report", label: "Sales Report", permissions: ["view"] },
      { name: "inventory_report", label: "Inventory Report", permissions: ["view"] },
      { name: "financial_report", label: "Financial Report", permissions: ["view"] },
      { name: "shift_report", label: "Shift Report", permissions: ["view"] }
    ],
    hasResourceFilter: true
  },
  admin: { 
    name: "Admin", 
    permissions: ["view", "create", "edit", "delete"],
    subModules: [
      { name: "user_management", label: "User Management", permissions: ["view", "create", "edit", "delete"] },
      { name: "branches", label: "Branch Management", permissions: ["view", "create", "edit"] },
      { name: "riders", label: "Rider Management", permissions: ["view", "create", "edit"] }
    ]
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
      enabled: false,
      permissions: {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        release: false,
      },
      subModules: module.subModules?.map(sub => ({
        name: sub.name,
        enabled: false,
        permissions: {
          view: false,
          create: false,
          edit: false,
          delete: false,
          approve: false,
          release: false,
        }
      })),
      resourceFilter: module.hasResourceFilter ? { type: 'all' } : undefined
    }))
  );

  const toggleModule = (moduleKey: string, enabled: boolean) => {
    const updated = permissions.map(p => 
      p.module === moduleKey 
        ? { 
            ...p, 
            enabled,
            permissions: enabled ? p.permissions : {
              view: false, create: false, edit: false, delete: false, approve: false, release: false
            },
            subModules: p.subModules?.map(sub => ({
              ...sub,
              enabled: enabled ? sub.enabled : false,
              permissions: enabled ? sub.permissions : {
                view: false, create: false, edit: false, delete: false, approve: false, release: false
              }
            }))
          }
        : p
    );
    setPermissions(updated);
    onPermissionsChange(updated);
  };

  const updatePermission = (moduleKey: string, permissionType: string, value: boolean) => {
    const updated = permissions.map(p => 
      p.module === moduleKey 
        ? { ...p, permissions: { ...p.permissions, [permissionType]: value } }
        : p
    );
    setPermissions(updated);
    onPermissionsChange(updated);
  };

  const toggleSubModule = (moduleKey: string, subModuleName: string, enabled: boolean) => {
    const updated = permissions.map(p => 
      p.module === moduleKey 
        ? { 
            ...p, 
            subModules: p.subModules?.map(sub => 
              sub.name === subModuleName 
                ? { 
                    ...sub, 
                    enabled,
                    permissions: enabled ? sub.permissions : {
                      view: false, create: false, edit: false, delete: false, approve: false, release: false
                    }
                  }
                : sub
            )
          }
        : p
    );
    setPermissions(updated);
    onPermissionsChange(updated);
  };

  const updateSubModulePermission = (moduleKey: string, subModuleName: string, permissionType: string, value: boolean) => {
    const updated = permissions.map(p => 
      p.module === moduleKey 
        ? { 
            ...p, 
            subModules: p.subModules?.map(sub => 
              sub.name === subModuleName 
                ? { ...sub, permissions: { ...sub.permissions, [permissionType]: value } }
                : sub
            )
          }
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
      enabled: defaultModules.includes(p.module),
      permissions: {
        ...p.permissions,
        view: defaultModules.includes(p.module),
        create: defaultModules.includes(p.module) && ['inventory', 'sales_pos', 'admin', 'finance'].includes(p.module),
        edit: defaultModules.includes(p.module) && ['inventory', 'sales_pos', 'admin', 'settings'].includes(p.module),
        delete: defaultModules.includes(p.module) && ['inventory', 'admin'].includes(p.module),
        approve: defaultModules.includes(p.module) && ['sales_pos', 'finance'].includes(p.module),
      },
      subModules: p.subModules?.map(sub => ({
        ...sub,
        enabled: defaultModules.includes(p.module),
        permissions: {
          ...sub.permissions,
          view: defaultModules.includes(p.module),
          create: defaultModules.includes(p.module) && ['inventory', 'sales_pos', 'admin', 'finance'].includes(p.module),
          edit: defaultModules.includes(p.module) && ['inventory', 'sales_pos', 'admin', 'settings'].includes(p.module),
        }
      }))
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
      <CardContent className="max-h-[70vh] overflow-y-auto space-y-6">
        {Object.entries(MODULES).map(([moduleKey, module]) => {
          const modulePermission = permissions.find(p => p.module === moduleKey);
          
          return (
            <div key={moduleKey} className="border rounded-lg p-4 space-y-4">
              {/* Module Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleModule(moduleKey, !modulePermission?.enabled)}
                    className={`h-6 w-6 p-0 ${modulePermission?.enabled ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {modulePermission?.enabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </Button>
                  <h4 className="font-medium">{module.name}</h4>
                </div>
                <Badge variant="outline">{moduleKey}</Badge>
              </div>
              
              {/* Module Permissions */}
              {modulePermission?.enabled && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
              )}

              {/* Sub-modules */}
              {module.subModules && modulePermission?.enabled && (
                <div className="mt-4 pl-4 border-l-2 border-border">
                  <Label className="text-sm font-medium text-muted-foreground">Sub-modules:</Label>
                  <div className="mt-3 space-y-3">
                    {module.subModules.map((subModule) => {
                      const subModulePermission = modulePermission.subModules?.find(s => s.name === subModule.name);
                      
                      return (
                        <div key={subModule.name} className="border border-muted rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSubModule(moduleKey, subModule.name, !subModulePermission?.enabled)}
                                className={`h-5 w-5 p-0 ${subModulePermission?.enabled ? 'text-green-600' : 'text-red-500'}`}
                              >
                                {subModulePermission?.enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </Button>
                              <Label className="text-sm font-medium">{subModule.label}</Label>
                            </div>
                            <Badge variant="secondary" className="text-xs">{subModule.name}</Badge>
                          </div>
                          
                          {subModulePermission?.enabled && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                              {subModule.permissions.map((permission) => (
                                <div key={permission} className="flex items-center space-x-1">
                                  <Checkbox
                                    id={`${moduleKey}-${subModule.name}-${permission}`}
                                    checked={subModulePermission?.permissions[permission as keyof typeof subModulePermission.permissions] || false}
                                    onCheckedChange={(checked) => 
                                      updateSubModulePermission(moduleKey, subModule.name, permission, checked as boolean)
                                    }
                                  />
                                  <Label 
                                    htmlFor={`${moduleKey}-${subModule.name}-${permission}`}
                                    className="text-xs capitalize"
                                  >
                                    {permission}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resource Filter */}
              {module.hasResourceFilter && modulePermission?.enabled && modulePermission?.permissions.view && (
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
                      <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
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