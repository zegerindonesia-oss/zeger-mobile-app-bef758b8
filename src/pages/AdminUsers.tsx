import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserManagement } from "@/components/user/UserManagement";

export default function AdminUsers() {
  const { user, userProfile } = useAuth();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    document.title = 'User Management | Zeger ERP';
  }, []);

  const promoteToHO = async () => {
    try {
      await supabase.from('profiles').update({ role: 'ho_admin', is_active: true }).eq('user_id', user?.id || '');
      toast.success('Akun Anda diupgrade menjadi HO Admin.');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast.error(e.message || 'Gagal upgrade role');
    }
  };

  const createDummyBranch = async () => {
    setCreating(true);
    try {
      const { error } = await supabase.from('branches').insert({
        code: 'BR-A',
        name: 'Branch OTW',
        address: 'Jl. Contoh No. 123',
        phone: '0812-0000-0000',
        branch_type: 'hub',
        is_active: true,
      });
      if (error) throw error;
      toast.success('Cabang dummy "Branch OTW" dibuat.');
    } catch (e: any) {
      toast.error(e.message || 'Gagal membuat cabang');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-muted-foreground">Kelola role dan penempatan user.</p>
      </header>

      {userProfile?.role !== 'ho_admin' && userProfile?.role !== 'branch_manager' && (
        <Card>
          <CardHeader>
            <CardTitle>Aktifkan Akses Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Untuk mulai menambahkan manager dan rider, ubah akun Anda menjadi HO Admin terlebih dahulu.</p>
            <Button onClick={promoteToHO}>Jadikan saya HO Admin</Button>
          </CardContent>
        </Card>
      )}

      {userProfile?.role === 'ho_admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Alat Cepat</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={createDummyBranch} disabled={creating}>Buat Cabang Dummy: Branch OTW</Button>
          </CardContent>
        </Card>
      )}

      {/* Manajemen User */}
      {userProfile && (userProfile.role === 'ho_admin' || userProfile.role === 'branch_manager') && (
        <UserManagement 
          role={userProfile.role === 'ho_admin' ? 'ho_admin' : 'branch_manager'} 
          branchId={userProfile.role === 'branch_manager' ? userProfile.branch_id : undefined}
        />
      )}
    </main>
  );
}
