import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  useEffect(() => {
    document.title = 'Daftar Cabang | Zeger ERP';
    (async () => {
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
    })();
  }, []);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Cabang</h1>
        <p className="text-sm text-muted-foreground">Detail alamat dan informasi cabang</p>
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
