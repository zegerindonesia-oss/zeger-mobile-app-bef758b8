import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  branch_type: string | null;
  is_active: boolean | null;
}

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [creating, setCreating] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    document.title = 'Daftar Cabang | Zeger ERP';
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, code, name, address, phone, branch_type, is_active')
        .order('name');
      if (error) throw error;
      setBranches((data as Branch[]) || []);
    } catch (e: any) {
      toast.error('Gagal memuat cabang: ' + e.message);
    }
  };

  const createMalangBranch = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-malang-branch');
      
      if (error) {
        toast.error('Gagal membuat branch: ' + error.message);
        return;
      }

      toast.success('Zeger Branch Hub Malang berhasil dibuat!');
      console.log('Branch creation result:', data);
      
      // Refresh branches list
      fetchBranches();
      
    } catch (error: any) {
      toast.error('Error: ' + error.message);
      console.error('Branch creation error:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cabang</h1>
          <p className="text-sm text-muted-foreground">Detail alamat dan informasi cabang</p>
        </div>
        {userProfile?.role === 'ho_admin' && (
          <Button onClick={createMalangBranch} disabled={creating} className="gap-2">
            {creating ? (
              <>
                <Building className="h-4 w-4 animate-spin" />
                Membuat Branch...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Buat Branch Hub Malang
              </>
            )}
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => (
          <Card key={b.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{b.name}</CardTitle>
                <Badge variant={b.is_active ? 'default' : 'secondary'}>
                  {b.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">Kode: {b.code}</div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Alamat:</span> {b.address || '-'}</div>
              <div><span className="text-muted-foreground">Telepon:</span> {b.phone || '-'}</div>
              <div><span className="text-muted-foreground">Tipe:</span> {b.branch_type || '-'}</div>
            </CardContent>
          </Card>
        ))}
        {branches.length === 0 && (
          <div className="text-muted-foreground">Belum ada cabang</div>
        )}
      </div>
    </main>
  );
}
