import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Building2, 
  Smartphone, 
  Monitor,
  Settings,
  Crown,
  Star,
  Briefcase,
  CreditCard,
  MapPin,
  FileText,
  MoreVertical,
  Building,
  Calculator,
  Bike,
  Store,
  LinkIcon
} from "lucide-react";
import { UserRolePermissions } from "./UserRolePermissions";
import { UserPermissionMatrix, ModulePermission } from "./UserPermissionMatrix";

// Enhanced user role permissions and hierarchy based on the new structure
interface UserManagementProps {
  role: '1_HO_Admin' | '1_HO_Owner' | '2_Hub_Branch_Manager' | '3_SB_Branch_Manager' | 'ho_admin' | 'ho_owner' | 'branch_manager' | 'bh_staff' | 'sb_branch_manager';
  branchId?: string;
}

import { UserRole, Profile } from "@/lib/types";

interface User {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  branch_id?: string;
  branch_name?: string;
  user_id?: string;
  created_at?: string;
  app_access_type?: 'web_backoffice' | 'pos_app' | 'rider_app';
  assigned_rider?: string;
  assigned_reporter?: string;
  branches?: {
    name: string;
    branch_type: string;
  } | null;
}

interface NewUser {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  branch_id?: string;
  app_access_type: 'web_backoffice' | 'pos_app' | 'rider_app';
  assigned_rider?: string;
  assigned_reporter?: string;
}

interface Assignment {
  report_user_id: string;
  report_name: string;
  rider_id: string;
  rider_name: string;
}

