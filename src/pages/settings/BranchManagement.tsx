import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Building2, Plus, Search, Edit, Users, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  description: string;
  is_active: boolean;
  branch_type: string;
  parent_branch_id: string | null;
  level: number;
  created_at: string;
  user_count?: number;
}

interface User {
  id: string;
  full_name: string;
  role: string;
  branch_id: string;
}

const TYPE_LABEL: Record<string, string> = { small: 'Outlet Dine-in', street: 'Zeger on the Street' };

const BranchManagement = () => {
  const { userProfile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [hubs, setHubs] = useState<{ id: string; name: string }[]>([]);
  const isHO = ['ho_admin', '1_HO_Admin', 'ho_owner', '1_HO_Owner'].includes(String(userProfile?.role));
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    description: "",
    branch_type: "small",
    parent_branch_id: "",
  });

  useEffect(() => {
    if (!userProfile) return;
    fetchBranches();
    fetchUsers();
    supabase.from('branches').select('id, name').eq('level', 2).eq('is_active', true).order('name')
      .then(({ data }) => setHubs(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  const fetchBranches = async () => {
    try {
      let query = supabase
        .from('branches')
        .select('*')
        .eq('level', 3)
        .order('name');

      if (!isHO && userProfile?.branch_id) {
        query = query.eq('parent_branch_id', userProfile.branch_id);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Get user count for each branch
      const branchesWithCount = await Promise.all((data || []).map(async (branch) => {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('branch_id', branch.id);
        return { ...branch, user_count: count || 0 };
      }));

      setBranches(branchesWithCount as any);
    } catch (error: any) {
      toast.error("Gagal memuat data cabang: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      let q = supabase
        .from('profiles')
        .select('id, full_name, role, branch_id')
        .neq('role', 'rider');
      if (userProfile?.branch_id) q = q.eq('branch_id', userProfile.branch_id);
      const { data, error } = await q;

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data user: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const parent = formData.parent_branch_id || userProfile?.branch_id;
      if (!parent) { toast.error("Pilih Cabang Induk (Brand Hub) dulu"); return; }
      const branchData = {
        ...formData,
        level: 3,
        parent_branch_id: parent,
        is_active: true
      };

      if (selectedBranch) {
        const { error } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', selectedBranch.id);
          
        if (error) throw error;
        toast.success("Cabang berhasil diperbarui");
      } else {
        const { error } = await supabase
          .from('branches')
          .insert(branchData);
          
        if (error) throw error;
        toast.success("Cabang berhasil ditambahkan");
      }
      
      setIsDialogOpen(false);
      setSelectedBranch(null);
      setFormData({ name: "", code: "", address: "", phone: "", description: "", branch_type: "small", parent_branch_id: hubs[0]?.id || "" });
      fetchBranches();
    } catch (error: any) {
      toast.error("Gagal menyimpan cabang: " + error.message);
    }
  };

  const handleAssignUsers = async () => {
    try {
      if (!selectedBranch || selectedUsers.length === 0) return;

      // Update selected users to new branch
      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: selectedBranch.id })
        .in('id', selectedUsers);

      if (error) throw error;

      toast.success(`${selectedUsers.length} user berhasil dipindahkan ke ${selectedBranch.name}`);
      setIsAssignDialogOpen(false);
      setSelectedUsers([]);
      fetchBranches();
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal memindahkan user: " + error.message);
    }
  };

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      description: branch.description,
      branch_type: branch.branch_type || 'small',
      parent_branch_id: branch.parent_branch_id || '',
    });
    setIsDialogOpen(true);
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Branch Management</h1>
            <p className="text-muted-foreground">Kelola outlet dine-in & Zeger on the Street di bawah Brand Hub</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setSelectedBranch(null);
              setFormData({ name: "", code: "", address: "", phone: "", description: "", branch_type: "small", parent_branch_id: hubs[0]?.id || "" });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Cabang
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedBranch ? 'Edit Cabang' : 'Tambah Cabang Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nama Cabang</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="code">Kode Cabang</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipe Cabang</Label>
                  <Select value={formData.branch_type} onValueChange={(v) => setFormData({ ...formData, branch_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Outlet Dine-in</SelectItem>
                      <SelectItem value="street">Zeger on the Street</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cabang Induk (Brand Hub)</Label>
                  <Select value={formData.parent_branch_id} onValueChange={(v) => setFormData({ ...formData, parent_branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih Brand Hub" /></SelectTrigger>
                    <SelectContent>
                      {hubs.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Alamat</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="phone">No. Telepon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              
              <Button type="submit" className="w-full">
                {selectedBranch ? 'Perbarui' : 'Tambah'} Cabang
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daftar Cabang</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari cabang..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBranches.map((branch) => (
              <Card key={branch.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{branch.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{branch.code} · {TYPE_LABEL[branch.branch_type] || branch.branch_type}</p>
                    </div>
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? "Aktif" : "Tidak Aktif"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{branch.address || "Alamat tidak diisi"}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{branch.user_count} User</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(branch)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedBranch(branch);
                        setIsAssignDialogOpen(true);
                      }}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Assign User
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredBranches.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Tidak ada cabang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Users Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User ke {selectedBranch?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pilih user yang akan dipindahkan ke cabang ini:
            </p>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={user.id}
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                  />
                  <label htmlFor={user.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{user.full_name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">({user.role})</span>
                  </label>
                </div>
              ))}
            </div>
            
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada user tersedia untuk dipindahkan
              </p>
            )}
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleAssignUsers} disabled={selectedUsers.length === 0}>
                Assign {selectedUsers.length} User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchManagement;