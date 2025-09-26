import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus } from "lucide-react";

interface BranchCreationFormProps {
  userRole: string;
  branchId?: string;
  onBranchCreated?: () => void;
}

interface NewBranch {
  name: string;
  address: string;
  phone: string;
  code: string;
  level: number;
  parent_branch_id?: string;
  branch_type: string;
}

export function BranchCreationForm({ userRole, branchId, onBranchCreated }: BranchCreationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [newBranch, setNewBranch] = useState<NewBranch>({
    name: '',
    address: '',
    phone: '',
    code: '',
    level: userRole.startsWith('1_') ? 2 : 3, // HO can create Hub, Hub can create Small Branch
    parent_branch_id: userRole.startsWith('2_') ? branchId : undefined,
    branch_type: userRole.startsWith('1_') ? 'hub' : 'small_branch'
  });

  const canCreateBranch = userRole.startsWith('1_') || userRole.startsWith('2_') || 
                         ['ho_admin', 'branch_manager'].includes(userRole);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .eq('level', 2) // Only show hub branches as potential parents
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error: any) {
      console.error('Error fetching branches:', error);
    }
  };

  const createBranch = async () => {
    if (!newBranch.name || !newBranch.address || !newBranch.phone || !newBranch.code) {
      toast.error("Lengkapi semua data wajib");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert({
          name: newBranch.name,
          address: newBranch.address,
          phone: newBranch.phone,
          code: newBranch.code,
          level: newBranch.level,
          parent_branch_id: newBranch.parent_branch_id,
          branch_type: newBranch.branch_type,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`${newBranch.branch_type === 'hub' ? 'Branch Hub' : 'Small Branch'} "${newBranch.name}" berhasil dibuat`);
      setIsOpen(false);
      setNewBranch({
        name: '',
        address: '',
        phone: '',
        code: '',
        level: userRole.startsWith('1_') ? 2 : 3,
        parent_branch_id: userRole.startsWith('2_') ? branchId : undefined,
        branch_type: userRole.startsWith('1_') ? 'hub' : 'small_branch'
      });
      
      if (onBranchCreated) {
        onBranchCreated();
      }
    } catch (error: any) {
      toast.error("Gagal membuat branch: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (!canCreateBranch) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          onClick={() => {
            setIsOpen(true);
            fetchBranches();
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat {userRole.startsWith('1_') || userRole === 'ho_admin' ? 'Branch Hub' : 'Small Branch'}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Buat {newBranch.branch_type === 'hub' ? 'Branch Hub' : 'Small Branch'} Baru
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="branch-name">Nama Branch *</Label>
            <Input
              id="branch-name"
              value={newBranch.name}
              onChange={(e) => setNewBranch(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Contoh: Zeger Graha Kota"
            />
          </div>

          <div>
            <Label htmlFor="branch-code">Kode Branch *</Label>
            <Input
              id="branch-code"
              value={newBranch.code}
              onChange={(e) => setNewBranch(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="Contoh: GK-01"
            />
          </div>

          <div>
            <Label htmlFor="branch-address">Alamat *</Label>
            <Input
              id="branch-address"
              value={newBranch.address}
              onChange={(e) => setNewBranch(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Alamat lengkap branch"
            />
          </div>

          <div>
            <Label htmlFor="branch-phone">No. Telepon *</Label>
            <Input
              id="branch-phone"
              value={newBranch.phone}
              onChange={(e) => setNewBranch(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Nomor telepon branch"
            />
          </div>

          {/* Show parent branch selection for HO creating small branches */}
          {userRole.startsWith('1_') && newBranch.level === 3 && (
            <div>
              <Label htmlFor="parent-branch">Parent Branch Hub</Label>
              <Select
                value={newBranch.parent_branch_id || ''}
                onValueChange={(value) => setNewBranch(prev => ({ ...prev, parent_branch_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Branch Hub induk" />
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

          {/* Branch type selection for HO */}
          {userRole.startsWith('1_') && (
            <div>
              <Label htmlFor="branch-type">Tipe Branch</Label>
              <Select
                value={newBranch.branch_type}
                onValueChange={(value) => setNewBranch(prev => ({
                  ...prev,
                  branch_type: value,
                  level: value === 'hub' ? 2 : 3,
                  parent_branch_id: value === 'hub' ? undefined : prev.parent_branch_id
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hub">Branch Hub</SelectItem>
                  <SelectItem value="small_branch">Small Branch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={createBranch} 
              disabled={creating}
              className="flex-1"
            >
              {creating ? "Membuat..." : "Buat Branch"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={creating}
            >
              Batal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}