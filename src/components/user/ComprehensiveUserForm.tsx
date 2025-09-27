import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/lib/types";
import { Building2, User, Shield, Settings, CheckCircle, XCircle } from "lucide-react";

interface NewUser {
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  password: string;
  role: UserRole;
  branch_id?: string;
  app_access_type: 'web_backoffice' | 'pos_app' | 'rider_app';
}

interface ModulePermission {
  module: string;
  label: string;
  icon: React.ElementType;
  permissions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve?: boolean;
  };
  subModules?: {
    [key: string]: {
      label: string;
      permissions: {
        view: boolean;
        create: boolean;
        edit: boolean;
        delete?: boolean;
      };
    };
  };
  resourceFilter?: 'all' | 'branch' | 'rider_specific';
  selectedRiders?: string[];
}

interface ComprehensiveUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole: string;
  branchId?: string;
}

const MODULES_CONFIG: ModulePermission[] = [
  {
    module: 'Dashboard',
    label: 'Dashboard',
    icon: User,
    permissions: { view: false, create: false, edit: false, delete: false }
  },
  {
    module: 'Analytics',
    label: 'Analytics',
    icon: Settings,
    permissions: { view: false, create: false, edit: false, delete: false },
    subModules: {
      transactions: {
        label: 'Transactions',
        permissions: { view: false, create: false, edit: false, delete: false }
      },
      'transaction-details': {
        label: 'Transaction Details',
        permissions: { view: false, create: false, edit: false }
      },
      'rider-performance': {
        label: 'Rider Performance', 
        permissions: { view: false, create: false, edit: false }
      },
      'location-analytics': {
        label: 'Location Analytics',
        permissions: { view: false, create: false, edit: false }
      },
      customers: {
        label: 'Customer Management',
        permissions: { view: false, create: false, edit: false, delete: false }
      }
    }
  },
  {
    module: 'Inventory',
    label: 'Inventory',
    icon: Settings,
    permissions: { view: false, create: false, edit: false, delete: false },
    subModules: {
      production: {
        label: 'Production',
        permissions: { view: false, create: false, edit: false, delete: false }
      },
      'stock-management': {
        label: 'Stock Management',
        permissions: { view: false, create: false, edit: false }
      },
      'stock-transfer': {
        label: 'Stock Transfer',
        permissions: { view: false, create: false, edit: false }
      },
      'branch-transfer': {
        label: 'Branch Transfer',
        permissions: { view: false, create: false, edit: false }
      }
    }
  },
  {
    module: 'Finance',
    label: 'Finance',
    icon: Settings,
    permissions: { view: false, create: false, edit: false, delete: false },
    subModules: {
      'profit-loss': {
        label: 'Profit & Loss',
        permissions: { view: false, create: false, edit: false }
      },
      'cash-flow': {
        label: 'Cash Flow',
        permissions: { view: false, create: false, edit: false }
      },
      'balance-sheet': {
        label: 'Balance Sheet',
        permissions: { view: false, create: false, edit: false }
      },
      'operational-expenses': {
        label: 'Operational Expenses',
        permissions: { view: false, create: false, edit: false, delete: false }
      }
    }
  },
  {
    module: 'Reports',
    label: 'Reports',
    icon: Settings,
    permissions: { view: false, create: false, edit: false, delete: false }
  },
  {
    module: 'Settings',
    label: 'Settings',
    icon: Settings,
    permissions: { view: false, create: false, edit: false, delete: false },
    subModules: {
      'user-management': {
        label: 'User Management',
        permissions: { view: false, create: false, edit: false, delete: false }
      },
      'branch-management': {
        label: 'Branch Management',
        permissions: { view: false, create: false, edit: false, delete: false }
      },
      'rider-management': {
        label: 'Rider Management',
        permissions: { view: false, create: false, edit: false, delete: false }
      }
    }
  }
];

