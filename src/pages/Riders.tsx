import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RiderProfile {
  id: string;
  full_name: string;
  phone: string | null;
  branch_id: string | null;
  is_active: boolean | null;
}

export default function Riders() {
  const [riders, setRiders] = useState<RiderProfile[]>([]);

  useEffect(() => {
    document.title = 'Daftar Rider | Zeger ERP';
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone, branch_id, is_active, role')
          .eq('role', 'rider')
          .order('full_name');
        if (error) throw error;
        setRiders((data as any[]) as RiderProfile[]);
      } catch (e: any) {
        toast.error('Gagal memuat rider: ' + e.message);
      }
    })();
  }, []);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Rider</h1>
        <p className="text-sm text-muted-foreground">Semua rider dan detail kontak</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riders.map((r) => (
          <Card key={r.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{r.full_name}</CardTitle>
                <Badge variant={r.is_active ? 'default' : 'secondary'}>
                  {r.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Telepon:</span> {r.phone || '-'}</div>
              <div><span className="text-muted-foreground">Branch:</span> {r.branch_id || '-'}</div>
            </CardContent>
          </Card>
        ))}
        {riders.length === 0 && (
          <div className="text-muted-foreground">Belum ada rider atau akses dibatasi</div>
        )}
      </div>
    </main>
  );
}
