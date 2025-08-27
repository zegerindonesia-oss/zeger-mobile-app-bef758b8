import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Users, 
  UserPlus, 
  Shield,
  Eye,
  EyeOff,
  Check,
  X,
  Edit,
  Trash2,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserRolePermissions } from "./UserRolePermissions";

interface UserManagementProps {
  role: 'ho_admin' | 'branch_manager';
  branchId?: string;
}

interface User {
  id: string;
  user_id?: string;
  full_name: string;
  phone?: string;
  role: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer';
  branch_id?: string;
  is_active: boolean;
  created_at: string;
  branches?: {
    name: string;
    branch_type: string;
  } | null;
}

interface NewUser {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  role: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer';
  branch_id?: string;
}

export const UserManagement = ({ role, branchId }: UserManagementProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<NewUser>({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'rider',
    branch_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          branches(name, branch_type)
        `)
        .neq('role', 'customer') // Only internal users
        .order('created_at', { ascending: false });

      // Branch managers can only see their branch users
      if (role === 'branch_manager' && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform the data to match our interface
      const transformedUsers = data?.map(user => ({
        ...user,
        branches: Array.isArray(user.branches) ? user.branches[0] : user.branches
      })) || [];

      setUsers(transformedUsers as User[]);
    } catch (error: any) {
      toast.error("Gagal memuat data user");
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
      toast.error("Gagal memuat data branch");
    }
  };

  const createUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast.error("Lengkapi data user");
      return;
    }

    // Branch managers can only assign to their branch
    const assignedBranchId = role === 'branch_manager' ? branchId : newUser.branch_id;

    if (!assignedBranchId && newUser.role !== 'ho_admin') {
      toast.error("Pilih branch untuk user");
      return;
    }

    setLoading(true);
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
        // Create profile linked to the auth user
        const profileData = {
          user_id: authData.user.id,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role: newUser.role,
          branch_id: assignedBranchId,
          is_active: true
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (profileError) throw profileError;

        toast.success(`User ${newUser.full_name} berhasil dibuat! Email: ${newUser.email}`);
        setDialogOpen(false);
        setNewUser({
          full_name: '',
          email: '',
          password: '',
          phone: '',
          role: 'rider',
          branch_id: ''
        });
        fetchUsers();
      }
    } catch (error: any) {
      toast.error("Gagal membuat user: " + error.message);
    } finally {
      setLoading(false);
    }
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
      toast.error("Gagal mengubah status user");
    }
  };

  const editUser = (user: User) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const updateUser = async () => {
    if (!editingUser) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          phone: editingUser.phone,
          role: editingUser.role,
          branch_id: editingUser.branch_id
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success("User berhasil diupdate");
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal update user: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    try {
      // First get the user_id to delete from auth
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', userId)
        .single();

      if (profile?.user_id) {
        // Delete from auth (this will cascade to profiles)
        const { error: authError } = await supabase.auth.admin.deleteUser(profile.user_id);
        if (authError) throw authError;
      }

      // Also delete from profiles table directly as backup
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

  const getRoleColor = (userRole: string) => {
    switch (userRole) {
      case 'ho_admin': return 'bg-destructive text-destructive-foreground';
      case 'branch_manager': return 'bg-warning text-warning-foreground';
      case 'rider': return 'bg-primary text-primary-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getRoleLabel = (userRole: string) => {
    switch (userRole) {
      case 'ho_admin': return 'HO Admin';
      case 'branch_manager': return 'Branch Manager';
      case 'rider': return 'Mobile Seller';
      default: return userRole;
    }
  };

  const getAvailableRoles = (): Array<{value: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer', label: string}> => {
    if (role === 'ho_admin') {
      return [
        { value: 'ho_admin', label: 'HO Admin' },
        { value: 'branch_manager', label: 'Branch Manager' },
        { value: 'rider', label: 'Mobile Seller' },
        { value: 'finance', label: 'Finance' }
      ];
    } else {
      // Branch managers can create riders and other branch staff
      return [
        { value: 'rider', label: 'Mobile Seller' },
        { value: 'finance', label: 'Finance Staff' }
      ];
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Permissions Management */}
      {role === 'ho_admin' && <UserRolePermissions role={role} />}
      
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manajemen User Internal
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Tambah User
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah User Baru</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nama Lengkap"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser(prev => ({...prev, full_name: e.target.value}))}
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({...prev, email: e.target.value}))}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({...prev, password: e.target.value}))}
                  />
                  <Input
                    placeholder="No. Telepon"
                    value={newUser.phone}
                    onChange={(e) => setNewUser(prev => ({...prev, phone: e.target.value}))}
                  />
                  
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer') => setNewUser(prev => ({...prev, role: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles().map((roleOption) => (
                        <SelectItem key={roleOption.value} value={roleOption.value}>
                          {roleOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {role === 'ho_admin' && newUser.role !== 'ho_admin' && (
                    <Select 
                      value={newUser.branch_id} 
                      onValueChange={(value) => setNewUser(prev => ({...prev, branch_id: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name} ({branch.branch_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {role === 'branch_manager' && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        User akan ditambahkan ke branch Anda
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={createUser} disabled={loading} className="flex-1">
                      {loading ? "Membuat..." : "Buat User"}
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                      Batal
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">
                    {users.filter(u => u.role === 'rider').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Mobile Sellers</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-success">
                    {users.filter(u => u.role === 'rider' && u.is_active).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Mobile Sellers</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-warning">
                    {users.filter(u => u.role === 'branch_manager').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Branch Staff</div>
                </CardContent>
              </Card>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.role)}>
                        <Shield className="h-3 w-3 mr-1" />
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.branches ? `${user.branches.name}` : 'No Branch'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editUser(user)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={user.is_active ? "secondary" : "default"}
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                        >
                          {user.is_active ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus user "{user.full_name}"? 
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUser(user.id, user.full_name)}>
                                Hapus
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
            
            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Belum ada user internal</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User - {editingUser?.full_name}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <Input
                placeholder="Nama Lengkap"
                value={editingUser.full_name}
                onChange={(e) => setEditingUser(prev => prev ? {...prev, full_name: e.target.value} : null)}
              />
              <Input
                placeholder="No. Telepon"
                value={editingUser.phone || ''}
                onChange={(e) => setEditingUser(prev => prev ? {...prev, phone: e.target.value} : null)}
              />
              
              <Select 
                value={editingUser.role} 
                onValueChange={(value: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer') => 
                  setEditingUser(prev => prev ? {...prev, role: value} : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((roleOption) => (
                    <SelectItem key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {role === 'ho_admin' && editingUser.role !== 'ho_admin' && (
                <Select 
                  value={editingUser.branch_id || ''} 
                  onValueChange={(value) => setEditingUser(prev => prev ? {...prev, branch_id: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.branch_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex gap-2">
                <Button onClick={updateUser} disabled={loading} className="flex-1">
                  {loading ? "Updating..." : "Update User"}
                </Button>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                  Batal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};