export function EnhancedUserManagement({ role, branchId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [userPermissions, setUserPermissions] = useState<ModulePermission[]>([]);
  const [riders, setRiders] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [reporters, setReporters] = useState<Array<{ id: string; full_name: string; role: string }>>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedRiderForAssignment, setSelectedRiderForAssignment] = useState<string>('');
  const [newUser, setNewUser] = useState<NewUser>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'rider' as UserRole,
    branch_id: branchId || '',
    app_access_type: 'web_backoffice',
    assigned_rider: '',
    assigned_reporter: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchBranches();
    fetchRiders();
    fetchReporters();
    fetchAssignments();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, branchFilter, accessFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // First get users based on role permissions
      let usersQuery = supabase.from('profiles').select('*').neq('role', 'customer');

      // Role-based filtering
      if (role === 'branch_manager' && branchId) {
        usersQuery = usersQuery.eq('branch_id', branchId);
      } else if (role === 'sb_branch_manager' && branchId) {
        usersQuery = usersQuery.eq('branch_id', branchId);
      }

      const { data: usersData, error: usersError } = await usersQuery.order('created_at', { ascending: false });
      
      if (usersError) throw usersError;

      // Separately fetch branches to join manually
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, branch_type');

      if (branchesError) throw branchesError;

      // Create a map for easy lookup
      const branchMap = new Map(branchesData.map(branch => [branch.id, branch]));

      // Manually join the data
      const enrichedUsers = usersData.map(user => ({
        ...user,
        branches: user.branch_id ? branchMap.get(user.branch_id) : null
      }));
      
      setUsers(enrichedUsers || []);
    } catch (error: any) {
      toast.error(`Gagal memuat data user: ${error.message}`);
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
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

      const riderList = data.map(rider => ({
        id: rider.id,
        name: rider.full_name,
        code: rider.phone || rider.id.slice(0, 8)
      }));

      setRiders(riderList);
    } catch (error: any) {
      console.error('Error fetching riders:', error);
    }
  };

  const fetchReporters = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['bh_report', 'sb_report'])
        .eq('is_active', true);

      if (error) throw error;
      setReporters(data || []);
    } catch (error: any) {
      console.error('Error fetching reporters:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase.rpc('get_branch_assignments');
      if (error) throw error;
      setAssignments(data || []);
    } catch (error: any) {
      console.error('Error fetching assignments:', error);
    }
  };

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

  const filterUsers = () => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(user => user.branch_id === branchFilter);
    }

    // Access type filter
    if (accessFilter !== 'all') {
      filtered = filtered.filter(user => user.app_access_type === accessFilter);
    }

    setFilteredUsers(filtered);
  };

  const createUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password || !newUser.role) {
      toast.error("Lengkapi semua data wajib");
      return;
    }

    // Validate rider assignment for bh_report users
    if (newUser.role === 'bh_report' && !selectedRiderForAssignment) {
      toast.error("Pilih rider untuk user bh_report");
      return;
    }

    // Auto-assign branch for branch managers
    const assignedBranchId = (role === 'branch_manager' || role === 'sb_branch_manager') ? branchId : newUser.branch_id;

    // Validate branch assignment for non-HO roles
    if (!assignedBranchId && !['ho_admin', 'ho_owner', 'ho_staff'].includes(newUser.role)) {
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
        // Create profile with app access type
        const profileInsertData = {
          user_id: authData.user.id,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role: newUser.role as any,
          branch_id: assignedBranchId,
          app_access_type: newUser.app_access_type,
          is_active: true
        };

        const { data: createdProfile, error: profileError } = await supabase
          .from('profiles')
          .insert(profileInsertData)
          .select()
          .single();

        if (profileError) throw profileError;

        // Save user permissions if any are set
        if (userPermissions.length > 0 && createdProfile) {
          const permissionInserts = [];
          
          for (const modulePermission of userPermissions) {
            for (const [permissionType, isGranted] of Object.entries(modulePermission.permissions)) {
              if (isGranted && permissionType !== 'approve') {
                permissionInserts.push({
                  user_id: createdProfile.id,
                  module_name: modulePermission.module,
                  permission: permissionType,
                  resource_filter: modulePermission.resourceFilter || null
                });
              }
            }
          }

          if (permissionInserts.length > 0) {
            const { error: permissionError } = await supabase
              .from('user_specific_permissions')
              .insert(permissionInserts);

            if (permissionError) {
              console.error('Failed to save permissions:', permissionError);
              toast.warning('User dibuat tetapi beberapa permission gagal disimpan');
            }
          }
        }

        // Handle assignments using RPC
        try {
          if (newUser.role === 'bh_report' && selectedRiderForAssignment && createdProfile) {
            await supabase.rpc('upsert_bh_report_assignment', {
              _report_user_id: createdProfile.id,
              _rider_profile_id: selectedRiderForAssignment
            });
          } else if (['rider', 'bh_rider', 'sb_rider'].includes(newUser.role) && newUser.assigned_reporter && createdProfile) {
            await supabase.rpc('upsert_bh_report_assignment', {
              _report_user_id: newUser.assigned_reporter,
              _rider_profile_id: createdProfile.id
            });
          }
        } catch (assignmentError: any) {
          console.error('Assignment error:', assignmentError);
          toast.warning(`User dibuat tapi assignment gagal: ${assignmentError.message}`);
        }

        toast.success(`User ${newUser.full_name} berhasil dibuat! Email: ${newUser.email}`);
        setIsDialogOpen(false);
        resetNewUser();
        setUserPermissions([]);
        setSelectedRiderForAssignment('');
        fetchUsers();
        fetchAssignments();
      }
    } catch (error: any) {
      toast.error("Gagal membuat user: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  const resetNewUser = () => {
    setNewUser({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role: 'rider' as UserRole,
      branch_id: branchId || '',
      app_access_type: 'web_backoffice',
      assigned_rider: '',
      assigned_reporter: ''
    });
    setSelectedRiderForAssignment('');
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`User ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal mengubah status user: " + error.message);
    }
  };

  const editUser = (user: User) => {
    // Find current assignments for this user
    const reportAssignment = assignments.find(a => a.report_user_id === user.id);
    const riderAssignment = assignments.find(a => a.rider_id === user.id);
    
    setEditingUser({ 
      ...user, 
      assigned_rider: reportAssignment?.rider_id || '',
      assigned_reporter: riderAssignment?.report_user_id || ''
    });
    setIsEditDialogOpen(true);
  };

  const updateUser = async () => {
    if (!editingUser) return;
    
    setCreating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          phone: editingUser.phone,
          role: editingUser.role as any,
          branch_id: editingUser.branch_id,
          app_access_type: editingUser.app_access_type
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      // Handle assignment updates using RPC
      try {
        if (editingUser.role === 'bh_report' && editingUser.assigned_rider) {
          await supabase.rpc('upsert_bh_report_assignment', {
            _report_user_id: editingUser.id,
            _rider_profile_id: editingUser.assigned_rider
          });
        } else if (['rider', 'bh_rider', 'sb_rider'].includes(editingUser.role) && editingUser.assigned_reporter) {
          await supabase.rpc('upsert_bh_report_assignment', {
            _report_user_id: editingUser.assigned_reporter,
            _rider_profile_id: editingUser.id
          });
        }
      } catch (assignmentError: any) {
        console.error('Assignment update error:', assignmentError);
        toast.warning(`User diupdate tapi assignment gagal: ${assignmentError.message}`);
      }

      toast.success("User berhasil diperbarui");
      setIsEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
      fetchAssignments();
    } catch (error: any) {
      toast.error("Gagal memperbarui user: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    try {
      // Get user_id for auth deletion
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', userId)
        .single();

      if (profile?.user_id) {
        // Delete from auth
        const { error: authError } = await supabase.auth.admin.deleteUser(profile.user_id);
        if (authError) throw authError;
      }

      // Delete from profiles table
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast.success(`User ${userName} berhasil dihapus`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal menghapus user: " + error.message);
    }
  };

  // Enhanced hierarchical role system
  const getAvailableRoles = () => {
    if (role === 'ho_admin' || role === 'ho_owner') {
      return [
        { value: 'ho_admin', label: 'HO Admin', access: 'web_backoffice', icon: Crown },
        { value: 'ho_staff', label: 'HO Staff', access: 'web_backoffice', icon: Star },
        { value: 'branch_manager', label: 'Branch Hub Manager', access: 'web_backoffice', icon: Building2 },
        { value: 'bh_staff', label: 'Branch Hub Staff', access: 'web_backoffice', icon: Briefcase },
        { value: 'bh_kasir', label: 'Branch Hub Kasir', access: 'pos_app', icon: CreditCard },
        { value: 'bh_rider', label: 'Branch Hub Rider', access: 'rider_app', icon: MapPin },
        { value: 'bh_report', label: 'Branch Hub Report', access: 'web_backoffice', icon: FileText },
        { value: 'sb_branch_manager', label: 'Small Branch Manager', access: 'web_backoffice', icon: Building2 },
        { value: 'sb_kasir', label: 'Small Branch Kasir', access: 'pos_app', icon: CreditCard },
        { value: 'sb_rider', label: 'Small Branch Rider', access: 'rider_app', icon: MapPin },
        { value: 'sb_report', label: 'Small Branch Report', access: 'web_backoffice', icon: FileText },
        { value: 'rider', label: 'Legacy Rider', access: 'rider_app', icon: MapPin }
      ];
    } else if (role === 'branch_manager') {
      return [
        { value: 'bh_staff', label: 'Branch Hub Staff', access: 'web_backoffice', icon: Briefcase },
        { value: 'bh_kasir', label: 'Branch Hub Kasir', access: 'pos_app', icon: CreditCard },
        { value: 'bh_rider', label: 'Branch Hub Rider', access: 'rider_app', icon: MapPin },
        { value: 'bh_report', label: 'Branch Hub Report', access: 'web_backoffice', icon: FileText },
        { value: 'sb_branch_manager', label: 'Small Branch Manager', access: 'web_backoffice', icon: Store },
        { value: 'sb_kasir', label: 'Small Branch Kasir', access: 'pos_app', icon: CreditCard },
        { value: 'sb_rider', label: 'Small Branch Rider', access: 'rider_app', icon: MapPin },
        { value: 'sb_report', label: 'Small Branch Report', access: 'web_backoffice', icon: FileText },
        { value: 'rider', label: 'Legacy Rider', access: 'rider_app', icon: MapPin }
      ];
    } else if (role === 'sb_branch_manager') {
      return [
        { value: 'sb_kasir', label: 'Small Branch Kasir', access: 'pos_app', icon: CreditCard },
        { value: 'sb_rider', label: 'Small Branch Rider', access: 'rider_app', icon: MapPin },
        { value: 'sb_report', label: 'Small Branch Report', access: 'web_backoffice', icon: FileText }
      ];
    }
    return [];
  };

  const getRoleLabel = (role: string) => {
    const roleMap: { [key: string]: string } = {
      'ho_admin': 'HO Admin',
      'ho_owner': 'HO Owner',
      'ho_staff': 'HO Staff',
      'branch_manager': 'Branch Hub Manager',
      'bh_staff': 'Branch Hub Staff',
      'bh_kasir': 'Branch Hub Kasir',
      'bh_rider': 'Branch Hub Rider',
      'bh_report': 'Branch Hub Report',
      'sb_branch_manager': 'Small Branch Manager',
      'sb_kasir': 'Small Branch Kasir',
      'sb_rider': 'Small Branch Rider',
      'sb_report': 'Small Branch Report',
      'rider': 'Legacy Rider',
      'finance': 'Finance Staff',
      'customer': 'Customer'
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colorMap: { [key: string]: string } = {
      'ho_admin': 'bg-destructive text-destructive-foreground',
      'ho_owner': 'bg-primary text-primary-foreground',
      'ho_staff': 'bg-primary-light text-primary-foreground',
      'branch_manager': 'bg-primary text-primary-foreground',
      'bh_staff': 'bg-blue-500 text-white',
      'bh_kasir': 'bg-green-500 text-white',
      'bh_rider': 'bg-orange-500 text-white',
      'bh_report': 'bg-purple-500 text-white',
      'sb_branch_manager': 'bg-cyan-500 text-white',
      'sb_kasir': 'bg-teal-500 text-white',
      'sb_rider': 'bg-amber-500 text-white',
      'sb_report': 'bg-indigo-500 text-white',
      'rider': 'bg-gray-500 text-white',
      'finance': 'bg-emerald-500 text-white',
      'customer': 'bg-muted text-muted-foreground'
    };
    return colorMap[role] || 'bg-muted text-muted-foreground';
  };

  const getAccessIcon = (accessType?: string) => {
    switch (accessType) {
      case 'web_backoffice': return <Monitor className="h-3 w-3" />;
      case 'pos_app': return <CreditCard className="h-3 w-3" />;
      case 'rider_app': return <Smartphone className="h-3 w-3" />;
      default: return <Monitor className="h-3 w-3" />;
    }
  };

  const getAccessLabel = (accessType?: string) => {
    switch (accessType) {
      case 'web_backoffice': return 'Web Backoffice';
      case 'pos_app': return 'POS App';
      case 'rider_app': return 'Rider App';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Permissions Management - Enhanced for all admin levels */}
      {(role === 'ho_admin' || role === 'ho_owner') && (
        <UserRolePermissions role={role} />
      )}
      
      {/* Enhanced User Management Card with Glassmorphism */}
      <Card className="glass-card border-0 shadow-glass">
        <CardHeader className="border-b border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-gradient-to-br from-primary/20 to-primary-dark/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold gradient-text">User Management System</h2>
                <p className="text-sm text-muted-foreground">Manajemen user dengan sistem role hierarkis</p>
              </div>
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Dialog for creating user - moved from header */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="glass-card w-[95vw] max-w-6xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6 border-b">
                  <DialogTitle className="gradient-text">Tambah User Baru</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 flex-1 overflow-y-auto p-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Lengkap *</Label>
                    <Input
                      id="name"
                      className="form-glass"
                      placeholder="Masukkan nama lengkap"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser(prev => ({...prev, full_name: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      className="form-glass"
                      placeholder="user@example.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser(prev => ({...prev, email: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      className="form-glass"
                      placeholder="Minimal 8 karakter"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({...prev, password: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">No. Telepon</Label>
                    <Input
                      id="phone"
                      className="form-glass"
                      placeholder="08xxxxxxxxxx"
                      value={newUser.phone}
                      onChange={(e) => setNewUser(prev => ({...prev, phone: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select 
                      value={newUser.role} 
                      onValueChange={(value) => {
                        const selectedRole = getAvailableRoles().find(r => r.value === value);
                        setNewUser(prev => ({
                          ...prev, 
                          role: value as UserRole,
                          app_access_type: selectedRole?.access as any || 'web_backoffice'
                        }));
                      }}
                    >
                      <SelectTrigger className="form-glass">
                        <SelectValue placeholder="Pilih role pengguna" />
                      </SelectTrigger>
                      <SelectContent className="dropdown-content">
                        {getAvailableRoles().map((roleOption) => {
                          const IconComponent = roleOption.icon;
                          return (
                            <SelectItem key={roleOption.value} value={roleOption.value} className="select-item">
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <span>{roleOption.label}</span>
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {getAccessLabel(roleOption.access)}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Branch Selection - Only for non-HO roles */}
                  {(role === 'ho_admin' || role === 'ho_owner') && 
                   !['ho_admin', 'ho_owner', 'ho_staff'].includes(newUser.role) && (
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch *</Label>
                      <Select 
                        value={newUser.branch_id} 
                        onValueChange={(value) => setNewUser(prev => ({...prev, branch_id: value}))}
                      >
                        <SelectTrigger className="form-glass">
                          <SelectValue placeholder="Pilih branch" />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id} className="select-item">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <span>{branch.name}</span>
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {branch.branch_type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Auto Branch Assignment Info */}
                  {(role === 'branch_manager' || role === 'sb_branch_manager') && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                      <p className="text-sm text-primary flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        User akan ditambahkan ke branch Anda secara otomatis
                      </p>
                    </div>
                  )}

                  {/* App Access Type Display */}
                  {newUser.role && (
                    <div className="p-3 bg-muted/50 rounded-xl">
                      <div className="flex items-center gap-2 text-sm">
                        {getAccessIcon(newUser.app_access_type)}
                        <span className="font-medium">Akses Aplikasi:</span>
                        <Badge variant="outline">{getAccessLabel(newUser.app_access_type)}</Badge>
                      </div>
                    </div>
                  )}

                  {/* Assignment Fields */}
                  {newUser.role === 'bh_report' && (
                    <div className="space-y-2">
                      <Label htmlFor="rider-assignment">Assign Rider *</Label>
                      <Select 
                        value={selectedRiderForAssignment} 
                        onValueChange={setSelectedRiderForAssignment}
                      >
                        <SelectTrigger className="form-glass">
                          <SelectValue placeholder="Pilih rider yang akan di-assign" />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {riders.map((rider) => (
                            <SelectItem key={rider.id} value={rider.id} className="select-item">
                              <div className="flex items-center gap-2">
                                <Bike className="h-4 w-4" />
                                <span>{rider.name}</span>
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {rider.code}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {['rider', 'bh_rider', 'sb_rider'].includes(newUser.role) && (
                    <div className="space-y-2">
                      <Label htmlFor="reporter-assignment">Assign Reporter (Optional)</Label>
                      <Select 
                        value={newUser.assigned_reporter} 
                        onValueChange={(value) => setNewUser(prev => ({...prev, assigned_reporter: value}))}
                      >
                        <SelectTrigger className="form-glass">
                          <SelectValue placeholder="Pilih reporter untuk di-assign" />
                        </SelectTrigger>
                      <SelectContent className="dropdown-content">
                        {reporters.map((reporter) => (
                          <SelectItem key={reporter.id} value={reporter.id} className="select-item">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{reporter.full_name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                {reporter.role}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Permission Matrix */}
                  {newUser.role && newUser.role !== 'rider' && (
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Permission Settings</Label>
                      <UserPermissionMatrix
                        role={newUser.role}
                        onPermissionsChange={setUserPermissions}
                        riders={riders}
                      />
                    </div>
                  )}

                </div>
                <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6 border-t">
                  <div className="flex gap-3">
                    <Button 
                      onClick={createUser} 
                      disabled={creating} 
                      className="btn-glass flex-1"
                    >
                      {creating ? "Membuat..." : "Buat User"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)} 
                      className="btn-glass-outline flex-1"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          
          {/* Enhanced Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, telepon, atau role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-glass pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="form-glass w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent className="dropdown-content">
                  <SelectItem value="all" className="select-item">Semua Role</SelectItem>
                  {getAvailableRoles().map((roleOption) => (
                    <SelectItem key={roleOption.value} value={roleOption.value} className="select-item">
                      {roleOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={accessFilter} onValueChange={setAccessFilter}>
                <SelectTrigger className="form-glass w-40">
                  <SelectValue placeholder="Akses" />
                </SelectTrigger>
                <SelectContent className="dropdown-content">
                  <SelectItem value="all" className="select-item">Semua Akses</SelectItem>
                  <SelectItem value="web_backoffice" className="select-item">Web Backoffice</SelectItem>
                  <SelectItem value="pos_app" className="select-item">POS App</SelectItem>
                  <SelectItem value="rider_app" className="select-item">Rider App</SelectItem>
                </SelectContent>
              </Select>

              {(role === 'ho_admin' || role === 'ho_owner') && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="form-glass w-40">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent className="dropdown-content">
                    <SelectItem value="all" className="select-item">Semua Branch</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id} className="select-item">
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Enhanced Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold text-primary">{filteredUsers.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold text-success">
                      {filteredUsers.filter(u => u.is_active).length}
                    </p>
                  </div>
                  <Eye className="h-8 w-8 text-success/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Mobile Users</p>
                    <p className="text-2xl font-bold text-warning">
                      {filteredUsers.filter(u => 
                        ['rider', 'bh_rider', 'sb_rider'].includes(u.role) && 
                        u.app_access_type === 'rider_app' && 
                        u.is_active
                      ).length}
                    </p>
                  </div>
                  <Smartphone className="h-8 w-8 text-warning/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Branch Staff</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {filteredUsers.filter(u => u.role.includes('branch') || u.role.includes('bh_') || u.role.includes('sb_')).length}
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600/60" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Users Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-muted-foreground">No</TableHead>
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Role & Access</TableHead>
                  <TableHead className="text-muted-foreground">Branch</TableHead>
                  <TableHead className="text-muted-foreground">Assignment</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Terdaftar</TableHead>
                  <TableHead className="text-muted-foreground text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user, index) => (
                  <TableRow key={user.id} className="table-row-highlight border-white/5">
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{user.full_name}</p>
                        {user.phone && (
                          <p className="text-sm text-muted-foreground">{user.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge className={`${getRoleColor(user.role)} badge-oval`}>
                          <Shield className="h-3 w-3 mr-1" />
                          {getRoleLabel(user.role)}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getAccessIcon(user.app_access_type)}
                          <span>{getAccessLabel(user.app_access_type)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.branches ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{user.branches.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {user.branches.branch_type}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const reportAssignment = assignments.find(a => a.report_user_id === user.id);
                        const riderAssignment = assignments.find(a => a.rider_id === user.id);
                        
                        if (reportAssignment) {
                          return (
                            <div className="flex items-center gap-1 text-sm">
                              <LinkIcon className="h-3 w-3" />
                              <span>Assigned to: {reportAssignment.rider_name}</span>
                            </div>
                          );
                        }
                        
                        if (riderAssignment) {
                          return (
                            <div className="flex items-center gap-1 text-sm">
                              <LinkIcon className="h-3 w-3" />
                              <span>Reporter: {riderAssignment.report_name}</span>
                            </div>
                          );
                        }
                        
                        return <span className="text-muted-foreground text-sm">No assignment</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.is_active ? 'default' : 'secondary'} 
                        className="badge-oval"
                      >
                        {user.is_active ? (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            Nonaktif
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editUser(user)}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={user.is_active ? "secondary" : "default"}
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          {user.is_active ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="h-8 w-8 p-0 rounded-full">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="gradient-text">Hapus User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus user <strong>"{user.full_name}"</strong>? 
                                Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data terkait.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="btn-glass-outline">Batal</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteUser(user.id, user.full_name)}
                                className="btn-glass bg-destructive hover:bg-destructive/90"
                              >
                                Hapus User
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">
                  {loading ? "Memuat data..." : "Tidak ada user ditemukan"}
                </p>
                {searchTerm && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Coba ubah kata kunci pencarian atau filter
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Add User Button - Moved to bottom with unlocked access for branch managers */}
          {(role === 'ho_admin' || role === 'ho_owner' || role === 'branch_manager' || role === 'sb_branch_manager') && (
            <div className="flex justify-center pt-4">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2 px-8 py-3 rounded-2xl text-base font-semibold shadow-lg hover:shadow-red-500/20 transition-all duration-300"
                  >
                    <UserPlus className="h-5 w-5" />
                    Buat User
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="glass-card w-[95vw] max-w-6xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6 border-b">
            <DialogTitle className="gradient-text">
              Edit User - {editingUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nama Lengkap</Label>
                <Input
                  id="edit-name"
                  className="form-glass"
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser(prev => prev ? {...prev, full_name: e.target.value} : null)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-phone">No. Telepon</Label>
                <Input
                  id="edit-phone"
                  className="form-glass"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {...prev, phone: e.target.value} : null)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value) => {
                    const selectedRole = getAvailableRoles().find(r => r.value === value);
                    setEditingUser(prev => prev ? {
                      ...prev, 
                      role: value as UserRole,
                      app_access_type: selectedRole?.access as any || prev.app_access_type
                    } : null);
                  }}
                >
                  <SelectTrigger className="form-glass">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dropdown-content">
                    {getAvailableRoles().map((roleOption) => {
                      const IconComponent = roleOption.icon;
                      return (
                        <SelectItem key={roleOption.value} value={roleOption.value} className="select-item">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <span>{roleOption.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {(role === 'ho_admin' || role === 'ho_owner') && 
               !['ho_admin', 'ho_owner', 'ho_staff'].includes(editingUser.role) && (
                <div className="space-y-2">
                  <Label htmlFor="edit-branch">Branch</Label>
                  <Select 
                    value={editingUser.branch_id || ''} 
                    onValueChange={(value) => setEditingUser(prev => prev ? {...prev, branch_id: value} : null)}
                  >
                    <SelectTrigger className="form-glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dropdown-content">
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id} className="select-item">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>{branch.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

                {/* Assignment Fields for Edit */}
                {editingUser?.role === 'bh_report' && (
                  <div className="space-y-2">
                    <Label htmlFor="assigned_rider_edit">Assigned Rider</Label>
                    <Select 
                      value={editingUser.assigned_rider || ''} 
                      onValueChange={(value) => setEditingUser(prev => prev ? {...prev, assigned_rider: value} : null)}
                    >
                      <SelectTrigger className="form-glass">
                        <SelectValue placeholder="Pilih rider untuk di-assign" />
                      </SelectTrigger>
                      <SelectContent className="dropdown-content">
                        {riders.map((rider) => (
                          <SelectItem key={rider.id} value={rider.id} className="select-item">
                            <div className="flex items-center gap-2">
                              <Bike className="h-4 w-4" />
                              <span>{rider.name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                {rider.code}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editingUser && ['rider', 'bh_rider', 'sb_rider'].includes(editingUser.role) && (
                  <div className="space-y-2">
                    <Label htmlFor="assigned_reporter_edit">Assigned Reporter</Label>
                    <Select 
                      value={editingUser.assigned_reporter || ''} 
                      onValueChange={(value) => setEditingUser(prev => prev ? {...prev, assigned_reporter: value} : null)}
                    >
                      <SelectTrigger className="form-glass">
                        <SelectValue placeholder="Pilih reporter untuk di-assign" />
                      </SelectTrigger>
                      <SelectContent className="dropdown-content">
                        {reporters.map((reporter) => (
                          <SelectItem key={reporter.id} value={reporter.id} className="select-item">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{reporter.full_name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                {reporter.role}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="p-3 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm">
                    {getAccessIcon(editingUser.app_access_type)}
                    <span className="font-medium">Akses Aplikasi:</span>
                    <Badge variant="outline">{getAccessLabel(editingUser.app_access_type)}</Badge>
                  </div>
                </div>

              </div>
              <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6 border-t">
                <div className="flex gap-3">
                  <Button 
                    onClick={updateUser} 
                    disabled={creating} 
                    className="btn-glass flex-1"
                  >
                    {creating ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)} 
                    className="btn-glass-outline flex-1"
                  >
                    Batal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}