export const ComprehensiveUserForm: React.FC<ComprehensiveUserFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userRole,
  branchId
}) => {
  const [step, setStep] = useState(1);
  const [newUser, setNewUser] = useState<NewUser>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    role: 'rider' as UserRole,
    branch_id: branchId || '',
    app_access_type: 'web_backoffice'
  });
  
  const [branches, setBranches] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>(MODULES_CONFIG);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      fetchRiders();
    }
  }, [isOpen]);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data branch: " + error.message);
    }
  };

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('role', ['rider', 'bh_rider', 'sb_rider'])
        .eq('is_active', true);

      if (error) throw error;
      setRiders(data || []);
    } catch (error: any) {
      console.error('Error fetching riders:', error);
    }
  };

  const getAvailableRoles = (): UserRole[] => {
    const baseRoles: UserRole[] = ['ho_admin', 'ho_owner', 'branch_manager', 'sb_branch_manager', 'bh_staff', 'bh_report', 'rider'];
    
    if (userRole === 'ho_admin') {
      return baseRoles;
    } else if (userRole === 'branch_manager') {
      return ['sb_branch_manager', 'bh_staff', 'bh_report', 'rider'];
    } else if (userRole === 'sb_branch_manager') {
      return ['rider'];
    }
    
    return ['rider'];
  };

  const applyRoleDefaults = (selectedRole: UserRole) => {
    const updatedPermissions = [...MODULES_CONFIG];
    
    // Apply default permissions based on role
    switch (selectedRole) {
      case 'ho_admin':
        updatedPermissions.forEach(module => {
          module.permissions = { view: true, create: true, edit: true, delete: true, approve: true };
          if (module.subModules) {
            Object.keys(module.subModules).forEach(subKey => {
              module.subModules![subKey].permissions = { view: true, create: true, edit: true, delete: true };
            });
          }
        });
        break;
      
      case 'branch_manager':
        updatedPermissions.forEach(module => {
          if (['Dashboard', 'Analytics', 'Inventory', 'Finance', 'Reports', 'Settings'].includes(module.module)) {
            module.permissions = { view: true, create: true, edit: true, delete: true };
            if (module.subModules) {
              Object.keys(module.subModules).forEach(subKey => {
                module.subModules![subKey].permissions = { view: true, create: true, edit: true, delete: true };
              });
            }
          }
        });
        break;
      
      case 'bh_report':
        updatedPermissions.forEach(module => {
          if (['Dashboard', 'Analytics', 'Finance'].includes(module.module)) {
            module.permissions = { view: true, create: false, edit: false, delete: false };
            if (module.subModules) {
              Object.keys(module.subModules).forEach(subKey => {
                module.subModules![subKey].permissions = { view: true, create: false, edit: false, delete: false };
              });
            }
          }
        });
        break;
      
      case 'rider':
        updatedPermissions.forEach(module => {
          if (module.module === 'Dashboard') {
            module.permissions = { view: true, create: false, edit: false, delete: false };
          }
        });
        break;
    }
    
    setPermissions(updatedPermissions);
  };

  const toggleModulePermission = (moduleIndex: number, permission: string) => {
    const updatedPermissions = [...permissions];
    const module = updatedPermissions[moduleIndex];
    module.permissions = {
      ...module.permissions,
      [permission]: !module.permissions[permission as keyof typeof module.permissions]
    };
    setPermissions(updatedPermissions);
  };

  const toggleSubModulePermission = (moduleIndex: number, subModule: string, permission: string) => {
    const updatedPermissions = [...permissions];
    const module = updatedPermissions[moduleIndex];
    if (module.subModules && module.subModules[subModule]) {
      const subMod = module.subModules[subModule];
      subMod.permissions = {
        ...subMod.permissions,
        [permission]: !subMod.permissions[permission as keyof typeof subMod.permissions]
      };
    }
    setPermissions(updatedPermissions);
  };

  const handleCreateUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password || !newUser.role) {
      toast.error("Lengkapi semua data wajib");
      return;
    }

    // Validate branch assignment for non-HO roles
    const assignedBranchId = (userRole === 'branch_manager' || userRole === 'sb_branch_manager') ? branchId : newUser.branch_id;
    if (!assignedBranchId && !['ho_admin', 'ho_owner'].includes(newUser.role)) {
      toast.error("Pilih branch untuk user");
      return;
    }

    setCreating(true);
    try {
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: newUser.full_name,
            phone: newUser.phone,
            role: newUser.role
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { data: createdProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            full_name: newUser.full_name,
            phone: newUser.phone,
            role: newUser.role as any,
            branch_id: assignedBranchId,
            app_access_type: newUser.app_access_type,
            is_active: true
          })
          .select()
          .single();

        if (profileError) throw profileError;

        // Save permissions
        if (createdProfile) {
          const permissionInserts = [];
          
          for (const modulePermission of permissions) {
            for (const [permissionType, isGranted] of Object.entries(modulePermission.permissions)) {
              if (isGranted && permissionType !== 'approve') {
                permissionInserts.push({
                  user_id: createdProfile.id,
                  module_name: modulePermission.module,
                  permission_type: permissionType,
                  is_granted: true,
                  resource_filter: modulePermission.resourceFilter ? 
                    JSON.stringify({ 
                      type: modulePermission.resourceFilter,
                      riders: modulePermission.selectedRiders || []
                    }) : 
                    JSON.stringify({ type: 'all' })
                });
              }
            }
            
            // Save sub-module permissions
            if (modulePermission.subModules) {
              for (const [subModuleKey, subModule] of Object.entries(modulePermission.subModules)) {
                for (const [permissionType, isGranted] of Object.entries(subModule.permissions)) {
                  if (isGranted) {
                    permissionInserts.push({
                      user_id: createdProfile.id,
                      module_name: `${modulePermission.module}.${subModuleKey}`,
                      permission_type: permissionType,
                      is_granted: true,
                      resource_filter: JSON.stringify({ type: 'all' })
                    });
                  }
                }
              }
            }
          }

          if (permissionInserts.length > 0) {
            const { error: permissionError } = await supabase
              .from('user_module_permissions')
              .insert(permissionInserts);

            if (permissionError) {
              console.error('Failed to save permissions:', permissionError);
              toast.warning('User dibuat tetapi beberapa permission gagal disimpan');
            }
          }
        }

        toast.success(`User ${newUser.full_name} berhasil dibuat!`);
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (error: any) {
      toast.error("Gagal membuat user: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setNewUser({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      password: '',
      role: 'rider' as UserRole,
      branch_id: branchId || '',
      app_access_type: 'web_backoffice'
    });
    setPermissions(MODULES_CONFIG);
  };

  const renderPermissionMatrix = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Set Permissions</h3>
        <Button 
          variant="outline" 
          onClick={() => applyRoleDefaults(newUser.role)}
        >
          Apply Role Defaults
        </Button>
      </div>
      
      {permissions.map((module, moduleIndex) => (
        <Card key={module.module} className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <module.icon className="h-5 w-5" />
              <CardTitle className="text-base">{module.label}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main module permissions */}
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(module.permissions).map(([permission, isGranted]) => (
                permission !== 'approve' && (
                  <div key={permission} className="flex items-center space-x-2">
                    <Switch
                      id={`${module.module}-${permission}`}
                      checked={isGranted as boolean}
                      onCheckedChange={() => toggleModulePermission(moduleIndex, permission)}
                    />
                    <Label htmlFor={`${module.module}-${permission}`} className="text-sm capitalize">
                      {permission}
                    </Label>
                  </div>
                )
              ))}
            </div>
            
            {/* Sub-modules */}
            {module.subModules && (
              <div className="space-y-3 mt-4">
                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Sub-modules</h4>
                {Object.entries(module.subModules).map(([subModuleKey, subModule]) => (
                  <div key={subModuleKey} className="pl-4 border-l-2 border-muted">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{subModule.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      {Object.entries(subModule.permissions).map(([permission, isGranted]) => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Switch
                            id={`${module.module}-${subModuleKey}-${permission}`}
                            checked={isGranted as boolean}
                            onCheckedChange={() => toggleSubModulePermission(moduleIndex, subModuleKey, permission)}
                          />
                          <Label htmlFor={`${module.module}-${subModuleKey}-${permission}`} className="text-sm capitalize">
                            {permission}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderUserBasicInfo = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="full_name">Nama Lengkap *</Label>
          <Input
            id="full_name"
            value={newUser.full_name}
            onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
            placeholder="Masukkan nama lengkap"
            required
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="user@example.com"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">No. HP</Label>
          <Input
            id="phone"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            placeholder="08xxxxxxxxxx"
          />
        </div>
        <div>
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Minimal 6 karakter"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Alamat</Label>
        <Textarea
          id="address"
          value={newUser.address || ''}
          onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
          placeholder="Alamat lengkap (opsional)"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="role">Role/Jabatan *</Label>
          <Select value={newUser.role} onValueChange={(value) => {
            setNewUser({ ...newUser, role: value as UserRole });
            applyRoleDefaults(value as UserRole);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih role" />
            </SelectTrigger>
            <SelectContent>
              {getAvailableRoles().map((role) => (
                <SelectItem key={role} value={role}>
                  {role.replace(/_/g, ' ').toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {!['ho_admin', 'ho_owner'].includes(newUser.role) && (
          <div>
            <Label htmlFor="branch">Branch *</Label>
            <Select value={newUser.branch_id} onValueChange={(value) => setNewUser({ ...newUser, branch_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="app_access">Tipe Akses Aplikasi</Label>
        <Select value={newUser.app_access_type} onValueChange={(value) => setNewUser({ ...newUser, app_access_type: value as any })}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih tipe akses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="web_backoffice">Web Backoffice</SelectItem>
            <SelectItem value="pos_app">POS App</SelectItem>
            <SelectItem value="rider_app">Rider App</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Tambah User Baru
            <Badge variant="outline">Step {step} of 2</Badge>
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-6">
            {renderUserBasicInfo()}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button 
                onClick={() => setStep(2)}
                disabled={!newUser.full_name || !newUser.email || !newUser.password || !newUser.role}
              >
                Lanjut ke Permissions
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium">User Info:</h4>
              <p className="text-sm text-muted-foreground">{newUser.full_name} ({newUser.email}) - {newUser.role}</p>
            </div>
            
            {renderPermissionMatrix()}
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Kembali
              </Button>
              <div className="space-x-2">
                <Button variant="outline" onClick={onClose}>
                  Batal
                </Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? 'Membuat User...' : 'Buat User'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};