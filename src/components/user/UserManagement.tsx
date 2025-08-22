import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, 
  UserPlus, 
  Shield,
  Eye,
  EyeOff,
  Check,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      // Create auth user (this would typically be done through admin SDK)
      // For now, we'll create the profile directly
      const profileData = {
        full_name: newUser.full_name,
        phone: newUser.phone,
        role: newUser.role,
        branch_id: assignedBranchId,
        is_active: true,
        user_id: null // Will be set when auth user is created
      };

      const { error } = await supabase
        .from('profiles')
        .insert([profileData]);

      if (error) throw error;

      toast.success("User berhasil dibuat!");
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
        { value: 'rider', label: 'Mobile Seller' }
      ];
    } else {
      return [
        { value: 'rider', label: 'Mobile Seller' }
      ];
    }
  };

  return (
    <div className="space-y-6">
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manajemen User Internal
            </CardTitle>
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
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{user.full_name}</h4>
                        <Badge className={getRoleColor(user.role)}>
                          <Shield className="h-3 w-3 mr-1" />
                          {getRoleLabel(user.role)}
                        </Badge>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {user.phone && <p>📞 {user.phone}</p>}
                        {user.branches && (
                          <p>🏢 {user.branches.name} ({user.branches.branch_type})</p>
                        )}
                        <p>📅 Dibuat: {new Date(user.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={user.is_active ? "destructive" : "default"}
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                      >
                        {user.is_active ? (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            Nonaktifkan
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            Aktifkan
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada user internal</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};